# Development setup

Commands are given for **Windows PowerShell** (the team's machines) with the macOS/Linux form where it
differs. Prerequisites: Git, Docker Desktop, Python 3.12+, Node.js 22 LTS. For building Android
locally you also need JDK 17+ and the Android SDK (most people use the APKs CI builds instead).

## 1. Backend

```powershell
git clone https://github.com/VGyan-in/VGyan.git
cd VGyan
# PostgreSQL in Docker on port 5433 (one-off; later just `docker start vgyan-pg`)
docker run -d --name vgyan-pg -e POSTGRES_USER=vgyan -e POSTGRES_PASSWORD=vgyan -e POSTGRES_DB=vgyan -p 5433:5432 postgres:16-alpine

cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1            # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
Copy-Item .env.example .env              # macOS/Linux: cp .env.example .env
alembic upgrade head
python -m app.cli create-admin --email admin@example.org --name "Local Admin"   # prints a temporary password once
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for the interactive API. `GET /health/ready` shows database, storage
and migration status.

Tests use a separate database (`vgyan_test`, created automatically) on the same server:

```powershell
pytest -q
ruff check . ; ruff format --check .
```

## 2. Teacher dashboard

```powershell
cd web
npm ci
Set-Content .env.local "VITE_API_BASE_URL=http://localhost:8000"     # macOS/Linux: echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local
npm run dev                         # http://localhost:5173
npm test ; npm run lint ; npm run build
```

Sign in with the admin account, create a school, a class (note the join code) and a teacher. Without
`VITE_API_BASE_URL` the dashboard runs on bundled demo data.

## 3. Android app

Recording and speech recognition need the native module, so **Expo Go cannot run the reading flow**.
Options:

| Goal | How |
|---|---|
| Test the app | Install an APK built by GitHub Actions ([real-device-testing.md](real-device-testing.md)) |
| Develop UI quickly | `cd client; npm ci; npx expo start --web` (no recording, no SQLite: the web build uses localStorage) |
| Develop with native code | Android SDK + `cd client; npm ci; npx expo run:android` with a phone connected over USB |

```powershell
cd client
npm ci
Copy-Item .env.example .env         # then set EXPO_PUBLIC_API_BASE_URL (HTTPS) if you have a server
npm test                            # Jest
npm run typecheck ; npm run lint
```

The app blocks cleartext HTTP. To point a phone at a backend on your laptop, expose it over HTTPS, e.g.
`cloudflared tunnel --url http://localhost:8000`, and use the printed `https://…trycloudflare.com` URL
(see [USER_ACCEPTANCE_TESTING.md](USER_ACCEPTANCE_TESTING.md)).

## 4. Environment variable reference

### Backend (`backend/.env`, or platform secrets in production)

| Variable | Default | Notes |
|---|---|---|
| `ENV` | `development` | `production` enables start-up guards (secret strength, S3, explicit CORS) and HSTS |
| `DATABASE_URL` | local Docker URL | `postgres://` and `postgresql://` are normalised |
| `JWT_SECRET` | dev value | 32+ random chars in production; rotating signs everyone out |
| `JWT_ALGORITHM` | `HS256` | |
| `STUDENT_TOKEN_TTL_DAYS` / `STAFF_TOKEN_TTL_HOURS` | 30 / 12 | |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated dashboard origins; `*` refused in production |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | Used for local-storage signed links |
| `STORAGE_BACKEND` | `local` | `s3` required in production |
| `LOCAL_STORAGE_DIR` | `./var/storage` | |
| `S3_BUCKET`, `S3_ENDPOINT_URL`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | | Private bucket |
| `SIGNED_URL_TTL_SECONDS` | 300 | Media link lifetime |
| `MAX_AUDIO_MB` / `MAX_IMAGE_MB` | 30 / 12 | Per file |
| `MAX_REQUEST_MB` | 40 | Whole request, enforced while streaming |
| `GEMINI_API_KEY` | empty | Without it AI and Gemini OCR return 503; the app keeps items pending |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Stored with every generation |
| `GEMINI_TIMEOUT_SECONDS` / `GEMINI_TOTAL_BUDGET_SECONDS` | 30 / 50 | Per call / including retries |
| `OCR_PROVIDER` | `gemini` | `gemini`, `google_vision` (+ `GOOGLE_VISION_API_KEY`) or `none` |
| `CONSENT_VERSION` | `1.0` | Must match the app's `EXPO_PUBLIC_CONSENT_VERSION` |
| `ALLOW_STUDENT_REGISTRATION` | `true` | `false` = staff-created accounts only |
| `RATE_LIMIT_ENABLED` | `true` | Tests set `false` |
| `TRUSTED_PROXY_HOPS` | 0 | Proxies that append to `X-Forwarded-For`; 0 ignores the header |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | Docker entrypoint: peers whose forwarded headers Uvicorn trusts |
| `WEB_CONCURRENCY` | 2 | Uvicorn workers (rate limits apply per worker) |
| `LOG_FORMAT` | `text` | `json` for log aggregation |
| `PORT` | 8000 | Docker entrypoint |

### App (`client/.env`, baked in at build time; no secrets)

| Variable | Default | Notes |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | empty | HTTPS backend. Empty = offline-only mode (data stays on the phone) |
| `EXPO_PUBLIC_CONSENT_VERSION` | `1.0` | Changing it asks every student for consent again |
| `EXPO_PUBLIC_SYNC_MAX_RETRIES` | 8 | Automatic retries before manual retry is needed |
| `EXPO_PUBLIC_PURGE_MEDIA_AFTER_SYNC` | `false` | Delete local media after a matching server receipt |
| `EXPO_PUBLIC_SIMULATE_SYNC` | `false` | Development only |
| `EXPO_PUBLIC_ASR_MODEL_EN_URL`, `_MD5`, `_VERSION`, `_MB` | vosk-model-small-en-in-0.4 | Override only with a validated model |
| `EXPO_PUBLIC_ASR_MODEL_KN_URL`, `_MD5`, `_VERSION`, `_MB` | empty | Kannada model when one exists |

In CI these come from repository **variables** (`Settings → Secrets and variables → Actions`). The
Android workflow also accepts a one-off `api_base_url` input.

### Dashboard (`web/.env.local`)

| Variable | Notes |
|---|---|
| `VITE_API_BASE_URL` | Backend URL. Empty = demo data. In CI: repository variable for the Pages deploy |
