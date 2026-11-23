# API reference

The authoritative, always-current reference is the OpenAPI page of a running server: `/docs`
(interactive) and `/openapi.json`. This page summarises the contract and the conventions the app and
dashboard depend on.

## Conventions

- Auth: `Authorization: Bearer <JWT>` from `/student/login`, `/student/register` or `/auth/staff/login`.
- Errors always have the same shape: `{"error": {"code": "...", "message": "..."}, "detail": "..."}`.
  Validation errors add `error.fields` (locations and messages only, never submitted values).
- Every response carries `X-Request-ID` (send your own, up to 64 chars of letters, digits, `-` and `_`, to correlate logs).
- Sync endpoints take `multipart/form-data`: a `record` field (JSON exactly as stored on the phone) and an optional `file`.

## Endpoints

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/health` | public | Liveness |
| GET | `/health/ready` | public | Database, migration, storage; reports whether AI/OCR are configured |
| POST | `/student/register` | public | `{student_id?, fullName, email?, password, classCode?}` → token. Invalid class code → 422 `invalid_class_code` |
| POST | `/student/login` | public | `{student_id (participant ID or e-mail), password}` → token |
| GET/PATCH | `/student/me` | student | Profile; PATCH accepts profile fields and `classCode` |
| POST | `/student/logout-all` | student | Revoke all tokens |
| GET | `/student/my_report` | student | Synced history for the progress screens |
| GET | `/student/assignments` | student | Active passages/prompts for offline caching, flagged if assigned to the class |
| POST | `/student/me/deletion-request` | student | Request deletion of research data (idempotent while pending) |
| POST | `/sync/consent` | student | Consent record (create, or withdraw) |
| POST | `/sync/reading` | student | Reading attempt + WAV |
| POST | `/sync/writing` | student | Writing attempt + image |
| POST | `/ai/reading-feedback` | student | Qualitative feedback (no numbers) |
| POST | `/ai/writing-assessment` | student | Rubric scores + feedback |
| POST | `/ocr` | student | `language=en|kn` + image → raw OCR text, server record ID |
| POST | `/auth/staff/login`, `/auth/staff/logout-all` | staff | |
| GET | `/teacher/me` | staff | Account and assigned classes with join codes |
| GET | `/teacher/students[?classId=]`, `/teacher/students/{id}` | teacher, admin | Summaries / full history |
| GET | `/teacher/reading/{id}/audio`, `/teacher/writing/{id}/image` | teacher, admin | Signed media URL (audited) |
| GET | `/teacher/missed-words`, `/teacher/analytics` | teacher, admin | Aggregates over completed readings |
| GET/POST | `/teacher/comments` | teacher, admin | Notes on students |
| GET | `/teacher/classes/{id}/teachers` | admin | |
| GET/POST | `/passages`; PUT `/passages/{id}` | staff / teacher, admin | List includes `canEdit`; teachers edit only their own |
| GET/POST | `/assignments`; DELETE `/assignments/{id}` | teacher, admin | Class-scoped |
| GET | `/research/summary`, `/research/export?dataset=reading|writing|participants&language=&start=&end=` | researcher, admin | De-identified CSV with `X-Content-SHA256` and `X-Export-ID` |
| GET/POST | `/admin/schools`, `/admin/classes`, `/admin/staff` | admin | |
| PUT | `/admin/staff/{id}/classes`; POST `/admin/staff/{id}/deactivate` | admin | |
| GET | `/admin/deletion-requests`; POST `/admin/deletion-requests/{id}` `{action: complete|reject, note}` | admin | Completing deletes data and queues stored files |
| GET | `/admin/storage-deletions`; POST `/admin/storage-deletions/retry` | admin | Files from completed deletions not yet removed |

## Sync status codes (the app relies on these)

| Code | Meaning | App behaviour |
|---|---|---|
| 200 | `created`, `updated` or `unchanged`, with `file_sha256`, `file_md5`, `file_bytes`, `metrics_verified` | Mark synced; purge local media only if `file_md5` matches |
| 401 | Session expired or revoked | Clear token; wait for sign-in (no retry counted) |
| 403 | Record belongs to another participant | Stop; needs a person |
| 409 | Same record uploaded concurrently | Retry with backoff |
| 413 | File or request too large | Stop |
| 415 | Unsupported media type | Stop |
| 422 | Invalid record, checksum mismatch, immutable field changed | Stop; needs a person |
| 428 | No active research consent on the server yet | Retry (consent is queued first) |
| 429 / 5xx | Rate limit / server error | Retry with backoff |

## Changes in this audit (backwards compatible)

- 409 is now returned for a concurrent first upload (was 500). Older app builds treated 409 as success; no such build was released.
- 413 `payload_too_large` for bodies over `MAX_REQUEST_MB`.
- `/ocr` returns 422 `no_text_found` for a blank page (was 502).
- `/passages` items include `canEdit`; `PUT /passages/{id}` returns 403 for teachers on passages they did not create.
- Research reading export has a new `asr_status` column; formula-like text cells start with `'`.
- New admin endpoints for storage deletions; new response header `X-Export-ID`.
