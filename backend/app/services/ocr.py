"""Handwriting OCR providers.

Kannada handwriting support is NOT verified for any provider yet: it must be measured against
human transcriptions of real student samples before the OCR text is used for research. The app
always lets the student correct the OCR output, and both versions are stored.
"""

import io
import logging
import time
from dataclasses import dataclass

import httpx
from PIL import Image, ImageOps

from app.core.config import get_settings
from app.core.errors import ApiError
from app.services import gemini
from app.services.prompts import OCR_PROMPT_VERSION, OCR_SYSTEM

log = logging.getLogger("vgyan.ocr")

VISION_URL = "https://vision.googleapis.com/v1/images:annotate"

_transport: httpx.BaseTransport | None = None


def set_transport(t: httpx.BaseTransport | None) -> None:
    global _transport
    _transport = t


@dataclass
class OcrOutput:
    text: str
    confidence: float | None
    provider: str
    engine_version: str
    latency_ms: int


def prepare_image(raw: bytes, max_side: int = 2000) -> bytes:
    """EXIF-rotate and downscale a copy for the OCR engine. The stored original is untouched."""
    with Image.open(io.BytesIO(raw)) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        im.thumbnail((max_side, max_side))
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=88)
        return buf.getvalue()


def run_ocr(raw: bytes, language: str) -> OcrOutput:
    s = get_settings()
    if s.ocr_provider == "none":
        raise ApiError(503, "ocr_unavailable", "Handwriting recognition is not enabled on the server")
    try:
        img = prepare_image(raw)
    except Exception as e:
        raise ApiError(422, "bad_image", "The image could not be read") from e

    if s.ocr_provider == "google_vision":
        return _google_vision(img, language)
    return _gemini(img, language)


def _gemini(img: bytes, language: str) -> OcrOutput:
    name = "Kannada script" if language == "Kannada" else "English, Latin script"
    try:
        r = gemini.generate(
            OCR_SYSTEM.format(language_name=name),
            [{"text": f"Transcribe the handwriting in this image. Language: {language}."}, gemini.image_part(img, "image/jpeg")],
            temperature=0.0,
        )
    except gemini.GeminiError as e:
        raise ApiError(502, "ocr_failed", "Handwriting recognition failed. Please try again or type your answer.") from e
    return OcrOutput(
        text=r.text.strip(),
        confidence=None,  # Gemini gives no calibrated confidence; never report a made-up number.
        provider="gemini",
        engine_version=f"{r.model_version}/{OCR_PROMPT_VERSION}",
        latency_ms=r.latency_ms,
    )


def _google_vision(img: bytes, language: str) -> OcrOutput:
    s = get_settings()
    if not s.google_vision_api_key:
        raise ApiError(503, "ocr_unavailable", "Handwriting recognition is not configured on the server")
    import base64

    hints = ["kn"] if language == "Kannada" else ["en"]
    body = {
        "requests": [
            {
                "image": {"content": base64.b64encode(img).decode("ascii")},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
                "imageContext": {"languageHints": hints},
            }
        ]
    }
    started = time.monotonic()
    try:
        with httpx.Client(timeout=60, transport=_transport) as client:
            res = client.post(VISION_URL, params={"key": s.google_vision_api_key}, json=body)
        res.raise_for_status()
        resp = res.json()["responses"][0]
    except Exception as e:
        raise ApiError(502, "ocr_failed", "Handwriting recognition failed. Please try again or type your answer.") from e
    if "error" in resp:
        raise ApiError(502, "ocr_failed", "Handwriting recognition failed. Please try again or type your answer.")
    doc = resp.get("fullTextAnnotation") or {}
    confs = [b.get("confidence") for p in doc.get("pages", []) for b in p.get("blocks", []) if b.get("confidence") is not None]
    return OcrOutput(
        text=(doc.get("text") or "").strip(),
        confidence=round(sum(confs) / len(confs), 3) if confs else None,
        provider="google_vision",
        engine_version="google-vision/DOCUMENT_TEXT_DETECTION",
        latency_ms=int((time.monotonic() - started) * 1000),
    )
