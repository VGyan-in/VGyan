# VGyan student app (client)

Expo + Expo Router app for the bilingual (English / Kannada) reading and writing assessment pilot. For the project overview, see the [root README](../README.md).

## Run it

```bash
npm install
cp .env.example .env     # optional; defaults work without a server
npm run web              # quickest: opens in the browser
npm start                # then scan the QR code with Expo Go on Android
```

Expo Go is enough for everything in this build. Real on-device speech recognition (Vosk) will need a development build (`npx expo run:android`).

## Check it

```bash
npm run typecheck        # Generates typed routes and validates TypeScript
npm run lint             # ESLint (Expo flat config)
npm test                 # Jest: reading analyzer, writing metrics, sync queue, backoff
npm run test:ci          # Jest with coverage and GitHub Actions annotations
npm run export:web       # Verifies web bundle exports cleanly
```

## How it works

| Area | Where | Notes |
|---|---|---|
| Screens | `src/app/` | Expo Router routes. `reading/` and `writing/` are the assessment flows. |
| App state | `src/state/app-store.tsx` | Signed-in student, consent, attempts, sync. Writes to storage first, then updates the UI. |
| Storage | `src/core/db/` | SQLite on Android/iOS (`repository.ts`), localStorage on web (`repository.web.ts`, for dev only). Schema migrations use `PRAGMA user_version`. |
| Media files | `src/core/storage/files.ts` | Recordings and photos are copied to `{documents}/{recordings or images}/{participantId}/{sessionId}/{attemptId}.*`. Paths use participant IDs, never names. |
| Sync | `src/core/sync/` | Outbox queue: `pending → uploading → synced` or `failed`. Exponential backoff (30 s base, 1 h cap). 4xx errors are permanent; network and 5xx errors retry. Runs on reconnect, app foreground, every 3 min, and on "Upload now". Auto-sync uses Wi-Fi only. |
| Reading analysis | `src/features/reading/analyzer.ts` | Word alignment (correct, substitution, omission, insertion), accuracy, WPM/WCPM, pace, and practice words. Pure TypeScript, unit-tested. |
| Writing metrics | `src/features/writing/metrics.ts` | Word and sentence counts (the danda counts as a sentence end), vocabulary ratio. |

### Accounts on shared phones

Several students can use one phone. Each student registers once, gets a participant ID, and signs in with it (or their email) and a password. The password is stored only as a salted hash on the phone. Signing out keeps a student's saved work.

### Consent

Assessments are locked until consent matching `EXPO_PUBLIC_CONSENT_VERSION` is recorded. Raising the version asks everyone again. Consent can be withdrawn from Profile, and a student's data can be deleted from the phone there too. Both actions are synced as consent records.

## Stand-ins until the backend and models exist

Each stand-in is a single function, so the screens won't change when the real one is connected.

| Stand-in | File | Replace with |
|---|---|---|
| Speech recognition | `src/features/reading/asr.ts` | Vosk (`react-native-vosk`) with the TDNN models. Return `words` (word, start, end, conf) and pause/repetition metrics are filled in automatically (`src/features/reading/fluency.ts`) |

OCR, AI feedback and accounts already call the backend once `EXPO_PUBLIC_API_BASE_URL` is set; without it they use local sample/rule-based output and on-device accounts. With a server set, a failed OCR/AI call marks the attempt `failed` and it is retried on the next sync. Creating an account needs a connection (the server must know the student or uploads are rejected); signing in falls back to the on-device copy when offline, and the token lives in `expo-secure-store`.

| Endpoint | Request | Response |
|---|---|---|
| `POST /student/register` | JSON: `student_id` (participant ID), `fullName`, `email`, `password` | any 2xx; 409 = ID already taken |
| `POST /student/login` | JSON: `student_id`, `password` | `{ access_token, token_type }`; 401 = wrong password, 404 = unknown ID |
| `POST /ocr` | multipart: `file` (original photo), `language` (`en`/`kn`) | `{ text, confidence, engine_version }` |
| `POST /ai/reading-feedback` | JSON: `language`, `reference_text`, `transcript`, `metrics { accuracy, wpm, pace, omissions, practice_words }` | `{ summary, working_well[], needs_improvement[], suggestions[], practice_words[], model_version, prompt_version }` |
| `POST /ai/writing-assessment` | JSON: `language`, `text`, `min_words`, `metrics { word_count, sentence_count }` | the reading fields plus `corrected, grammar_score, vocabulary_score, spelling_score` (0–100), `score` (0–10), `misspelled[]` |

Response keys follow the structured-output schema of the Gemini prompts in the client's StudentSkillManager app, so those prompts can move to the backend as-is. Reading `practice_words` are filtered to words that appear in the passage.

With no `EXPO_PUBLIC_API_BASE_URL` set, uploads wait in the queue and nothing is lost. Once the URL is set, the uploader sends multipart `record` (JSON) and `file` fields to `/sync/reading`, `/sync/writing` and `/sync/consent`. The backend must upsert on the record ID; 2xx and 409 both count as received.

## Configuration

See `.env.example`. Only `EXPO_PUBLIC_*` values reach the app; never put secrets there.
