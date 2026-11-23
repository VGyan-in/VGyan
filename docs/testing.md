# Testing guide

## Automated suites

| Suite | Command | Count (2026-11-23) | Kind |
|---|---|---|---|
| Backend | `cd backend; pytest -q` | 89 | Unit + integration against a real PostgreSQL (migrations applied), local storage, fake Gemini/Vision transports, moto S3 |
| App | `cd client; npm test` | 76 | Unit tests: alignment (shared fixtures with the server), metrics, fluency, sync queue/backoff/lock, uploader (status handling, shared phone, consent, timeouts), AI/OCR clients, content cache |
| Dashboard | `cd web; npm test` | 10 | Component/integration tests with mocked `fetch`: login, session expiry, roles, student detail, notes, export, passages edit rights, admin storage-deletion alert |
| End-to-end API | `python tools/e2e/api_journey.py` | 22 checks | Real HTTP against a running server; CI runs it against the built Docker image |
| Integrity | `python -m app.cli integrity-check` | — | Database/storage cross-check (CI runs it after the E2E journey) |
| Android build | GitHub Actions `android-build.yml` | — | Prebuild + Gradle; fails if Vosk/JNA libraries (arm64-v8a, armeabi-v7a) or the speech module classes are missing from the APK |
| Security | `security.yml` | — | npm audit gate, pip-audit, gitleaks |
| Speech evaluation | `tools/asr-eval/` | 108 synthetic recordings | WER/CER/accuracy bias per condition (see asr-evaluation.md) |

## What each level means

1. **Unit tests**: one function or module, no network.
2. **Mocked integration tests**: the real API stack and database, with the external provider replaced by a fake transport (Gemini, Vision) or moto (S3). These prove our handling of provider responses, not the provider's behaviour.
3. **Real integration tests**: real provider credentials. **None have been run in this audit** (no `GEMINI_API_KEY` or Vision key was available). The E2E journey reports "SKIP AI feedback" when the server has no key.
4. **Device tests**: only on a physical phone ([real-device-testing.md](real-device-testing.md)). None performed yet.

## Coverage of the required end-to-end scenarios

| # | Scenario | Automated evidence | Still manual |
|---|---|---|---|
| 1 | Student registration | test_auth, E2E | App UI |
| 2 | Invalid class code rejected | test_auth (`invalid_class_code`) | App message |
| 3 | Consent enforcement | test_sync (428), test_ai (consent), E2E, client uploader | |
| 4 | Assignment retrieval | test_auth, test_teacher, E2E | App offline cache |
| 5 | English recording | — | **Device** |
| 6 | Kannada recording (pending transcription) | test_sync, E2E | **Device** |
| 7 | Recording upload | test_sync, E2E, client uploader | Device |
| 8 | Upload interruption and retry | client sync-queue/backoff/uploader; server idempotency tests | Device (airplane mode) |
| 9 | Duplicate upload handling | test_sync (idempotent), test_hardening (409 race) | |
| 10 | Teacher class isolation | test_teacher, E2E | Dashboard UI |
| 11 | Audio playback | test_teacher (signed URL), E2E | Dashboard player |
| 12 | Analytics accuracy | test_teacher (aggregates), E2E | Spot-check numbers |
| 13 | Research export | test_teacher, test_hardening, E2E | Open the CSV in a spreadsheet |
| 14 | Withdrawal | test_sync, client uploader, E2E | App UI |
| 15 | Data deletion | test_teacher, test_hardening (incl. storage failure), E2E + integrity check | |
| 16 | AI feedback | test_ai (mocked) | **Real key** |
| 17 | OCR | test_ai, test_hardening (mocked) | **Real key, real handwriting** |
| 18 | Offline operation | client unit tests (queue, skip states) | **Device** |
| 19 | App restart recovery | client `resetInterrupted` tests | **Device** |
| 20 | Unauthorized API access | test_auth, test_teacher, test_hardening | |

## Running everything locally

```powershell
docker start vgyan-pg
cd backend; .\.venv\Scripts\Activate.ps1; pytest -q; ruff check .; cd ..
cd client; npm test; npm run typecheck; npm run lint; cd ..
cd web; npm test; npm run lint; npm run build; cd ..
```

E2E against the Docker image (what CI does):

```powershell
docker build -t vgyan-backend:local backend
docker network create vgl
docker run -d --name vg-db --network vgl -e POSTGRES_USER=vgyan -e POSTGRES_PASSWORD=vgyan -e POSTGRES_DB=vgyan postgres:16-alpine
docker run -d --name vg-api --network vgl -p 8010:8000 -e DATABASE_URL=postgresql+psycopg://vgyan:vgyan@vg-db:5432/vgyan -e JWT_SECRET=local-test-secret-0123456789abcdefghij -e RATE_LIMIT_ENABLED=false -e PUBLIC_BASE_URL=http://localhost:8010 vgyan-backend:local
docker exec -e VGYAN_ADMIN_PASSWORD=local-admin-password-1 vg-api python -m app.cli create-admin --email admin@local.test --name "Local Admin"
$env:VGYAN_API="http://localhost:8010"; $env:VGYAN_ADMIN_EMAIL="admin@local.test"; $env:VGYAN_ADMIN_PASSWORD="local-admin-password-1"
python tools/e2e/api_journey.py
docker exec vg-api python -m app.cli integrity-check
```

(Wait a few seconds after starting `vg-db` before starting `vg-api`; if the API exits, run `docker start vg-api`.)

## Gaps

- No React Native component or UI tests, and no instrumented Android tests (no emulator or device in this environment). The app's sync ordering in `app-store.tsx` is covered only indirectly.
- No load tests. The teacher endpoints are expected to be fine for a pilot (tens of classes); measure before scaling.
- Kotlin module: compiled in CI, never run on hardware.
