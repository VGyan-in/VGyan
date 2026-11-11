# Deployment

## Backend

The image (`backend/Dockerfile`) runs `alembic upgrade head`, then uvicorn as a non-root user, with a health check on `/health`. Migrations only move forward. Downgrades that would lose data refuse to run.

Any container host works (Railway, Render, Fly.io, a VM with Docker). It needs:

| Variable | Value |
|---|---|
| `ENV` | `production` (enforces the checks below) |
| `DATABASE_URL` | PostgreSQL 14+ URL (`postgres://` is accepted) |
| `JWT_SECRET` | 48+ random characters: `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `STORAGE_BACKEND` | `s3` (required in production) |
| `S3_BUCKET`, `S3_ENDPOINT_URL`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | A **private** bucket. Cloudflare R2: endpoint `https://<account>.r2.cloudflarestorage.com`, region `auto` |
| `CORS_ORIGINS` | Dashboard origin, e.g. `https://vgyan-in.github.io` |
| `PUBLIC_BASE_URL` | Public HTTPS URL of the API |
| `GEMINI_API_KEY` | Server-side only. Without it, AI and OCR answer 503 and the app keeps attempts pending |
| `OCR_PROVIDER` | `gemini` (default), `google_vision` (+ `GOOGLE_VISION_API_KEY`) or `none` |
| `CONSENT_VERSION` | Must match the app's `EXPO_PUBLIC_CONSENT_VERSION` |
| `WEB_CONCURRENCY` | Uvicorn workers (default 2) |

The rate limiter keeps state in process memory. Run one instance, or add a shared store before scaling out.

After the first deploy:

```bash
python -m app.cli create-admin --email admin@school.org --name "Admin"   # run inside the container
VGYAN_API=https://api.example.org VGYAN_ADMIN_EMAIL=... VGYAN_ADMIN_PASSWORD=... python tools/e2e/api_journey.py
```

The E2E script creates `E2E-…` records and removes them through the audited deletion workflow.

## Dashboard

`web-deploy.yml` publishes to GitHub Pages on every push to `main` that touches `web/`. Set the repository variable `VITE_API_BASE_URL` to the backend URL, and add the Pages origin to `CORS_ORIGINS`.

## Android app

`android-build.yml`:
- **Push to `main`/`feat/**`** (client changes): debug APK, uploaded as an artifact.
- **Tag `v*.*.*`, or manual run with `release`:** release APK and AAB, attached to a GitHub Release for tags.

Repository settings:

| Kind | Name | Purpose |
|---|---|---|
| Variable | `EXPO_PUBLIC_API_BASE_URL` | Backend URL baked into the app (HTTPS; cleartext is blocked) |
| Variable | `EXPO_PUBLIC_ASR_MODEL_KN_URL`, `_MD5`, `_VERSION` | Kannada speech model, once available |
| Secret | `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD` | Release signing. Without them, release builds are signed with the debug key and marked as pre-releases (fine for testing, not for the Play Store) |

Create an upload keystore once, outside the repository:

```bash
keytool -genkeypair -v -keystore vgyan-upload.jks -alias vgyan -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 vgyan-upload.jks   # → ANDROID_UPLOAD_KEYSTORE_BASE64
```

Speech models are not in the APK. Each phone downloads the English model (36 MB, MD5-verified) the first time a student opens an English reading. Do this on school Wi-Fi before a session.
