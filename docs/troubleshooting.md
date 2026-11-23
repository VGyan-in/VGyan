# Troubleshooting

## Backend

| Symptom | Likely cause | Fix |
|---|---|---|
| `connection refused` on port 5433 | Postgres container stopped / Docker Desktop not running | Start Docker Desktop, `docker start vgyan-pg` |
| Start-up error "JWT_SECRET must be…" / "Production requires STORAGE_BACKEND=s3" / "CORS_ORIGINS must list…" | `ENV=production` guards | Set the variables (setup.md §4) |
| `/health/ready` 503 with `database.ok=false` | Wrong `DATABASE_URL`, migrations not run | Check URL; `alembic upgrade head` |
| `alembic check` fails in CI | `models.py` changed without a migration | `alembic revision --autogenerate`, review, commit |
| Every login returns 429 behind a proxy | All clients share the proxy's IP | Set `TRUSTED_PROXY_HOPS` (1 for a single platform proxy) |
| Uploads fail with 413 | File > `MAX_AUDIO_MB`/`MAX_IMAGE_MB`, or request > `MAX_REQUEST_MB` | Raise the limits consistently (a 3-minute WAV is ~5.8 MB) |
| AI endpoints 503 `ai_unavailable` | No `GEMINI_API_KEY` | Set it; the app keeps feedback "pending" meanwhile |
| AI endpoints 502 `ai_failed` | Provider error, invalid output, or time budget used up | Logs show `Gemini HTTP <code>`; `ai_assessments` holds the error. Check quota and key |
| OCR 422 `no_text_found` | Blank or unreadable photo | Retake the photo or type |
| Admin page: "stored file(s) … could not be removed yet" | Storage unreachable during a deletion | Fix storage, click **Retry now** or run `python -m app.cli purge-storage` |
| `integrity-check` reports `orphanedObjects` | Files without a row (e.g. a restore from an old backup, or manual uploads) | Investigate before deleting. Recordings are research data |
| `integrity-check` reports `missingObjects` | Bucket restored from an older state, or manual deletion | Restore the objects from bucket versions/backup |

Find a request in the logs by its ID: every response has `X-Request-ID`, and the access log line ends with `rid=<id>`.

## App

| Symptom | Likely cause | Fix |
|---|---|---|
| "Recording works in the VGyan Android app only" | Running in Expo Go or on web | Install the APK or a dev build |
| "Microphone permission is needed…" | Denied permission | **Open app settings** → Permissions → Microphone → Allow |
| "Recording stopped because the app was closed or interrupted" | Home button, call or screen off during the take | Expected: read again with the app in front |
| Model download fails with a checksum error | Interrupted or proxied download | Retry on another network; the archive is discarded automatically |
| Kannada result says "pending" | No Kannada speech model exists yet | Expected. The recording is kept and synced |
| Sync details: "Server not configured yet" | Offline-only build (`-offline` APK) | Use a `-server` build |
| "Session expired. Sign in again to upload." | Token expired (30 days) or revoked | Sign out and sign in while online; items resume automatically |
| "Waiting for this student to sign in on this phone." | Shared phone, another student's records | That student signs in online once |
| "Consent withdrawn or missing: kept on this phone, not uploaded." | Consent withdrawn | Expected. Give consent again only if the guardian agrees |
| Item failed with HTTP 422 | Record rejected (e.g. source text changed) | Needs a person: send the participant ID and the message to the research team |
| Nothing uploads on mobile data | Auto-sync is Wi-Fi only | Tap **Upload now** in Profile → "Upload to research server", or connect to Wi-Fi |
| "Couldn't save this attempt on the phone" | Storage full | Free space, then **Try Again** |

## Dashboard

| Symptom | Fix |
|---|---|
| Dashboard shows demo data | `VITE_API_BASE_URL` was empty at build time |
| "Cannot reach the server" | Backend down, or the dashboard origin is missing from `CORS_ORIGINS` (browser console shows a CORS error) |
| Teacher sees no students | Teacher not linked to the class (Admin → Staff → classes), or students didn't enter the join code |
| Passage shows "Shared" instead of Edit | Seeded or another teacher's passage; ask an admin |
| Audio does not play | Signed link expired (5 min); reopen the attempt |

## CI

| Symptom | Fix |
|---|---|
| Android build: "EXPO_PUBLIC_API_BASE_URL must start with https://" | Use an HTTPS URL in the variable or the `api_base_url` input |
| Android build: "libvosk.so missing" / "VgyanSpeechModule not compiled" | The native module or its Gradle dependency was not included. Check `client/modules/vgyan-speech/android` is committed |
| Security: audit gate fails | New advisory. Upgrade, or add a dated, justified entry to `audit-exceptions.json` |
| Backend Docker job: E2E fails | Read the "API logs" step output |
