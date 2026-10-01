# AI-Based Bilingual Reading & Writing Assessment: Mobile App

React Native (TypeScript) Android app for assessing school students' **reading fluency** and **writing proficiency** in **English and Kannada**. It works offline for reading and ASR, preserves the full research data chain (original input → processed → assessed), and syncs to a FastAPI backend when connectivity returns.

> Part of a three-component system: **mobile app (this repo)**, `backend/` (FastAPI + PostgreSQL + object storage), `teacher-dashboard/` (React). Requirements: see the SRS v1.0 and the Execution & Implementation Plan.

---

## Table of Contents

1. [Features](#1-features)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Project Structure](#4-project-structure)
5. [Getting Started](#5-getting-started)
6. [Configuration](#6-configuration)
7. [Screens & Navigation](#7-screens--navigation)
8. [Local Database Schema](#8-local-database-schema)
9. [Offline Sync Design](#9-offline-sync-design)
10. [Backend API Used by the App](#10-backend-api-used-by-the-app)
11. [Reading Analysis Module](#11-reading-analysis-module)
12. [Security & Privacy](#12-security--privacy)
13. [Testing](#13-testing)
14. [Scripts](#14-scripts)
15. [Conventions](#15-conventions)
16. [Roadmap](#16-roadmap)
17. [Known Risks](#17-known-risks)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. Features

| Area | Capability |
|---|---|
| Consent | First-launch research consent (versioned, English + Kannada). Assessments are blocked until consent is recorded |
| Accounts | Student registration and login; a **Participant ID** is generated and used for all research data |
| Reading | Language and level selection (Easy / Medium / Advanced), passage display, 16 kHz mono WAV recording, **on-device Vosk + TDNN ASR** (no internet needed) |
| Reading analysis | Word alignment against the reference: correct, substitution, omission, insertion; accuracy, WPM, pace, mistakes, practice words |
| Writing | Typed text, camera capture, or gallery upload; crop/adjust; OCR for handwriting; **student correction of OCR text**; word and sentence counts |
| AI feedback | Gemini-generated structured feedback for reading and writing, with model and prompt versions recorded |
| Progress | In-app trends: accuracy, WPM, errors, practice words, grammar, spelling, vocabulary |
| Offline | Local SQLite storage and a sync queue with retry; no silent data loss |
| Research | Original audio and original writing image are always retained; OCR output and student correction are stored separately |

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Framework | React Native (**bare workflow** or Expo dev build; Expo Go cannot load native modules), TypeScript |
| Navigation | React Navigation (native stack + bottom tabs) |
| State | Zustand (app/UI state); repositories over SQLite for persisted data |
| HTTP | Axios with JWT interceptor |
| Local DB | SQLite via `@op-engineering/op-sqlite` (plain SQL migrations) |
| Files | `react-native-fs` (recordings, images) |
| ASR | `react-native-vosk` + Vosk/Kaldi TDNN chain models (English, Kannada) |
| Audio | `react-native-audio-record` (16 kHz, mono, 16-bit WAV) |
| Camera / crop | `react-native-image-crop-picker` (camera, gallery, crop) |
| Connectivity | `@react-native-community/netinfo` |
| Background sync | `react-native-background-fetch` (headless task) plus foreground NetInfo trigger |
| Secure storage | `react-native-keychain` (JWT) |
| Validation | `zod` (API payloads, AI responses) |
| i18n | `i18next` + `react-i18next` (en, kn) |
| Charts | `react-native-gifted-charts` + `react-native-svg` |
| Config | `react-native-config` (`.env`) |
| Testing | Jest, React Native Testing Library, Detox (optional E2E) |
| Quality | ESLint, Prettier, `tsc --noEmit`, GitHub Actions |

> Pin exact versions in `package.json` at install time and re-verify native-module compatibility with your React Native version.

## 3. Architecture

```
┌──────────────────────────── React Native App ────────────────────────────┐
│                                                                          │
│  UI (screens/components)                                                 │
│        │                                                                 │
│  Feature pipelines ─────────────────────────────────────────────┐        │
│   • readingPipeline: record → ASR → analyse → metrics           │        │
│   • writingPipeline: input → (OCR) → correct → metrics          │        │
│        │                                                        │        │
│  Repositories (SQLite) ◄── single source of truth on device     │        │
│        │                                                        ▼        │
│  Sync queue ──► Sync worker ──► API client ──► FastAPI backend           │
│                                                  ├─ AI proxy (Gemini)    │
│                                                  ├─ OCR proxy            │
│                                                  ├─ PostgreSQL           │
│                                                  └─ Object storage       │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Reading flow

```
Select language/level → Show passage → Record (16 kHz mono WAV, saved to disk)
   → Vosk ASR (offline) → transcript + timestamps + confidence
   → Align with reference → accuracy / WPM / pace / errors / practice words
   → Save attempt to SQLite (ai_status = pending) → show metrics immediately
   → [online] request AI feedback → validate → save → queue sync (audio + record)
```

### 3.2 Writing flow

```
Prompt → Type | Camera | Gallery
   typed: text ───────────────────────────────┐
   image: save ORIGINAL image → crop → OCR ───┤
          → show OCR text → student corrects ─┘
   → word/sentence counts → save attempt (original OCR + corrected text kept separately)
   → [online] AI assessment → validate → save → queue sync (record + original image)
```

### 3.3 Design decisions to confirm with the mentor

1. **AI and OCR calls go through the backend** (`/ai/*`, `/ocr`), not directly from the app. API keys then never ship inside the APK. The backend owns the prompts and returns `model_version` and `prompt_version`. If the team prefers direct calls, only `src/core/ai/` and the OCR service change.
2. **Metrics are deterministic and computed on-device.** Gemini receives the metrics and produces qualitative feedback only; it never recomputes accuracy or WPM.
3. **Offline behaviour:** reading, ASR, and metrics work with no network. AI feedback needs connectivity, so it is marked `pending` and fetched when online.

## 4. Project Structure

```
VGyan/
├── README.md                          # monorepo overview (links to the 3 apps)
│
├── client/                            # Expo + Expo Router (student mobile app)
│   ├── app.json                       # + package name, mic/camera permissions, plugins
│   ├── eas.json                       # NEW (optional): EAS build profiles for APK
│   ├── tailwind.config.js             # NativeWind (if you're using it)
│   ├── .env.example                   # NEW: EXPO_PUBLIC_API_BASE_URL, CONSENT_VERSION
│   ├── assets/                        # fonts (+ a Kannada font), icons, images
│   ├── models/                        # NEW: Vosk en/ and kn/ (git-ignored)
│   ├── scripts/                       # NEW: copy-vosk-models.sh
│   ├── __tests__/                     # NEW: reading/ writing/ sync/ db/
│   └── src/
│       ├── global.css
│       │
│       ├── app/                       # ROUTES ONLY: each file renders a feature screen
│       │   ├── _layout.tsx            # providers, DB init, sync bootstrap, consent gate
│       │   ├── index.tsx              # splash → redirect
│       │   ├── consent.tsx
│       │   ├── (auth)/
│       │   │   ├── _layout.tsx
│       │   │   ├── login.tsx
│       │   │   └── register.tsx
│       │   ├── (tabs)/
│       │   │   ├── _layout.tsx
│       │   │   ├── index.tsx          # Home
│       │   │   ├── progress.tsx
│       │   │   └── profile.tsx
│       │   ├── reading/
│       │   │   ├── _layout.tsx
│       │   │   ├── language.tsx
│       │   │   ├── level.tsx          # Easy / Medium / Advanced
│       │   │   ├── passage.tsx
│       │   │   ├── recording.tsx
│       │   │   ├── processing.tsx
│       │   │   └── result.tsx
│       │   ├── writing/
│       │   │   ├── _layout.tsx
│       │   │   ├── prompt.tsx
│       │   │   ├── input.tsx          # type / camera / gallery
│       │   │   ├── type.tsx
│       │   │   ├── preview.tsx        # crop / adjust
│       │   │   ├── ocr-correction.tsx
│       │   │   └── result.tsx
│       │   └── +not-found.tsx
│       │
│       ├── features/                  # NEW: all screen UI and logic
│       │   ├── auth/                  # screens/, services/authService.ts, store/authStore.ts, schemas.ts
│       │   ├── consent/               # ConsentScreen, consentText.ts (en/kn, versioned), consentService.ts
│       │   ├── reading/
│       │   │   ├── screens/
│       │   │   ├── components/        # PassageView, RecorderControls, WordDiffView, MetricCard
│       │   │   ├── hooks/             # useRecorder, useReadingSession
│       │   │   ├── services/
│       │   │   │   ├── audioRecorder.ts     # 16 kHz mono WAV
│       │   │   │   ├── asrService.ts        # Vosk wrapper
│       │   │   │   ├── readingAnalyzer.ts   # word alignment (pure TS)
│       │   │   │   ├── readingMetrics.ts    # accuracy, WPM, pace
│       │   │   │   ├── practiceWords.ts
│       │   │   │   └── readingPipeline.ts
│       │   │   └── types.ts
│       │   ├── writing/
│       │   │   ├── screens/  components/  hooks/
│       │   │   ├── services/          # imageService, ocrService, writingMetrics, writingPipeline
│       │   │   └── types.ts
│       │   ├── progress/              # screens + progressService.ts (trends from SQLite)
│       │   └── profile/
│       │
│       ├── core/                      # NEW: shared infrastructure
│       │   ├── api/                   # client.ts (axios + JWT), endpoints.ts, errors.ts
│       │   ├── ai/                    # aiClient.ts, schemas.ts (zod)
│       │   ├── db/                    # database.ts, migrations/, repositories/
│       │   ├── sync/                  # syncQueue, syncWorker, backoff, uploaders/
│       │   ├── storage/               # fileStore.ts, secureStore.ts
│       │   ├── config/                # env.ts
│       │   ├── i18n/                  # index.ts, locales/en.json, kn.json
│       │   └── utils/                 # ids.ts (UUID), text.ts (normalisation), time.ts
│       │
│       ├── components/                # existing: shared UI (Button, Card, Screen, ...)
│       ├── constants/                 # existing: levels, languages, colors
│       └── hooks/                     # existing: useNetwork, useAppState, ...
│
├── backend/                           # FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── api/                       # auth, student, reading, writing, teacher, research, ai, ocr
│   │   ├── models/                    # student, reading, writing, session, comment, consent
│   │   ├── schemas/                   # Pydantic
│   │   ├── services/                  # gemini.py, ocr.py, storage.py, analytics.py, export.py
│   │   ├── core/                      # auth.py (JWT), security.py, config.py
│   │   └── db/                        # database.py, migrations/ (Alembic)
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
│
└── teacher-dashboard/                 # React + TypeScript + Tailwind
    └── src/
        ├── pages/                     # Login, Dashboard, Students, StudentDetail, AssessmentDetail
        ├── components/                # StatCard, StudentTable, charts/, CommentBox
        ├── api/                       # axios client + endpoint functions
        ├── hooks/
        └── types/
```

## 5. Getting Started

### 5.1 Prerequisites

- Node.js (current LTS) and npm or yarn
- JDK 17
- Android Studio with Android SDK and an emulator
- **A physical Android device is strongly recommended.** You need a real microphone, and ASR performance must be checked on a low-end phone

### 5.2 Bootstrapping a new project (first time only)

```bash
npx @react-native-community/cli@latest init AssessmentApp
cd AssessmentApp
# then create the folder layout from section 4 under src/
```

### 5.3 Install and run

```bash
git clone <repo-url> assessment-app
cd assessment-app
npm install
cp .env.example .env          # set API_BASE_URL
npm run models:copy           # after placing Vosk models in ./models
npm run android               # build and run on a connected device/emulator
```

### 5.4 ASR models

Vosk models are large and are **not committed**. Distribute them via Git LFS, a private release asset, or object storage.

```
models/
├── en/   # Vosk/Kaldi English TDNN chain model (am/, conf/, graph/, ivector/)
└── kn/   # Kannada TDNN chain model + 3-gram LM
```

1. Place the unpacked model folders under `models/`.
2. Run `npm run models:copy`. This puts them where `react-native-vosk` loads models from (check that library's README for the exact Android path and loading call).
3. The first launch may copy or unpack models to internal storage. Show a one-time "Preparing speech engine" screen.

### 5.5 Release build

```bash
cd android
./gradlew assembleRelease      # APK
./gradlew bundleRelease        # AAB for Play Store
```

Configure signing in `android/app/build.gradle` using a keystore **kept outside the repo**.

## 6. Configuration

`.env.example`

```
API_BASE_URL=https://api.example.org
APP_ENV=development            # development | staging | production
CONSENT_VERSION=1.0
SYNC_MAX_RETRIES=8
```

No secrets live in the app. Gemini and OCR credentials exist only on the backend.

## 7. Screens & Navigation

| Flow | Screens |
|---|---|
| Startup | Splash → (no valid consent) Consent → Login / Register → Home |
| Auth | Login, Register |
| Main tabs | Home, Progress, Profile |
| Reading | LanguageSelect → LevelSelect → Passage → Recording → Processing → ReadingResult |
| Writing | WritingPrompt → InputChoice → (TypeWriting \| ImagePreview → OcrCorrection) → WritingResult |
| Progress | ReadingProgress, WritingProgress |

**Consent gate:** `RootNavigator` checks for a local consent record matching `CONSENT_VERSION`. If none exists, every assessment route is unreachable.

## 8. Local Database Schema

SQLite is the on-device source of truth. Key tables:

| Table | Key columns |
|---|---|
| `consent_records` | id, participant_id, consent_version, language, accepted_at, synced |
| `profile` | student_id, participant_id, name, class, section, age_group, gender, school_type, medium, native_language, other_languages, reading_proficiency |
| `sessions` | session_id, participant_id, app_version, device_info, started_at, ended_at, synced |
| `assignments` | assignment_id, type (reading/writing), language, level, title, text, updated_at (cached for offline use) |
| `reading_attempts` | attempt_id (UUID, PK), session_id, assignment_id, language, level, reference_text, audio_path, audio_duration_ms, transcript, asr_confidence, asr_model_version, accuracy, wpm, pace, mistakes, substitutions, omissions, insertions, practice_words (JSON), ai_status, ai_feedback (JSON), gemini_model_version, gemini_prompt_version, created_at |
| `writing_attempts` | attempt_id (UUID, PK), session_id, assignment_id, language, input_method, image_path, original_ocr, ocr_confidence, corrected_text, word_count, sentence_count, metrics (JSON), ai_status, ai_feedback (JSON), gemini_model_version, gemini_prompt_version, created_at |
| `sync_queue` | id, entity_type, entity_id, status, attempts, last_error, next_retry_at, created_at, updated_at |

- `ai_status`: `pending` → `done` \| `failed`
- Files on disk use participant IDs, **never names**: `recordings/{participant_id}/{session_id}/{attempt_id}.wav`, `images/{participant_id}/{session_id}/{attempt_id}.jpg`
- `original_ocr` and `corrected_text` are separate columns and are never overwritten.

## 9. Offline Sync Design

**States:** `pending → uploading → synced` (or `failed`).

**Triggers:** app returns to foreground, NetInfo reports connectivity, periodic background fetch, manual "Sync now".

**Algorithm**

1. Claim the oldest `pending` (or retry-due `failed`) item and mark it `uploading`.
2. Build a multipart request (record fields + audio or original image) and POST to `/sync/reading` or `/sync/writing`.
3. Outcome handling:
   - **2xx** or **409 duplicate** → mark `synced`.
   - **Network error / 5xx** → back to `failed`, set `next_retry_at` using exponential backoff with jitter (suggested: 30 s base, ×2, cap 1 h).
   - **4xx validation error** → mark `failed` permanently, store `last_error`, surface it in a debug screen.
4. Stop after `SYNC_MAX_RETRIES` and wait for a manual retry.

**Rules**

- `attempt_id` is a client-generated UUID. The backend must **upsert on `attempt_id`** so retries never create duplicates.
- Local audio and images are kept until the server confirms receipt, then purged (configurable).
- Interrupted `uploading` items are reset to `pending` on app start.
- Android may delay or kill background work on aggressive battery managers; the foreground triggers above are the reliable path.

## 10. Backend API Used by the App

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/student/register` | Register; returns `participant_id` |
| POST | `/student/login` | Authenticate; returns JWT |
| GET | `/student/my_report?student_id=` | History for progress screens |
| POST | `/sync/reading` | Reading record + audio (multipart) |
| POST | `/sync/writing` | Writing record + original image (multipart) |
| POST | `/ai/reading-feedback` | Metrics + transcript → structured feedback + versions *(proposed)* |
| POST | `/ai/writing-assessment` | Corrected text → structured assessment + versions *(proposed)* |
| POST | `/ocr` | Image → OCR text + confidence *(proposed)* |

Entries marked *(proposed)* extend the SRS endpoints to keep API keys off the device (see 3.3).

## 11. Reading Analysis Module

Pure TypeScript, no native dependencies, fully unit-tested. This is the research-critical core.

1. **Normalise** both texts: Unicode NFC, lowercase (English), strip punctuation, collapse whitespace; for Kannada, handle ZWJ/ZWNJ consistently.
2. **Align** reference words and transcript words with a word-level edit-distance alignment and backtrace.
3. **Classify** each position: `correct`, `substitution`, `omission`, `insertion`.
4. **Compute** accuracy, WPM, and pace exactly as defined in the SRS; keep each formula in one function in `readingMetrics.ts`, with the SRS section referenced in a comment.
5. **Select practice words** from substituted and omitted words.

Test with fixtures such as:

```
Reference: The boy went to school.
ASR:       The boy go to school.
→ 1 substitution (went → go), 4 correct
```

## 12. Security & Privacy

- JWT stored in Keychain, never in AsyncStorage; HTTPS only (block cleartext in the Android network security config).
- No API keys in the bundle; AI and OCR go through the backend.
- Participant ID, not the student name, appears in file paths, logs, and research payloads.
- No analytics SDKs or third-party tracking. Collect only the metadata the SRS specifies.
- Disable verbose logging in release builds; never log transcripts, names, or tokens.
- This app handles **children's data**. Before pilot use, confirm parental/guardian consent, ethics approval, consent logging, and a withdrawal/deletion flow with the supervising team.

## 13. Testing

| Level | What | Tool |
|---|---|---|
| Unit | Alignment, metrics, practice words, backoff, text normalisation | Jest |
| Repository | Migrations, CRUD, sync queue state transitions | Jest + in-memory SQLite |
| Component | Result screens, OCR editor, consent gate | RN Testing Library |
| Integration | Pipelines with mocked ASR/API | Jest |
| E2E | Consent → reading → offline → sync | Detox (optional) |
| Device | ASR latency (target: 3 s or less for up to 500 words), Kannada rendering, offline airplane-mode test | Manual, on a low-end Android phone |

## 14. Scripts

```json
{
  "scripts": {
    "start": "react-native start",
    "android": "react-native run-android",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "models:copy": "bash scripts/copy-vosk-models.sh",
    "build:apk": "cd android && ./gradlew assembleRelease",
    "build:aab": "cd android && ./gradlew bundleRelease"
  }
}
```

## 15. Conventions

- **Branches:** `main` (stable), `develop`, `feature/<area>-<short-name>`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`)
- **Code:** strict TypeScript, no `any` in `core/` and pipelines; feature folders own their screens, services, and types
- **Rule:** UI code never touches SQLite or the network directly; screens call hooks → services → repositories
- **CI (GitHub Actions):** lint, typecheck, unit tests, debug APK build on every PR

## 16. Roadmap

| Milestone | Scope | Outcome |
|---|---|---|
| M1: Reading MVP | Project setup, recording, Vosk/TDNN, alignment, metrics, result screen | Working reading assessment on device |
| M2: AI + Writing | AI feedback, typed and handwritten writing, OCR correction, writing assessment | Complete student-side assessment |
| M3: Backend + Dashboard | Sync APIs, storage, progress screens, teacher dashboard integration | End-to-end data flow |
| M4: Research + Production | Offline sync hardening, Participant IDs, version tracking, exports, security, testing, release | Pilot-ready build |

## 17. Known Risks

1. **Vosk on React Native.** Confirm `react-native-vosk` can load your custom English and Kannada TDNN models and return word timestamps and confidence. If not, write a thin native Kotlin module around Vosk.
2. **Kannada handwriting OCR.** The planned OCR provider may not support Kannada; evaluate alternatives or restrict Kannada writing to typed input.
3. **Background sync reliability** on battery-restricted devices; test early.
4. **ASR validity for children's speech.** Define measurable targets (word error rate, agreement with human raters) before relying on the metrics for research.
5. **Model size and APK size.** Large models may require download-on-first-run rather than bundling.

## 18. Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| Vosk module not found | Running in Expo Go; use a dev build or the bare workflow and rebuild native code |
| Recording is silent or fails | Microphone permission not granted; check runtime permission flow |
| Model fails to load | Wrong folder structure or path; re-run `models:copy` and verify the model directory layout |
| Kannada text renders as boxes | Missing font on the device; bundle a Kannada font and set it in the theme |
| Sync stuck at `uploading` | App was killed mid-upload; items reset to `pending` on next start (check `syncQueueRepo.recover()`) |
| Cleartext traffic error | Backend served over HTTP; use HTTPS (do not enable cleartext in release) |

---

*Draft for review. Library choices and versions should be verified at implementation time.*