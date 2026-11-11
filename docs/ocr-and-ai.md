# Handwriting OCR and AI feedback

## Data chain for writing

```
photo (original, kept)  ──►  POST /ocr  ──►  raw OCR text (server record, ocr_records)
                                              │
                                     student corrects on the phone
                                              ▼
                            original_ocr  +  corrected_text  (separate, both immutable once synced)
                                              │
                                    POST /ai/writing-assessment (corrected text)
                                              ▼
                               scores + feedback + model_version + prompt_version
```

- The server stores the exact image it ran OCR on, plus the raw text the engine returned, *before* the student can edit anything. When the attempt syncs, the server checks that the phone's `original_ocr` matches its own record (`ocr_matches_server`).
- OCR and AI need an internet connection. Typed writing works fully offline. Its AI assessment is fetched on the next sync.
- Photos are only sent for OCR when the guardian consented to handwriting collection (`handwriting_consent`). Otherwise the app asks the student to type.

## OCR providers (`OCR_PROVIDER`)

| Provider | Confidence | Notes |
|---|---|---|
| `gemini` (default) | none (stored as null, never estimated) | Same API key as feedback. Instructed to transcribe exactly and not to correct the child's mistakes. |
| `google_vision` | block-level confidence | `DOCUMENT_TEXT_DETECTION` with `kn`/`en` language hints. Needs `GOOGLE_VISION_API_KEY`. |
| `none` | – | OCR disabled; the app offers typing. |

### Kannada handwriting: limitation

**Not verified for any provider.** No real student samples were available. Do not treat Kannada OCR text as research data until it has been measured:

1. Collect 50 or more handwriting photos per language from the target age groups, taken with the app.
2. Have someone transcribe them exactly.
3. Compute character error rate for `gemini` and `google_vision`, using `/ocr`, which records engine version and latency.
4. Choose a provider, or restrict Kannada writing to typed input if both are poor. The student-correction step limits the harm in the meantime: assessment always runs on the text the student confirmed.

## AI feedback

- Runs only on the server (`backend/app/services/gemini.py`). The app holds no API keys and never generates feedback or scores locally. Without a connection, the attempt shows "pending" and is completed on the next sync.
- Prompts live in `backend/app/services/prompts.py` and are versioned (`reading-feedback-v1.0`, `writing-assessment-v1.0`, `ocr-transcribe-v1.0`). Change the version whenever a prompt changes.
- Output is forced to JSON (`responseSchema`) and validated with Pydantic: list lengths are bounded, scores range-checked, and practice words and misspellings filtered to words actually in the passage or text. Invalid output is rejected and logged as a failed generation.
- Reading feedback receives the deterministic metrics as facts. It returns no numbers, so the AI cannot change accuracy or WPM.
- Writing scores (grammar, vocabulary, spelling 0–100; overall 0–10) are AI judgements against a written rubric. They are labelled with model and prompt version. They should be compared with teacher ratings on a sample before being used as research outcomes.
- Every generation is stored in `ai_assessments`: kind, attempt, status, model and prompt version, input hash, output or error, latency.
- Student content goes to Gemini only when research consent is active on the server.
