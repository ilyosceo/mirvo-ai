import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import re
import time
from collections import deque
from pathlib import Path
from typing import Annotated, Any

import httpx
import modal
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator


APP_NAME = "mirvo-qwen-gateway"
MAX_BODY_BYTES = 4_300_000
MAX_IMAGE_BYTES = 3 * 1024 * 1024
MAX_OUTPUT_CHARS = 100_000
CACHE_TTL_SECONDS = 30 * 24 * 60 * 60
CACHE_MAX_ENTRIES = 1000
RATE_LIMIT_REQUESTS = 30
RATE_LIMIT_WINDOW_SECONDS = 60
CACHE_DIR = Path("/cache/lessons")
logger = logging.getLogger("mirvo-qwen-gateway")
ALLOWED_ENDPOINTS = {
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
}
ALLOWED_MODELS = {
    "qwen-plus",
    "qwen-turbo",
    "qwen-max",
    "qwen-long",
    "qwen3-235b-a22b",
    "qwen3-32b",
    "qwen3-14b",
    "qwen3-8b",
}
PERSONAL_TERMS = {
    "i",
    "me",
    "my",
    "mine",
    "we",
    "our",
    "men",
    "menga",
    "mening",
    "menda",
    "biz",
    "bizga",
    "bizning",
    "bizda",
    "o'zim",
    "o'zimga",
    "shaxsiy",
    "manzilim",
    "telefonim",
    "emailim",
    "kasalligim",
    "alomatlarim",
    "hisobim",
}
EDUCATIONAL_CUES = {
    "explain",
    "describe",
    "teach",
    "show",
    "tushuntir",
    "izohla",
    "o'rgat",
    "qonuni",
    "teoremasi",
    "formulasi",
    "jarayoni",
    "tuzilishi",
    "xossalari",
    "mavzusi",
    "algoritmi",
    "nazariyasi",
    "farqi",
}


class LessonRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: Annotated[str, Field(max_length=4000)]
    user_prompt: Annotated[str, Field(min_length=1, max_length=12000)]
    system_instruction: Annotated[str, Field(min_length=1, max_length=40000)]
    depth_mode: str = "standard"
    image_base64: Annotated[str | None, Field(max_length=4_200_000)] = None
    image_mime_type: Annotated[str | None, Field(max_length=32)] = None

    @model_validator(mode="after")
    def validate_image(self) -> "LessonRequest":
        if self.depth_mode not in {"overview", "standard", "deep"}:
            raise ValueError("invalid lesson depth")
        if self.image_base64 is None:
            if self.image_mime_type is not None:
                raise ValueError("image MIME type requires image data")
            return self
        if self.image_mime_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise ValueError("unsupported image MIME type")
        try:
            image = base64.b64decode(self.image_base64, validate=True)
        except (ValueError, base64.binascii.Error) as exc:
            raise ValueError("invalid base64 image") from exc
        if len(image) > MAX_IMAGE_BYTES:
            raise ValueError("image exceeds size limit")
        return self


class Usage(BaseModel):
    prompt_tokens: Annotated[int, Field(ge=0)]
    completion_tokens: Annotated[int, Field(ge=0)]
    total_tokens: Annotated[int, Field(ge=0)]


class LessonResponse(BaseModel):
    text: Annotated[str, Field(min_length=1, max_length=MAX_OUTPUT_CHARS)]
    usage: Usage
    cache_hit: bool


def cache_key(query: str, depth_mode: str, model: str) -> str:
    normalized = f"v1:{model}:{depth_mode}:" + " ".join(query.casefold().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def cache_eligible(query: str, image_base64: str | None) -> bool:
    if image_base64 or not query or len(query) > 80:
        return False
    if re.search(r"[@:/\\\d?!.]", query):
        return False
    words = re.findall(r"[a-zA-Z\u00c0-\u024f\u0400-\u04ffʻʼ'’-]+", query.casefold())
    if not words or len(words) > 8:
        return False
    if any(word in PERSONAL_TERMS for word in words):
        return False
    return any(word in EDUCATIONAL_CUES for word in words)


def validate_lesson_json(text: str) -> None:
    if not text or len(text) > MAX_OUTPUT_CHARS:
        raise ValueError("invalid response size")
    lesson = json.loads(text)
    if not isinstance(lesson, dict):
        raise ValueError("lesson must be a JSON object")
    if not all(isinstance(lesson.get(key), str) and lesson[key] for key in ("topic_title", "subject", "engine")):
        raise ValueError("lesson is missing required text fields")
    if len(lesson["topic_title"]) > 200:
        raise ValueError("lesson title exceeds size limit")
    if lesson["subject"] not in {"math", "geometry", "physics", "chemistry", "biology", "history", "language"}:
        raise ValueError("invalid lesson subject")
    if lesson["engine"] not in {"plotly3d", "plotly2d", "threejs", "pdb", "pubchem", "mermaid", "svg2d"}:
        raise ValueError("invalid lesson engine")
    sliders = lesson.get("sliders")
    if not isinstance(sliders, list) or len(sliders) > 20:
        raise ValueError("invalid lesson sliders")
    for slider in sliders:
        if not isinstance(slider, dict) or not {
            "id",
            "label",
            "min",
            "max",
            "step",
            "default",
        }.issubset(slider):
            raise ValueError("invalid lesson slider")
        if not isinstance(slider["id"], str) or not isinstance(slider["label"], str):
            raise ValueError("invalid lesson slider")
        if any(
            isinstance(slider[key], bool) or not isinstance(slider[key], (int, float))
            for key in ("min", "max", "step", "default")
        ):
            raise ValueError("invalid lesson slider")
    steps = lesson.get("steps")
    if not isinstance(steps, list) or not 1 <= len(steps) <= 16:
        raise ValueError("invalid lesson steps")
    required_step_fields = {
        "step_number",
        "step_title",
        "speech_text",
        "katex_formulas",
        "explanation_uz",
        "emoji_emotion",
        "render_params",
    }
    for step in steps:
        if not isinstance(step, dict) or not required_step_fields.issubset(step):
            raise ValueError("invalid lesson step")
        if (
            isinstance(step["step_number"], bool)
            or not isinstance(step["step_number"], int)
            or not isinstance(step["step_title"], str)
            or not isinstance(step["speech_text"], str)
            or not isinstance(step["explanation_uz"], str)
            or not isinstance(step["katex_formulas"], list)
            or not all(isinstance(formula, str) for formula in step["katex_formulas"])
            or step["emoji_emotion"]
            not in {"explaining", "thinking", "happy", "surprised", "pointing", "encouraging"}
            or not isinstance(step["render_params"], dict)
        ):
            raise ValueError("invalid lesson step")
        if len(step["speech_text"]) > 4000 or len(step["explanation_uz"]) > 8000:
            raise ValueError("lesson step exceeds size limit")


def read_cache(key: str) -> dict[str, Any] | None:
    CACHE_VOLUME.reload()
    path = CACHE_DIR / f"{key}.json"
    try:
        entry = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (TypeError, ValueError):
        logger.warning("Ignoring invalid shared lesson cache entry")
        return None
    if not isinstance(entry, dict) or time.time() - entry.get("created_at", 0) > CACHE_TTL_SECONDS:
        return None
    response = entry.get("response")
    if not isinstance(response, dict):
        return None
    try:
        return LessonResponse.model_validate(response).model_dump()
    except ValidationError:
        return None


def write_cache(key: str, response: dict[str, Any]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    temp = CACHE_DIR / f".{key}.{os.getpid()}.{time.time_ns()}.tmp"
    target = CACHE_DIR / f"{key}.json"
    temp.write_text(
        json.dumps({"created_at": time.time(), "response": response}, separators=(",", ":")),
        encoding="utf-8",
    )
    os.replace(temp, target)


def safe_provider_config() -> tuple[str, str, str, str]:
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    shared_secret = os.environ.get("MODAL_GATEWAY_SECRET", "")
    endpoint = os.environ.get(
        "DASHSCOPE_ENDPOINT",
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    )
    model = os.environ.get("QWEN_MODEL", "qwen-plus")
    if not api_key or len(shared_secret) < 32:
        raise HTTPException(status_code=503, detail="AI service is not configured")
    if endpoint not in ALLOWED_ENDPOINTS or model not in ALLOWED_MODELS:
        raise HTTPException(status_code=503, detail="AI service configuration is invalid")
    return api_key, shared_secret, endpoint, model


def prune_cache() -> None:
    now = time.time()
    files = list(CACHE_DIR.glob("*.json"))
    live: list[tuple[float, Path]] = []
    for path in files:
        try:
            stat = path.stat()
            if now - stat.st_mtime > CACHE_TTL_SECONDS:
                path.unlink(missing_ok=True)
            else:
                live.append((stat.st_mtime, path))
        except OSError:
            continue
    for _, path in sorted(live)[: max(0, len(live) - CACHE_MAX_ENTRIES)]:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            continue


def is_rate_limited(timestamps: deque[float], now: float) -> bool:
    while timestamps and now - timestamps[0] >= RATE_LIMIT_WINDOW_SECONDS:
        timestamps.popleft()
    if len(timestamps) >= RATE_LIMIT_REQUESTS:
        return True
    timestamps.append(now)
    return False


modal_app = modal.App(APP_NAME)
cache_volume = modal.Volume.from_name("mirvo-qwen-lesson-cache", create_if_missing=True)
cache_image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "fastapi==0.115.12",
    "httpx==0.28.1",
    "pydantic==2.11.3",
)
CACHE_VOLUME = cache_volume
CACHE_LOCK = asyncio.Lock()
REQUEST_TIMESTAMPS: deque[float] = deque()


async def load_shared_cache(key: str) -> dict[str, Any] | None:
    async with CACHE_LOCK:
        try:
            return await asyncio.to_thread(read_cache, key)
        except Exception as exc:
            logger.warning("Shared lesson cache read failed (%s)", type(exc).__name__)
            return None


async def save_shared_cache(key: str, response: dict[str, Any]) -> None:
    async with CACHE_LOCK:
        await asyncio.to_thread(write_cache, key, response)
        await asyncio.to_thread(prune_cache)
        await asyncio.to_thread(CACHE_VOLUME.commit)


@modal_app.function(
    image=cache_image,
    secrets=[modal.Secret.from_name("mirvo-qwen-secrets")],
    volumes={"/cache": cache_volume},
    cpu=1,
    memory=1024,
    timeout=70,
    max_containers=1,
)
@modal.concurrent(max_inputs=8)
@modal.asgi_app()
def web() -> FastAPI:
    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @api.post("/v1/lesson/generate", response_model=LessonResponse)
    async def generate(request: Request) -> LessonResponse | JSONResponse:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_BODY_BYTES:
                    return JSONResponse(status_code=413, content={"detail": "Request exceeds size limit"})
            except ValueError:
                return JSONResponse(status_code=400, content={"detail": "Invalid content length"})
        chunks: list[bytes] = []
        total_size = 0
        async for chunk in request.stream():
            total_size += len(chunk)
            if total_size > MAX_BODY_BYTES:
                return JSONResponse(status_code=413, content={"detail": "Request exceeds size limit"})
            chunks.append(chunk)
        raw_body = b"".join(chunks)
        try:
            payload = LessonRequest.model_validate_json(raw_body)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail="Invalid lesson request") from exc

        try:
            api_key, expected_secret, endpoint, model = safe_provider_config()
        except HTTPException:
            raise
        supplied = request.headers.get("authorization", "")
        if not supplied.startswith("Bearer ") or not hmac.compare_digest(
            supplied[7:], expected_secret
        ):
            raise HTTPException(status_code=401, detail="Unauthorized")

        if is_rate_limited(REQUEST_TIMESTAMPS, time.monotonic()):
            raise HTTPException(status_code=429, detail="Too many lesson requests")

        eligible = cache_eligible(payload.query, payload.image_base64)
        key = cache_key(payload.query, payload.depth_mode, model) if eligible else None
        if key is not None:
            cached = await load_shared_cache(key)
            if cached is not None:
                cached["cache_hit"] = True
                cached["usage"] = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                return LessonResponse.model_validate(cached)

        user_content: list[dict[str, Any]] = [{"type": "text", "text": payload.user_prompt}]
        if payload.image_base64 and payload.image_mime_type:
            user_content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{payload.image_mime_type};base64,{payload.image_base64}"
                    },
                }
            )
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(connect=5, read=55, write=10, pool=5)
            ) as client:
                async with client.stream(
                    "POST",
                    endpoint,
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": payload.system_instruction},
                            {"role": "user", "content": user_content},
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.4,
                        "max_tokens": 8192,
                    },
                ) as provider_response:
                    if provider_response.status_code == 429:
                        raise HTTPException(status_code=503, detail="AI provider is temporarily busy")
                    if provider_response.status_code >= 400:
                        raise HTTPException(status_code=502, detail="AI provider request failed")
                    response_body = bytearray()
                    async for chunk in provider_response.aiter_bytes():
                        response_body.extend(chunk)
                        if len(response_body) > 1024 * 1024:
                            raise HTTPException(status_code=502, detail="AI provider response is too large")
        except httpx.TimeoutException as exc:
            raise HTTPException(status_code=504, detail="AI provider timed out") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="AI provider unavailable") from exc
        try:
            provider_data = json.loads(response_body)
            text = provider_data["choices"][0]["message"]["content"]
            if not isinstance(text, str):
                raise ValueError("provider content is not text")
            validate_lesson_json(text)
            raw_usage = provider_data.get("usage") or {}
            usage = Usage(
                prompt_tokens=max(0, int(raw_usage.get("prompt_tokens", 0))),
                completion_tokens=max(0, int(raw_usage.get("completion_tokens", 0))),
                total_tokens=max(0, int(raw_usage.get("total_tokens", 0))),
            )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            raise HTTPException(status_code=502, detail="AI provider returned an invalid lesson")

        response = LessonResponse(text=text, usage=usage, cache_hit=False)
        if key is not None:
            try:
                await save_shared_cache(key, response.model_dump())
            except Exception as exc:
                logger.warning("Shared lesson cache write failed (%s)", type(exc).__name__)
        return response

    return api
