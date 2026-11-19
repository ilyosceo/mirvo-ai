import json
import os
import unittest
from collections import deque
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

from modal_service.app import (
    LessonRequest,
    ALLOWED_ENDPOINTS,
    ALLOWED_MODELS,
    cache_eligible,
    cache_key,
    is_rate_limited,
    safe_provider_config,
    validate_lesson_json,
)


class ModalServiceValidationTests(unittest.TestCase):
    def test_only_simple_generic_educational_prompts_are_cacheable(self) -> None:
        self.assertTrue(cache_eligible("Pifagor teoremasini tushuntir", None))
        self.assertFalse(cache_eligible("Mening kasalligim haqida tushuntir", None))
        self.assertFalse(cache_eligible("What is my email me@example.com", None))
        self.assertFalse(cache_eligible("Pifagor teoremasini tushuntir", "aW1hZ2U="))

    def test_cache_key_includes_depth_and_hides_prompt_text(self) -> None:
        shallow_key = cache_key("Pifagor teoremasini tushuntir", "overview", "qwen-plus")
        deep_key = cache_key("Pifagor teoremasini tushuntir", "deep", "qwen-plus")
        other_model_key = cache_key("Pifagor teoremasini tushuntir", "deep", "qwen-max")
        self.assertNotEqual(shallow_key, deep_key)
        self.assertNotEqual(deep_key, other_model_key)
        self.assertNotIn("Pifagor", shallow_key)

    def test_rate_limit_caps_requests_per_minute(self) -> None:
        timestamps: deque[float] = deque()
        for request_number in range(30):
            self.assertFalse(is_rate_limited(timestamps, float(request_number)))
        self.assertTrue(is_rate_limited(timestamps, 30.0))
        self.assertFalse(is_rate_limited(timestamps, 60.0))

    def test_lesson_response_shape_is_checked(self) -> None:
        lesson = {
            "topic_title": "Pifagor teoremasi",
            "subject": "geometry",
            "engine": "svg2d",
            "sliders": [],
            "steps": [
                {
                    "step_number": 1,
                    "step_title": "Gipotenuza",
                    "speech_text": "Izoh",
                    "katex_formulas": [],
                    "explanation_uz": "Tushuntirish",
                    "emoji_emotion": "explaining",
                    "render_params": {},
                }
            ],
        }
        validate_lesson_json(json.dumps(lesson))
        with self.assertRaises((ValueError, json.JSONDecodeError)):
            validate_lesson_json('{"topic_title":"x","steps":[]}')

    def test_request_rejects_extra_fields_invalid_depth_and_invalid_images(self) -> None:
        base = {
            "query": "Pifagor teoremasini tushuntir",
            "user_prompt": "Dars tuz",
            "system_instruction": "Faqat JSON qaytar",
        }
        with self.assertRaises(ValidationError):
            LessonRequest.model_validate({**base, "unexpected": True})
        with self.assertRaises(ValidationError):
            LessonRequest.model_validate({**base, "depth_mode": "extreme"})
        with self.assertRaises(ValidationError):
            LessonRequest.model_validate(
                {**base, "image_base64": "not-base64", "image_mime_type": "image/png"}
            )

    def test_gateway_fails_closed_without_provider_and_long_shared_secrets(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(HTTPException) as missing_secret:
                safe_provider_config()
            self.assertEqual(missing_secret.exception.status_code, 503)

        with patch.dict(
            os.environ,
            {"DASHSCOPE_API_KEY": "test-key", "MODAL_GATEWAY_SECRET": "too-short"},
            clear=True,
        ):
            with self.assertRaises(HTTPException) as short_secret:
                safe_provider_config()
            self.assertEqual(short_secret.exception.status_code, 503)

    def test_provider_endpoint_and_model_are_server_side_allowlisted(self) -> None:
        with patch.dict(
            os.environ,
            {
                "DASHSCOPE_API_KEY": "test-key",
                "MODAL_GATEWAY_SECRET": "x" * 40,
                "DASHSCOPE_ENDPOINT": "http://127.0.0.1:8080/steal",
            },
            clear=True,
        ):
            with self.assertRaises(HTTPException):
                safe_provider_config()
        self.assertIn(
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
            ALLOWED_ENDPOINTS,
        )
        self.assertIn("qwen-plus", ALLOWED_MODELS)


if __name__ == "__main__":
    unittest.main()
