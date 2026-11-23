"""Gemini client (REST). The API key lives only on the server."""

import base64
import json
import logging
import time
from dataclasses import dataclass

import httpx

from app.core.config import get_settings
from app.core.errors import ApiError

log = logging.getLogger("vgyan.gemini")

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


@dataclass
class GeminiResult:
    text: str
    model_version: str
    latency_ms: int


class GeminiError(Exception):
    pass


# Tests replace this with a fake transport.
_transport: httpx.BaseTransport | None = None


def set_transport(t: httpx.BaseTransport | None) -> None:
    global _transport
    _transport = t


def is_configured() -> bool:
    return bool(get_settings().gemini_api_key)


def _sleep_within(deadline: float, seconds: float) -> bool:
    """Back off before a retry, but only if the retry can still finish inside the budget."""
    if time.monotonic() + seconds + 2 >= deadline:
        return False
    time.sleep(seconds)
    return True


def generate(
    system: str,
    user_parts: list[dict],
    response_schema: dict | None = None,
    temperature: float = 0.2,
) -> GeminiResult:
    s = get_settings()
    if not s.gemini_api_key:
        raise ApiError(503, "ai_unavailable", "AI feedback is not configured on the server")
    gen_cfg: dict = {"temperature": temperature}
    if response_schema:
        gen_cfg["responseMimeType"] = "application/json"
        gen_cfg["responseSchema"] = response_schema
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": user_parts}],
        "generationConfig": gen_cfg,
    }
    started = time.monotonic()
    deadline = started + s.gemini_total_budget_seconds
    data: dict | None = None
    with httpx.Client(transport=_transport) as client:
        for attempt in range(3):
            remaining = deadline - time.monotonic()
            if remaining <= 1:
                raise GeminiError("Gemini time budget exhausted")
            try:
                res = client.post(
                    ENDPOINT.format(model=s.gemini_model),
                    headers={"x-goog-api-key": s.gemini_api_key, "Content-Type": "application/json"},
                    json=body,
                    timeout=min(s.gemini_timeout_seconds, remaining),
                )
            except httpx.HTTPError as e:
                if attempt < 2 and _sleep_within(deadline, 1.5 * (attempt + 1)):
                    continue
                raise GeminiError(f"Gemini transport error: {type(e).__name__}") from e
            if res.status_code in (429, 500, 502, 503, 504) and attempt < 2 and _sleep_within(deadline, 1.5 * (attempt + 1)):
                continue
            if res.status_code >= 400:
                # Status only: the body can echo the prompt, which contains student text.
                raise GeminiError(f"Gemini HTTP {res.status_code}")
            try:
                data = res.json()
            except ValueError as e:
                raise GeminiError("Gemini returned a non-JSON response") from e
            break
    if not isinstance(data, dict):
        raise GeminiError("Gemini returned no usable response")

    candidates = data.get("candidates") or []
    if not candidates:
        reason = (data.get("promptFeedback") or {}).get("blockReason", "no candidates")
        raise GeminiError(f"Gemini returned no output ({reason})")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
    if not text.strip():
        raise GeminiError(f"Gemini returned empty output ({candidates[0].get('finishReason')})")
    return GeminiResult(
        text=text,
        model_version=str(data.get("modelVersion") or s.gemini_model),
        latency_ms=int((time.monotonic() - started) * 1000),
    )


def generate_json(system: str, user_text: str, schema: dict) -> tuple[dict, GeminiResult]:
    r = generate(system, [{"text": user_text}], response_schema=schema)
    try:
        return json.loads(r.text), r
    except json.JSONDecodeError as e:
        raise GeminiError("Gemini returned invalid JSON") from e


def image_part(data: bytes, mime: str) -> dict:
    return {"inlineData": {"mimeType": mime, "data": base64.b64encode(data).decode("ascii")}}
