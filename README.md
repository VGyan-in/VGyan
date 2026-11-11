# VGyan: Bilingual Reading & Writing Assessment

[![CI - App](https://github.com/VGyan-in/VGyan/actions/workflows/ci.yml/badge.svg)](https://github.com/VGyan-in/VGyan/actions/workflows/ci.yml)
[![CI - Backend](https://github.com/VGyan-in/VGyan/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/VGyan-in/VGyan/actions/workflows/backend-ci.yml)
[![CI - Dashboard](https://github.com/VGyan-in/VGyan/actions/workflows/web-ci.yml/badge.svg)](https://github.com/VGyan-in/VGyan/actions/workflows/web-ci.yml)
[![Android Build](https://github.com/VGyan-in/VGyan/actions/workflows/android-build.yml/badge.svg)](https://github.com/VGyan-in/VGyan/actions/workflows/android-build.yml)
[![Security](https://github.com/VGyan-in/VGyan/actions/workflows/security.yml/badge.svg)](https://github.com/VGyan-in/VGyan/actions/workflows/security.yml)

VGyan assesses school students' **reading fluency** and **writing** in **English and Kannada**. Reading, speech recognition and the reading metrics work fully offline on the phone. Everything is kept as a research data chain, **original input → processed → assessed**, and synced to a server when the phone is online.

| Component | Folder | Stack |
|---|---|---|
| Student app (Android) | [`client/`](client/) | Expo SDK 57 / React Native, TypeScript, SQLite, custom Kotlin module (Vosk) |
| Backend | [`backend/`](backend/) | FastAPI, PostgreSQL, Alembic, S3-compatible private storage, Gemini |
| Teacher dashboard | [`web/`](web/) | React, TypeScript, Vite |

Further documents:
- [docs/asr-evaluation.md](docs/asr-evaluation.md): offline speech design, measured results, validation still required
- [docs/ocr-and-ai.md](docs/ocr-and-ai.md): OCR providers, Kannada handwriting limitation, AI feedback rules
- [docs/deployment.md](docs/deployment.md): deploying the backend, dashboard and Android app

## Data flow

```
 Phone (offline-first)                               Server
 ───────────────────                                 ──────
 record 16 kHz WAV ─► Vosk ASR (on device) ─► align & score ─┐
 photo ─► /ocr ─► student corrects ─► counts ────────────────┤   /sync/*   upsert by client UUID,
 typed text ─────────────────────────────────────────────────┤ ─────────► append-only revisions,
                SQLite + sync queue (pending→uploading→synced)│            checksum receipts,
                                                              │            re-verify metrics
                       /ai/* (Gemini, when online) ◄──────────┘            ▼
                                                                Teacher dashboard / research export
```

Rules the code enforces:
- Metrics (accuracy, WPM, substitutions, omissions, insertions) are computed deterministically on the phone. The server recomputes them from the transcript and flags any disagreement. Gemini only writes qualitative feedback and is never given the chance to change a metric.
- Original audio and images are stored write-once under their SHA-256. The first file received is never replaced. The phone deletes its copy only after the server confirms the same MD5, and only if `EXPO_PUBLIC_PURGE_MEDIA_AFTER_SYNC=true`.
- `original_ocr` and `corrected_text` are separate. Neither can change after upload, and the server checks the OCR text against its own OCR record.
- No research data is accepted, and nothing goes to Gemini, until an active consent record is on the server. Sync answers `428` until then, and the phone retries.
- Without a speech model for a language (Kannada today), the recording is still kept and synced as *pending transcription*. No transcript or metrics are invented.

## Quick start (development)

```bash
# Backend (needs Docker for Postgres)
docker run -d --name vgyan-pg -e POSTGRES_USER=vgyan -e POSTGRES_PASSWORD=vgyan -e POSTGRES_DB=vgyan -p 5433:5432 postgres:16-alpine
cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt
cp .env.example .env && alembic upgrade head
python -m app.cli create-admin --email you@school.org --name "Your Name"
uvicorn app.main:app --reload            # http://localhost:8000/docs
pytest                                    # uses database vgyan_test

# Dashboard
cd web && npm install && echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local && npm run dev

# App (Android dev build; Expo Go cannot load the native speech module)
cd client && npm install && echo "EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-IP>:8000" > .env
npx expo run:android
```

End-to-end check against any running backend:

```bash
VGYAN_API=http://localhost:8000 VGYAN_ADMIN_EMAIL=... VGYAN_ADMIN_PASSWORD=... python tools/e2e/api_journey.py
```

## Testing

| Suite | Command | Covers |
|---|---|---|
| Backend | `cd backend && pytest` | Auth, roles, consent gating, idempotent sync, immutability, checksums, metric verification, AI/OCR validation, exports, deletion, S3 (moto), migrations |
| App | `cd client && npm test` | Alignment (shared fixtures with the server), metrics, fluency, sync queue/backoff/lock, uploader, AI/OCR clients, content cache |
| Dashboard | `cd web && npm test` | Login, session expiry, role-based views, student detail, notes, research export |
| End-to-end | `tools/e2e/api_journey.py` | Full journey (22 checks) against a live server |
| Android | GitHub Actions `android-build.yml` | Prebuild + Gradle build of the app and the Kotlin module |

## API summary

| Method | Endpoint | Who |
|---|---|---|
| POST | `/student/register`, `/student/login` | student |
| GET/PATCH | `/student/me` · GET `/student/my_report` · GET `/student/assignments` · POST `/student/me/deletion-request` | student |
| POST | `/sync/consent`, `/sync/reading`, `/sync/writing` (multipart `record` + `file`) | student |
| POST | `/ai/reading-feedback`, `/ai/writing-assessment`, `/ocr` | student |
| POST | `/auth/staff/login` | staff |
| GET | `/teacher/me`, `/teacher/students[/{id}]`, `/teacher/analytics`, `/teacher/missed-words`, `/teacher/{reading,writing}/{id}/{audio,image}` | teacher, admin |
| GET/POST | `/teacher/comments`, `/passages`, `/assignments` | teacher, admin |
| GET | `/research/summary`, `/research/export?dataset=reading\|writing\|participants` | researcher, admin |
| * | `/admin/schools`, `/admin/classes`, `/admin/staff`, `/admin/deletion-requests` | admin |
| GET | `/health`, `/health/ready` | public |

Full interactive documentation: `/docs` on a running server.

## Known limitations

See [docs/asr-evaluation.md](docs/asr-evaluation.md) and [docs/ocr-and-ai.md](docs/ocr-and-ai.md). In short:
- **Kannada ASR** needs a Kannada model from the research team. None exists publicly.
- **ASR validity for children** has not been measured. On perfect synthetic readings, ASR alone costs 4–14 accuracy points.
- **Kannada handwriting OCR** has not been validated for any provider.
- **Background sync** depends on Android's WorkManager scheduling. The foreground triggers (app opened, network back, "Sync now") are the reliable path.
- **Compliance:** the consent, withdrawal and deletion features do not replace institutional ethics approval, the approved research protocol, or a legal review for children's data.
