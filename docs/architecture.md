# Architecture

## Components

```
┌──────────────── Android phone (offline-first) ────────────────┐        ┌──────────── Server ────────────┐
│ Expo / React Native app (client/)                             │        │ FastAPI (backend/app)          │
│  screens (src/app) ─ state (src/state/app-store.tsx)          │ HTTPS  │  api/student  api/sync         │
│  SQLite repository (src/core/db) ── sync queue (src/core/sync)├───────►│  api/ai (Gemini, OCR)          │
│  Kotlin module modules/vgyan-speech: AudioRecord → WAV + Vosk │        │  api/teacher api/content       │
│  analyzer.ts (alignment, metrics)                             │        │  api/research api/admin        │
│  WorkManager background upload (expo-background-task)         │        │  services/: analysis, storage, │
└───────────────────────────────────────────────────────────────┘        │  deletion, integrity, gemini   │
                                                                         │ PostgreSQL (Alembic)            │
┌──── Teacher dashboard (web/) ────┐   HTTPS + bearer token              │ S3-compatible private bucket    │
│ React + Vite, static (GitHub     ├────────────────────────────────────►│ Gemini / Google Vision (HTTPS)  │
│ Pages); roles: teacher/researcher│                                     └─────────────────────────────────┘
│ /admin                           │
└──────────────────────────────────┘
```

| Part | Responsibility | Key files |
|---|---|---|
| App UI | Onboarding, consent, profile, reading and writing flows, progress, sync status | `client/src/app/**` |
| App state | Sign-in, consent, attempts, sync worker, AI feedback retries | `client/src/state/app-store.tsx` |
| On-device store | SQLite with migrations via `PRAGMA user_version`; every record kept as JSON payload plus indexed columns | `client/src/core/db/repository.ts` |
| Sync | Queue (`pending → uploading → synced/failed`), backoff with jitter, cross-process lock, uploader | `client/src/core/sync/*` |
| Speech | 16 kHz mono PCM WAV capture, streaming Vosk recognition, file transcription, model download | `client/modules/vgyan-speech`, `client/src/features/reading/{asr,models}.ts` |
| Reading analysis | Word alignment → accuracy, WPM, WCPM, errors, practice words | `client/src/features/reading/analyzer.ts`, mirrored in `backend/app/services/analysis.py` |
| Backend API | Auth, idempotent sync, AI/OCR proxy, teacher views, research export, admin | `backend/app/api/*` |
| Storage | Local (dev) or S3 (prod), content-addressed, signed URLs | `backend/app/services/storage.py` |
| Deletion and integrity | Participant deletion with a durable storage-deletion queue; DB/storage cross-check | `backend/app/services/{deletion,integrity}.py`, `backend/app/cli.py` |
| Dashboard | Class overview, students, attempts, missed words, notes, passages and assignments, research export, admin | `web/src/components/*`, `web/src/api/dashboard.ts` |

## Key flows

### Reading attempt
1. The recording screen loads the speech model (if installed) and starts the Kotlin module, which writes the WAV and feeds Vosk on a second thread.
2. On stop, the processing screen **saves the attempt first** (status `pending` transcription) so the audio is safe, then completes or re-runs recognition, computes metrics and updates the attempt.
3. The attempt is queued. The sync worker uploads it as multipart (`record` JSON + WAV). The server verifies checksums, stores the WAV, re-derives the metrics (`metrics_verified`) and appends a revision.
4. AI feedback is requested from `/ai/reading-feedback` when online. The updated attempt is queued again.
5. Without a model for the language (Kannada today) the attempt stays `pending`, with no metrics, until a model is installed.

### Sync semantics
- Records have client-generated UUIDs. The server upserts and returns `created`, `updated` or `unchanged`. Retries are safe.
- Source fields (passage text, transcript once completed, OCR text, corrected text) are immutable after upload. The first media file received is the original and is never replaced.
- The app marks an item synced only after a 2xx. It deletes local media only after the server's MD5 receipt matches the local file, and only if purge is enabled.
- Status handling: 401 waits for sign-in; 409 (concurrent upload), 408, 425, 428 (consent not yet on server), 429 and 5xx retry with backoff; other 4xx stop and need a person.
- Run order: pending transcriptions → uploads → content and profile refresh → up to 6 AI-feedback requests (stop at the first connectivity failure) → upload of records changed by feedback.
- Shared phones: only the signed-in student's items are uploaded; others wait for that student's sign-in.

### Consent
Consent is a separate synced record. The server rejects attempts (428) until an active consent with research consent exists. Withdrawal is a new revision of the same record; reactivation is refused.

## Data model (PostgreSQL)

Core tables: `schools`, `classes` (join code), `staff_users`, `teacher_classes`, `students`, `consent_records`, `sessions`, `passages`, `assignments`, `reading_attempts`, `writing_attempts`.
Lineage and accountability: `record_revisions` (exact JSON of every accepted version), `ai_assessments`, `ocr_records`, `audit_log`, `research_exports`, `deletion_requests`, `storage_deletions`.
See [database.md](database.md).

## Design decisions
- **Offline-first.** Classrooms may have no connectivity. Recognition and metrics run on the phone; the server re-checks them.
- **Deterministic metrics, AI only for prose.** Gemini never produces accuracy or WPM. Writing scores are AI judgements, labelled with model and prompt version.
- **Native module instead of `react-native-vosk`.** The research original (WAV) must be saved and recognised from the same samples, and existing files must be transcribable later.
- **Content-addressed write-once storage** for reproducibility.
- **Single process rate limiter**, acceptable for a pilot on one instance.

## Known architectural limits
- No background job runner: deletions purge synchronously with a retry queue, and there is no retention scheduler yet.
- Teacher list and analytics endpoints load all attempts of the visible students in one request. This is fine for classes of 40 students with hundreds of attempts; add pagination or SQL aggregation before district-scale use.
- AI calls are synchronous inside the request (bounded by `GEMINI_TOTAL_BUDGET_SECONDS`).
