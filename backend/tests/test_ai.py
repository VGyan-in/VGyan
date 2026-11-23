from app.db import session_factory
from app.models import AiAssessment, OcrRecord
from tests.conftest import give_consent, jpeg_bytes, register

READING_REQ = {
    "language": "English",
    "level": "Easy",
    "reference_text": "The boy went to school.",
    "transcript": "The boy go to school",
    "metrics": {"accuracy": 80, "wpm": 5, "pace": "Slow", "substitutions": 1, "omissions": 0, "insertions": 0, "practice_words": ["went"]},
    "mistakes": [{"status": "substitution", "ref": "went", "hyp": "go"}],
}

GOOD_READING = {
    "summary": "You read most words well!",
    "working_well": ["You read clearly."],
    "needs_improvement": ["Look carefully at 'went'."],
    "suggestions": ["Read the passage again tomorrow."],
    "practice_words": ["went", "elephant"],
}


def test_reading_feedback_is_validated_and_versioned(client, fake_gemini):
    h = register(client)
    give_consent(client, h)
    fake_gemini.push_json(GOOD_READING, model_version="gemini-2.5-flash-001")
    r = client.post("/ai/reading-feedback", json=READING_REQ, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["practice_words"] == ["went"]  # "elephant" is not in the passage
    assert body["model_version"] == "gemini-2.5-flash-001"
    assert body["prompt_version"] == "reading-feedback-v1.0"
    assert "accuracy" not in body  # AI never returns metrics

    sent = fake_gemini.requests[0]
    assert sent["generationConfig"]["responseMimeType"] == "application/json"
    prompt = sent["contents"][0]["parts"][0]["text"]
    assert "accuracy 80%" in prompt and "went -> go" in prompt
    with session_factory()() as db:
        rec = db.query(AiAssessment).one()
        assert rec.status == "completed" and rec.prompt_version == "reading-feedback-v1.0"


def test_kannada_prompt_requires_kannada_output(client, fake_gemini):
    h = register(client)
    give_consent(client, h)
    fake_gemini.push_json({**GOOD_READING, "practice_words": []})
    req = {**READING_REQ, "language": "Kannada", "reference_text": "ನನ್ನ ಶಾಲೆ", "transcript": "ನನ್ನ ಶಾಲೆ"}
    assert client.post("/ai/reading-feedback", json=req, headers=h).status_code == 200
    assert "Kannada" in fake_gemini.requests[0]["systemInstruction"]["parts"][0]["text"]


def test_invalid_model_output_fails_and_is_logged(client, fake_gemini):
    h = register(client)
    give_consent(client, h)
    fake_gemini.push_json({"summary": "", "working_well": []})  # missing fields, empty summary
    r = client.post("/ai/reading-feedback", json=READING_REQ, headers=h)
    assert r.status_code == 502 and r.json()["error"]["code"] == "ai_failed"
    with session_factory()() as db:
        assert db.query(AiAssessment).one().status == "failed"


def test_upstream_errors_are_retried_then_reported(client, fake_gemini):
    h = register(client)
    give_consent(client, h)
    fake_gemini.push_status(503)
    fake_gemini.push_json(GOOD_READING)
    assert client.post("/ai/reading-feedback", json=READING_REQ, headers=h).status_code == 200
    for _ in range(3):
        fake_gemini.push_status(500)
    assert client.post("/ai/reading-feedback", json=READING_REQ, headers=h).status_code == 502


def test_ai_unconfigured_returns_503(client, monkeypatch):
    from app.core.config import get_settings

    h = register(client)
    give_consent(client, h)
    monkeypatch.setattr(get_settings(), "gemini_api_key", None)
    r = client.post("/ai/reading-feedback", json=READING_REQ, headers=h)
    assert r.status_code == 503 and r.json()["error"]["code"] == "ai_unavailable"


def test_ai_needs_consent(client, fake_gemini):
    h = register(client)
    assert client.post("/ai/reading-feedback", json=READING_REQ, headers=h).status_code == 428
    assert fake_gemini.requests == []  # nothing left the server


def test_writing_assessment(client, fake_gemini):
    h = register(client)
    give_consent(client, h)
    fake_gemini.push_json(
        {
            "summary": "Nice festival story.",
            "working_well": ["Good ideas"],
            "needs_improvement": ["Spelling"],
            "suggestions": ["Read it aloud"],
            "corrected": "My favourite festival is Diwali.",
            "grammar_score": 80,
            "vocabulary_score": 70,
            "spelling_score": 90,
            "score": 7.5,
            "misspelled": ["favrite", "notinthetext"],
        }
    )
    r = client.post(
        "/ai/writing-assessment", json={"language": "English", "text": "My favrite festival is Diwali.", "min_words": 40}, headers=h
    )
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["misspelled"] == ["favrite"]
    assert b["score"] == 7.5 and b["prompt_version"] == "writing-assessment-v1.0"
    assert "5 words, 1 sentences" in fake_gemini.requests[0]["contents"][0]["parts"][0]["text"]


def test_writing_scores_out_of_range_rejected(client, fake_gemini):
    h = register(client)
    give_consent(client, h)
    fake_gemini.push_json(
        {
            "summary": "x",
            "working_well": [],
            "needs_improvement": [],
            "suggestions": [],
            "corrected": "x",
            "grammar_score": 180,
            "vocabulary_score": 70,
            "spelling_score": 90,
            "score": 7,
            "misspelled": [],
        }
    )
    r = client.post("/ai/writing-assessment", json={"language": "English", "text": "x"}, headers=h)
    assert r.status_code == 502


def test_ocr_records_original_image_and_text(client, fake_gemini):
    h = register(client)
    give_consent(client, h)
    fake_gemini.push_text("ನಮ್ಮ ಪರಿಸರ\n")
    r = client.post("/ocr", data={"language": "kn"}, files={"file": ("w.jpg", jpeg_bytes(), "image/jpeg")}, headers=h)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["text"] == "ನಮ್ಮ ಪರಿಸರ" and b["confidence"] is None  # never a made-up confidence
    assert "ocr-transcribe-v1.0" in b["engine_version"]
    sent = fake_gemini.requests[0]
    assert sent["contents"][0]["parts"][1]["inlineData"]["mimeType"] == "image/jpeg"
    assert "Do NOT correct spelling" in sent["systemInstruction"]["parts"][0]["text"]
    with session_factory()() as db:
        rec = db.query(OcrRecord).one()
        assert rec.language == "Kannada" and rec.image_key and rec.text == "ನಮ್ಮ ಪರಿಸರ"


def test_ocr_requires_handwriting_consent(client, fake_gemini):
    h = register(client)
    give_consent(client, h, handwriting=False)
    r = client.post("/ocr", data={"language": "en"}, files={"file": ("w.jpg", jpeg_bytes(), "image/jpeg")}, headers=h)
    assert r.status_code == 403 and fake_gemini.requests == []


def test_ocr_rejects_non_images(client, fake_gemini):
    h = register(client)
    give_consent(client, h)
    r = client.post("/ocr", data={"language": "en"}, files={"file": ("w.jpg", b"GIF89a....", "image/jpeg")}, headers=h)
    assert r.status_code == 415


def test_google_vision_provider_reports_confidence(client, monkeypatch):
    import httpx

    from app.core.config import get_settings
    from app.services import ocr

    h = register(client)
    give_consent(client, h)
    monkeypatch.setattr(get_settings(), "ocr_provider", "google_vision")
    monkeypatch.setattr(get_settings(), "google_vision_api_key", "k")
    payload = {
        "responses": [{"fullTextAnnotation": {"text": "hello world", "pages": [{"blocks": [{"confidence": 0.9}, {"confidence": 0.7}]}]}}]
    }
    ocr.set_transport(httpx.MockTransport(lambda req: httpx.Response(200, json=payload)))
    try:
        r = client.post("/ocr", data={"language": "en"}, files={"file": ("w.jpg", jpeg_bytes(), "image/jpeg")}, headers=h)
    finally:
        ocr.set_transport(None)
    assert r.status_code == 200 and r.json()["confidence"] == 0.8 and r.json()["text"] == "hello world"
