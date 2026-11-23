import base64
import json
import os
import re
from typing import Any, Dict, List, Optional

import modal

app = modal.App("mirvo-ai-backend")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "fastapi[standard]>=0.115.0",
    "httpx>=0.27.0",
    "openai>=1.60.0",
    "pydantic>=2.7.0",
)

DASHSCOPE_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

EXPLAIN_VIDEO_PROMPT = """You are Mirvo AI, an interactive STEM & visual whiteboard tutor teaching in Uzbek (Lotin alifbosi).
Carefully inspect every provided video keyframe AND any audio/transcript explanation from start to finish:
1. Read ALL diagrams, 2D schematics, 3D geometries, force vectors, hydraulic pistons, electric circuits, graphs, numbers, labels, and equations visible across the frames, and capture the teacher's spoken logic ("why" and "how").
2. Reconstruct the lesson as 4 to 8 clear, progressive whiteboard steps.
3. For EACH step's visual_type and visual_data, choose the closest exact visual mode:
   - "custom_2d_svg": Reconstruct any 2D physics, math, circuit, hydraulic, or science diagram faithfully using clean, well-proportioned inline SVG with viewBox="0 0 600 360", crisp academic colors (#2563EB, #F59E0B, #10B981, #EF4444, #0F172A), clear directional arrows, and concise Uzbek labels.
     Provide visual_data: {
       "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 360'>...</svg>",
       "viewBox": "0 0 600 360",
       "labels": [{ "text": "...", "x": 180, "y": 140, "color": "#2563EB", "partId": "part_0" }],
       "highlights": [{ "x": 300, "y": 180, "r": 28, "color": "#F59E0B", "label": "..." }]
     }
   - "custom_3d_scene": Reconstruct any 3D geometry, force vectors, mechanical piston, or spatial scene using interactive 3D primitives so learners can rotate and inspect it.
     Provide visual_data: {
       "showAxes": true,
       "objects": [
         { "type": "box" | "cylinder" | "sphere" | "cone" | "torus" | "vector" | "arrow" | "plane", "position": [x, y, z], "rotation": [rx, ry, rz], "args": [...], "from": [x1, y1, z1], "to": [x2, y2, z2], "color": "#2563EB", "opacity": 1.0, "label": "...", "partId": "part_0" }
       ]
     }
   - Or use built-in catalog visual types when exact: "pythagoras", "triangle", "circle", "unit_circle", "polygon", "photosynthesis", "sky_scattering", "plotly2d" (with {"expression": "..."}), "plotly3d" (with {"expression_z": "..."}), "mermaid" (with {"diagram": "..."}), "object_2d", "object_3d".
4. Write simple, clear, step-by-step Uzbek explanations:
   - "speech_text": MUST be written strictly in natural spoken Uzbek words ONLY, WITHOUT raw math symbols (+, -, =, *, /, ^, $, √, π). Write "qo'shilgan", "ayirilgan", "teng", "ko'paytirilgan", "bo'lingan", "kvadrat", "pi" in words so TTS reads smoothly.
   - "latex" and "katex_formulas": clean LaTeX strings for display on the whiteboard.
5. Return ONLY valid JSON matching types/tutor.ts:
{
  "topic_title": "...",
  "subject": "physics" | "math" | "geometry" | "chemistry" | "biology" | "history" | "language",
  "engine": "svg2d" | "threejs" | "plotly2d" | "plotly3d" | "mermaid",
  "sliders": [{ "id": "...", "label": "...", "min": 0, "max": 10, "step": 1, "default": 5, "unit": "" }],
  "steps": [
    {
      "step_number": 1,
      "board_title": "...",
      "step_title": "...",
      "latex": "...",
      "katex_formulas": ["..."],
      "visual_type": "custom_2d_svg" | "custom_3d_scene" | ...,
      "visual_data": { ... },
      "speech_text": "...",
      "explanation_uz": "...",
      "emoji_emotion": "explaining",
      "quiz": {
        "question": "...",
        "options": ["...", "...", "..."],
        "correct_index": 0,
        "explanation_uz": "..."
      }
    }
  ]
}"""


def _extract_json(raw: str) -> Dict[str, Any]:
    text = (raw or "").strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        try:
            return json.loads(fenced.group(1).strip())
        except Exception:
            pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return json.loads(text[start : end + 1])
    raise ValueError("Model returned non-JSON payload")


def _extract_youtube_video_id(raw: str) -> Optional[str]:
    trimmed = (raw or "").strip()
    if not trimmed:
        return None
    if re.fullmatch(r"[a-zA-Z0-9_-]{11}", trimmed):
        return trimmed
    for pat in (
        r"[?&]v=([a-zA-Z0-9_-]{11})",
        r"youtu\.be/([a-zA-Z0-9_-]{11})",
        r"youtube\.com/embed/([a-zA-Z0-9_-]{11})",
        r"youtube\.com/shorts/([a-zA-Z0-9_-]{11})",
        r"youtube\.com/live/([a-zA-Z0-9_-]{11})",
    ):
        m = re.search(pat, trimmed)
        if m:
            return m.group(1)
    return None


async def _fetch_youtube_public_previews(
    youtube_url_or_id: str,
) -> List[str]:
    import httpx

    video_id = _extract_youtube_video_id(youtube_url_or_id)
    if not video_id:
        return []

    preview_frames: List[str] = []
    async with httpx.AsyncClient(timeout=5.0) as client:
        for slot in ("hqdefault.jpg", "1.jpg", "2.jpg", "3.jpg"):
            try:
                r = await client.get(f"https://img.youtube.com/vi/{video_id}/{slot}")
                if r.status_code == 200 and len(r.content) > 1800:
                    b64 = base64.b64encode(r.content).decode("ascii")
                    preview_frames.append(f"data:image/jpeg;base64,{b64}")
            except Exception:
                continue

    return preview_frames


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("mirvo-secrets")],
    timeout=120,
)
@modal.asgi_app()
def fastapi_app():
    import httpx
    from fastapi import FastAPI, Header, HTTPException
    from pydantic import BaseModel, Field

    web = FastAPI(title="Mirvo AI Modal Backend")

    class ExplainVideoPayload(BaseModel):
        frames: List[str] = Field(default_factory=list)
        audioBase64: Optional[str] = ""
        audioMime: Optional[str] = "audio/mp3"
        topic: Optional[str] = ""
        notes: Optional[str] = ""
        youtubeUrl: Optional[str] = ""
        transcript: Optional[str] = ""
        language: str = "uz"

    class GenerateLessonPayload(BaseModel):
        mode: Optional[str] = "image_or_topic"
        video_id: Optional[str] = None
        subtitles: Optional[str] = ""
        audio_base64: Optional[str] = ""
        audio_mime: Optional[str] = "audio/mp3"
        image_base64: Optional[str] = ""
        image_mime: Optional[str] = "image/jpeg"
        topic: Optional[str] = ""

    def verify_secret(
        x_mirvo_secret: Optional[str] = None,
        authorization: Optional[str] = None,
    ):
        expected = os.environ.get("MIRVO_INTERNAL_SECRET", "").strip()
        if not expected:
            return
        bearer = ""
        if authorization and authorization.lower().startswith("bearer "):
            bearer = authorization[7:].strip()
        provided = (x_mirvo_secret or bearer or "").strip()
        if provided != expected:
            raise HTTPException(status_code=401, detail="Invalid MIRVO_INTERNAL_SECRET")

    @web.get("/health")
    async def health():
        return {"ok": True, "service": "mirvo-ai-backend"}

    @web.post("/explain-video")
    async def explain_video(
        payload: ExplainVideoPayload,
        x_mirvo_secret: Optional[str] = Header(default=None),
        authorization: Optional[str] = Header(default=None),
    ):
        verify_secret(x_mirvo_secret, authorization)

        gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
        dashscope_key = os.environ.get("DASHSCOPE_API_KEY", "").strip()
        if not gemini_key and not dashscope_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")

        frames = [f.strip() for f in payload.frames[:15] if isinstance(f, str) and f.strip()]
        transcript_text = (payload.transcript or "").strip()
        if payload.youtubeUrl and not frames:
            yt_frames = await _fetch_youtube_public_previews(payload.youtubeUrl)
            if yt_frames:
                frames = yt_frames

        clean_audio = (payload.audioBase64 or "").strip()
        if "," in clean_audio and clean_audio.startswith("data:"):
            clean_audio = clean_audio.split(",", 1)[1].strip()
        audio_mime = (payload.audioMime or "audio/mp3").strip()

        if not frames and not clean_audio and not transcript_text and not (payload.topic or payload.notes or payload.youtubeUrl):
            raise HTTPException(status_code=400, detail="No frames, audio, transcript, or topic provided")

        context_lines = []
        if payload.topic:
            context_lines.append(f"Mavzu: {payload.topic}")
        if payload.notes:
            context_lines.append(f"Foydalanuvchi izohi: {payload.notes}")
        if payload.youtubeUrl:
            context_lines.append(f"YouTube havola: {payload.youtubeUrl}")
        if transcript_text:
            context_lines.append(f"YouTube subtitr / transkript:\n{transcript_text}")
        context_lines.append(f"Til: {payload.language or 'uz'}")
        context_lines.append(f"Kadrlar soni: {len(frames)}, Audio ilova: {'ha' if clean_audio else 'yoq'}")

        if gemini_key:
            gemini_parts: List[Dict[str, Any]] = [
                {"text": EXPLAIN_VIDEO_PROMPT + "\n\n" + "\n".join(context_lines)}
            ]
            for frame in frames:
                if frame.startswith("data:image/"):
                    header, b64 = frame.split(",", 1)
                    mime = header.split(";")[0].replace("data:", "") or "image/jpeg"
                else:
                    mime, b64 = "image/jpeg", frame
                gemini_parts.append({"inlineData": {"mimeType": mime, "data": b64}})
            if clean_audio:
                gemini_parts.append({"inlineData": {"mimeType": audio_mime, "data": clean_audio}})

            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                    params={"key": gemini_key},
                    headers={"Content-Type": "application/json"},
                    json={
                        "contents": [{"parts": gemini_parts}],
                        "generationConfig": {"responseMimeType": "application/json"},
                    },
                )
                if resp.status_code < 400:
                    gdata = resp.json()
                    raw_text = (
                        gdata.get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [{}])[0]
                        .get("text", "")
                    )
                    lesson_json = _extract_json(raw_text)
                    usage = gdata.get("usageMetadata") or {}
                    if isinstance(lesson_json, dict) and usage:
                        lesson_json["token_usage"] = {
                            "prompt_tokens": int(usage.get("promptTokenCount", 0) or 0),
                            "output_tokens": int(usage.get("candidatesTokenCount", 0) or 0),
                            "total_tokens": int(usage.get("totalTokenCount", 0) or 0),
                            "cost_usd": 0.0,
                            "llm_calls": 1,
                        }
                    return {
                        "lesson": lesson_json,
                        "stage": "modal-backend",
                        "provider": "modal-gemini",
                    }
                if not dashscope_key:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Gemini error {resp.status_code}: {resp.text[:300]}",
                    )

        content_parts: List[Dict[str, Any]] = [
            {
                "type": "text",
                "text": EXPLAIN_VIDEO_PROMPT + "\n\n" + "\n".join(context_lines),
            }
        ]
        for frame in frames:
            url = (
                frame
                if frame.startswith("data:image/")
                else f"data:image/jpeg;base64,{frame}"
            )
            content_parts.append({"type": "image_url", "image_url": {"url": url}})
        if clean_audio:
            fmt = "wav" if "wav" in audio_mime else "mp3"
            content_parts.append(
                {"type": "input_audio", "input_audio": {"data": clean_audio, "format": fmt}}
            )

        if clean_audio:
            dash_body: Dict[str, Any] = {
                "model": "qwen3.8-omni-flash",
                "modalities": ["text"],
                "enable_thinking": False,
                "messages": [{"role": "user", "content": content_parts}],
                "response_format": {"type": "json_object"},
            }
        else:
            dash_body = {
                "model": "qwen-vl-plus" if frames else "qwen-plus",
                "messages": [{"role": "user", "content": content_parts}],
                "temperature": 0.25,
                "response_format": {"type": "json_object"},
            }

        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                f"{DASHSCOPE_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {dashscope_key}",
                    "Content-Type": "application/json",
                },
                json=dash_body,
            )
            if resp.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail=f"DashScope error {resp.status_code}: {resp.text[:300]}",
                )
            data = resp.json()

        raw_content = (
            data.get("choices", [{}])[0].get("message", {}).get("content", "")
        )
        lesson_json = _extract_json(raw_content)
        usage = data.get("usage") or {}
        if isinstance(lesson_json, dict) and usage:
            lesson_json["token_usage"] = {
                "prompt_tokens": int(usage.get("prompt_tokens", 0) or 0),
                "output_tokens": int(usage.get("completion_tokens", 0) or 0),
                "total_tokens": int(usage.get("total_tokens", 0) or 0),
                "cost_usd": 0.0,
                "llm_calls": 1,
            }

        return {
            "lesson": lesson_json,
            "stage": "modal-backend",
            "provider": "modal-qwen-vl",
        }

    @web.post("/api/generate-lesson")
    async def generate_uz3d_lesson(
        payload: GenerateLessonPayload,
        x_mirvo_secret: Optional[str] = Header(default=None),
        authorization: Optional[str] = Header(default=None),
    ):
        verify_secret(x_mirvo_secret, authorization)

        supabase_url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

        # 1. Check Supabase cache by video_id ($0 repeat cost)
        if payload.video_id and supabase_url and supabase_key:
            async with httpx.AsyncClient(timeout=10.0) as client:
                cache_resp = await client.get(
                    f"{supabase_url}/rest/v1/uz3d_lessons",
                    params={"video_id": f"eq.{payload.video_id}", "select": "payload_json", "limit": "1"},
                    headers={
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                    },
                )
                if cache_resp.status_code == 200:
                    rows = cache_resp.json()
                    if isinstance(rows, list) and rows:
                        cached_payload = rows[0].get("payload_json")
                        if isinstance(cached_payload, dict):
                            cached_payload["cached"] = True
                            return cached_payload

        dashscope_key = os.environ.get("DASHSCOPE_API_KEY", "").strip()
        if not dashscope_key:
            raise HTTPException(status_code=500, detail="DASHSCOPE_API_KEY is not configured")

        effective_subtitles = (payload.subtitles or "").strip()
        effective_image = (payload.image_base64 or "").strip()
        if payload.video_id and not effective_image:
            yt_frames = await _fetch_youtube_public_previews(payload.video_id)
            if yt_frames:
                effective_image = yt_frames[0]

        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=dashscope_key,
            base_url=DASHSCOPE_BASE_URL,
        )

        system_prompt = (
            "You are Uz3D AI Tutor. Output ONLY valid JSON matching:\n"
            '{"lesson_id":"string","selected_model_id":"electric_motor|human_heart|atom_bohr|plant_cell|none_2d_board",'
            '"model_glb_url":null,"lesson_title_uz":"string","segments":[{"start_sec":0,"end_sec":20,'
            '"uzbek_title":"string","uzbek_explanation":"string","camera_hotspot":"overview|stator_coil|rotor_armature|commutator_brushes|right_atrium|left_ventricle|aorta_arch|nucleus_protons|electron_orbit_1|valence_shell|nucleus|chloroplast|mitochondria",'
            '"emoji_mimic":"explaining|amazed|thinking|happy|warning","key_formula_or_term":"string|null"}]}'
        )

        user_content: List[Dict[str, Any]] = [
            {
                "type": "text",
                "text": (
                    f"Mavzu: {payload.topic or 'Dars tahlili'}\n"
                    f"Subtitrlar:\n{effective_subtitles[:14000]}"
                ),
            }
        ]
        if effective_image:
            img_url = (
                effective_image
                if effective_image.startswith("data:")
                else f"data:{payload.image_mime or 'image/jpeg'};base64,{effective_image}"
            )
            user_content.append({"type": "image_url", "image_url": {"url": img_url}})
        if payload.audio_base64:
            clean_audio = payload.audio_base64.split(",", 1)[-1]
            user_content.append(
                {"type": "input_audio", "input_audio": {"data": clean_audio, "format": "mp3"}}
            )

        completion = await client.chat.completions.create(
            model="qwen3.8-omni-flash",
            modalities=["text"],
            extra_body={"enable_thinking": False},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )

        raw_text = completion.choices[0].message.content or ""
        lesson_json = _extract_json(raw_text)
        lesson_json["cached"] = False
        lesson_json["provider"] = "qwen3.8-omni-flash"

        if payload.video_id and supabase_url and supabase_key:
            async with httpx.AsyncClient(timeout=10.0) as sb:
                await sb.post(
                    f"{supabase_url}/rest/v1/uz3d_lessons",
                    headers={
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates",
                    },
                    json={"video_id": payload.video_id, "payload_json": lesson_json},
                )

        return lesson_json

    return web
