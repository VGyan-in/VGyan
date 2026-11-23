# User acceptance testing (before merging `audit/product-hardening-2026`)

This guide is for a tester who does not know the codebase. It takes about half a day: one hour of
setup, then the checklists. Commands are for **Windows PowerShell**. Never use a real child's data:
use made-up names and adult testers' voices.

Each checklist row says what to open, what to do, what you should see, what counts as a failure, and
whether a physical Android phone is needed (**Phone**) or a computer is enough (**PC**). Write the
result (pass/fail + note) in the last column of a copy of this file.

---

## 1. One-time setup

### 1.1 Tools

| Tool | Install |
|---|---|
| Git, GitHub CLI | `winget install Git.Git GitHub.cli` then `gh auth login` |
| Docker Desktop | https://www.docker.com/products/docker-desktop (start it before testing) |
| Python 3.12+ | `winget install Python.Python.3.12` |
| Node.js 22 | `winget install OpenJS.NodeJS.LTS` |
| Android platform-tools (adb) | `winget install Google.PlatformTools` |
| cloudflared (HTTPS tunnel for the phone) | `winget install Cloudflare.cloudflared` |

### 1.2 Get the code

```powershell
git clone https://github.com/VGyan-in/VGyan.git      # skip if you already have it
cd VGyan
git fetch origin
git checkout audit/product-hardening-2026
git pull
```

### 1.3 Database and backend (terminal 1)

```powershell
docker run -d --name vgyan-pg -e POSTGRES_USER=vgyan -e POSTGRES_PASSWORD=vgyan -e POSTGRES_DB=vgyan -p 5433:5432 postgres:16-alpine
#   (if it already exists: docker start vgyan-pg)
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
alembic upgrade head                          # should end at revision 0004
python -m app.cli create-admin --email admin@test.local --name "UAT Admin"
#   -> note the temporary password it prints
uvicorn app.main:app --port 8000
```

Check: open http://localhost:8000/health/ready. Expect `"status":"ok"` and `"migration":"0004"`.
To test AI feedback and OCR, add `GEMINI_API_KEY=<your key>` to `backend\.env` and restart uvicorn
(without it those features show "pending", which is also a valid test).

### 1.4 Dashboard (terminal 2)

```powershell
cd web
npm ci
Set-Content .env.local "VITE_API_BASE_URL=http://localhost:8000"
npm run dev                                   # open http://localhost:5173
```

### 1.5 Seed test accounts (in the dashboard)

1. Sign in as `admin@test.local` with the temporary password.
2. Admin → **Add school** "UAT School". **Add class**: grade 4, section A. Add another: grade 5, section B. Note both **join codes**.
3. Admin → Staff: create `teacher.a@test.local` (role teacher, class 4A) and `teacher.b@test.local` (teacher, class 5B), and `researcher@test.local` (researcher). Passwords: 10+ characters.

### 1.6 Android build that talks to your laptop (terminal 3)

The app only talks to HTTPS servers. A Cloudflare quick tunnel gives your laptop a temporary HTTPS URL:

```powershell
cloudflared tunnel --url http://localhost:8000
#   -> copy the https://<random>.trycloudflare.com URL it prints; keep this window open
```

Build an APK with that URL (about 15 minutes on GitHub):

```powershell
gh workflow run android-build.yml --ref audit/product-hardening-2026 -f build_type=release -f api_base_url=https://<random>.trycloudflare.com
gh run list --workflow android-build.yml --branch audit/product-hardening-2026 --limit 3
gh run watch <run-id>
gh run download <run-id> --dir apk
```

The quick-tunnel URL changes every time cloudflared restarts. If it does, build again.
For tests that do not need a server, use the **offline** APK from the PR description (file name ends `-offline.apk`).

### 1.7 Install on the phone

1. On the phone: Settings → About phone → tap *Build number* 7 times → Developer options → enable **USB debugging**. Connect by USB and accept the prompt.
2. ```powershell
   adb devices                                   # phone listed as "device"
   adb install -r (Get-ChildItem apk -Recurse -Filter *.apk | Select-Object -First 1).FullName
   ```
3. To install a different build over it with a different signing key, first `adb uninstall com.vgyan.app` (this erases the app's data).

### 1.8 Logs

```powershell
# backend: terminal 1 shows one line per request, ending rid=<request id>
adb logcat --pid=(adb shell pidof com.vgyan.app)  # app logs while it runs
docker logs vgyan-pg --tail 50                    # database
```

### 1.9 Automated tests (run once before manual testing)

```powershell
cd backend; .\.venv\Scripts\Activate.ps1; pytest -q; cd ..                 # expect 89 passed
cd client; npm ci; npm test; cd ..                                          # expect 76 passed
cd web; npm test; cd ..                                                     # expect 10 passed
# End-to-end API journey against your running backend (creates and then deletes E2E-* records):
$env:VGYAN_API="http://localhost:8000"; $env:VGYAN_ADMIN_EMAIL="admin@test.local"; $env:VGYAN_ADMIN_PASSWORD="<temporary password>"
backend\.venv\Scripts\python tools\e2e\api_journey.py                       # expect 22/22 (AI step SKIP without a key)
cd backend; python -m app.cli integrity-check; cd ..                        # expect "ok": true
```

If the journey fails with 429 errors, set `RATE_LIMIT_ENABLED=false` in `backend\.env`, restart uvicorn, and run it again.

---

## 2. Checklists

### A. Student application

| # | Open | Do | Expected | Failure | Needs | Result |
|---|---|---|---|---|---|---|
| A1 | App first launch | Tap register; name "Test Student One", password `test123`, class code from 4A | Registered; consent screen appears | Error with a valid code | Phone | |
| A2 | Register screen | Use class code `ZZZZZZ` | "Class code not found. Check it with your teacher." | Account created anyway | Phone | |
| A3 | Consent | Fill guardian name/relation, tick audio, handwriting, research; accept | Profile setup screen, then home | Can skip consent | Phone | |
| A4 | Profile setup | Fill grade and school | Home screen with reading and writing | Loops back | Phone | |
| A5 | Home → Reading → English → Easy | Open the passage | Passage text readable, large enough | Clipped text | Phone | |
| A6 | Recording screen | First time: tap **Download speech model** on Wi-Fi | Progress to 100%, then ready | Stuck, checksum error | Phone | |
| A7 | Recording | Tap mic, read the passage aloud clearly, tap **I'm Done** | "Checking your reading" steps, then result with "Reading accuracy (automatic estimate)", words coloured | Crash, empty transcript | Phone | |
| A8 | Result | Read the note under the score | "The speech checker can mishear words…" | Missing | Phone | |
| A9 | Recording | Tap mic, press Home, come back | "Recording stopped because the app was closed or interrupted" and no attempt saved | A saved attempt with no speech | Phone | |
| A10 | Recording | Tap mic, stop after 1 second | "That was too short" | Attempt saved | Phone | |
| A11 | Recording | Deny microphone permission twice | Red notice plus **Open app settings**, which opens the app's settings | No way forward | Phone | |
| A12 | Progress | Open My Progress | Averages exclude pending items; label "Text recognition confidence" (not "Handwriting clarity") | Pending items counted as 0% | Phone | |
| A13 | Writing → typed | Write 3 sentences, submit | Saved; feedback pending (no key) or shown (key) | Crash; text lost | Phone | |
| A14 | Profile | Check "Upload to research server" | Counts of waiting items; **Upload now** works | Items stuck "uploading" | Phone | |
| A15 | Sign out, sign in | Sign out, then sign in with the participant ID and password | Same data visible | Data missing | Phone | |
| A16 | New phone simulation | `adb uninstall com.vgyan.app`, reinstall, sign in online | Name and profile restored from the server (not the participant ID as the name) | Name shows as "VG-…" and profile empty | Phone | |

### B. Teacher dashboard

| # | Open | Do | Expected | Failure | Needs | Result |
|---|---|---|---|---|---|---|
| B1 | http://localhost:5173 | Sign in as teacher A | Class 4A overview | Sees class 5B | PC | |
| B2 | Students | Open Test Student One | Attempts with transcript, word errors, consent "active" | Another class's student | PC | |
| B3 | Student detail | Play the recording | Your own voice; plays fully | Silence, error, wrong recording | PC (+ phone data) | |
| B4 | Second student | Register a student on the phone with the 5B code and record | Teacher A does **not** see them; teacher B does | Teacher A sees them | Phone + PC | |
| B5 | Passages | Look at the seeded passages | "Shared" instead of Edit | Edit button on P-EN-E1 | PC | |
| B6 | Passages | Create a passage, edit it, assign it to 4A | Version 2 after edit; student sees it in the app after sync | Error | PC (+ phone) | |
| B7 | At-risk card | Read the explanation | Mentions automatic speech recognition under-counting and listening to the recording | Missing | PC | |
| B8 | Notes | Add a note on a student | Appears with your name | Error | PC | |
| B9 | Analytics | Compare counts with what you recorded | Reading/writing counts match; pending Kannada readings counted as "awaiting transcription", not in averages | Wrong counts | PC | |
| B10 | Session expiry | Close the tab, reopen | Login required | Still signed in | PC | |

### C. Backend

| # | Open | Do | Expected | Failure | Needs | Result |
|---|---|---|---|---|---|---|
| C1 | http://localhost:8000/health/ready | Load | `ok`, migration `0004` | `degraded` | PC | |
| C2 | Terminal 1 | Look at log lines during use | Method, route template, status, ms, `rid=`; no names, no passwords | Names or tokens in logs | PC | |
| C3 | PowerShell | `curl.exe -s -o NUL -w "%{http_code}" http://localhost:8000/teacher/students` | `401` | `200` | PC | |
| C4 | PowerShell | `curl.exe -s -X POST http://localhost:8000/student/login -H "Content-Type: application/json" -d '{\"student_id\":\"nobody\",\"password\":\"x\"}'` repeated 11 times quickly (with rate limiting on) | Later calls return `429` | Never limited | PC | |
| C5 | Terminal | `python -m app.cli integrity-check` (in `backend`, venv active) | `"ok": true` | Any problem listed | PC | |

### D. Speech recognition

| # | Open | Do | Expected | Failure | Needs | Result |
|---|---|---|---|---|---|---|
| D1 | Reading, English Easy | Read perfectly in a quiet room; note the accuracy | Usually 75–100%; write the number down | < 60% when read perfectly | Phone | |
| D2 | Same | Read with a fan or TV on | Lower accuracy (expected); no crash | Crash | Phone | |
| D3 | Same | Skip one word, say a wrong word for another | Both shown as mistakes | Not detected | Phone | |
| D4 | Same | Time from **I'm Done** to the result | Note the seconds (target ≤ 3 s mid-range, ≤ 10 s low-end) | > 10 s | Phone | |
| D5 | Reading → Kannada | Record a Kannada passage | Notice that Kannada checking is not available yet; result "pending"; **no score** | Any score, or English words in the transcript | Phone | |
| D6 | Dashboard | Open that Kannada attempt | "Transcription pending", audio playable | Shown with 0% | PC | |
| D7 | Advanced passage | Read 2–3 minutes | Processes normally; auto-stop at 3 minutes | Crash at long recordings | Phone | |

### E. OCR and AI feedback (needs `GEMINI_API_KEY` on the backend)

| # | Open | Do | Expected | Failure | Needs | Result |
|---|---|---|---|---|---|---|
| E1 | Writing → camera | Photograph clear English handwriting | Text appears for correction, close to what was written, spelling mistakes kept | Text "corrected" by the AI; crash | Phone + key | |
| E2 | Same | Photograph a blank page | "We couldn't read the text…" or "No handwriting was found" | Invented text | Phone + key | |
| E3 | Same | Kannada handwriting | Kannada text (quality not validated; note it) | Latin transliteration | Phone + key | |
| E4 | Reading result | Look at the feedback | Warm, short, mentions only real mistakes, no numbers that differ from the screen | Shaming tone, invented mistakes, different accuracy | Phone + key | |
| E5 | Writing result | Look at scores and feedback | Scores 0–100 / 0–10; "misspelled" words exist in the text | Words not in the text | Phone + key | |
| E6 | Without key | Remove the key, restart backend, do a reading | Feedback "pending"; reading saved and uploaded normally | Upload blocked | Phone | |

### F. Offline workflows

| # | Open | Do | Expected | Failure | Needs | Result |
|---|---|---|---|---|---|---|
| F1 | Phone | Airplane mode; do a reading and a typed writing | Both saved; "waiting to upload" | Error, data lost | Phone | |
| F2 | Phone | Force-close the app, reopen (still offline) | Items still there and waiting | Lost | Phone | |
| F3 | Phone | Turn Wi-Fi back on, open the app | Items upload within a minute; dashboard shows them once | Duplicates on dashboard | Phone + PC | |
| F4 | Phone | Stop uvicorn, tap **Upload now**, start uvicorn, tap again | First: items wait/retry; second: uploaded | Marked synced while server was down | Phone + PC | |
| F5 | Phone | Mobile data only (Wi-Fi off) | No automatic upload; **Upload now** uploads | Auto-upload on mobile data | Phone | |
| F6 | Phone (shared) | Student A records offline, signs out; Student B signs in online | Details shows A's items "Waiting for this student to sign in"; B's upload; A's upload when A signs in | A's items "failed" | Phone | |

### G. Consent and privacy

| # | Open | Do | Expected | Failure | Needs | Result |
|---|---|---|---|---|---|---|
| G1 | Phone, offline | Make a reading, then Profile → **Withdraw** consent, then go online | Withdrawal uploads; the reading does **not** appear on the dashboard; Details shows "Consent withdrawn…" | Reading appears after withdrawal | Phone + PC | |
| G2 | Phone | After withdrawal, try to start a reading | Assessments locked | Can record | Phone | |
| G3 | Dashboard (researcher) | Research → export reading CSV | Only participant IDs; no names/schools; withdrawn student absent; `asr_status` column present | Names or withdrawn student present | PC | |
| G4 | CSV | Open in Excel | Text starting with `=` shows as text with a leading `'` | Formula executed | PC | |
| G5 | Dashboard (researcher) | Try the Students page | No named student records | Names visible | PC | |
| G6 | Dashboard | Student detail → audio | Plays; after 5 minutes the same link stops working (reload needed) | Permanent public link | PC | |

### H. Data deletion

| # | Open | Do | Expected | Failure | Needs | Result |
|---|---|---|---|---|---|---|
| H1 | Phone | Profile → **Request deletion from the research server** | "Request sent" | Error online | Phone | |
| H2 | Dashboard (admin) | Admin → Data deletion requests → **Delete data** → confirm | Status completed; student gone from teacher views | Still visible | PC | |
| H3 | Phone | As that student: tap **Upload now**, then sign out and sign in again while online | Upload says "Session expired…"; online sign-in is refused ("Incorrect password"). (Data already on the phone stays until H6) | Uploads accepted; sign-in works | Phone | |
| H4 | Terminal | `python -m app.cli integrity-check` | `"ok": true`, `deletedParticipantLeftovers` all 0 | Leftovers, files still present | PC | |
| H5 | Storage folder | Look in `backend\var\storage\audio\<participant ID>` | Folder empty or gone | WAV files still there | PC | |
| H6 | Phone | Profile → **Delete my data from this phone** | Warning lists unsent items; after confirming, attempts gone from the phone | No warning | Phone | |

### I. Performance (record numbers)

| # | Do | Record | Concern if | Needs | Result |
|---|---|---|---|---|---|
| I1 | 10 readings in a row on a low-end phone | Time per result, any slowdown | > 10 s or growing | Phone | |
| I2 | `adb shell dumpsys meminfo com.vgyan.app` during recognition | Total PSS (MB) | App killed when the camera opens | Phone | |
| I3 | 30 minutes of use | Battery % used | > 15% | Phone | |
| I4 | Dashboard with your data | Page load time of Students and Analytics | > 3 s locally | PC | |
| I5 | Upload a 3-minute reading on a slow connection | Time to "synced" | Never completes | Phone | |

---

## 3. When you are done

- **Merge only if** sections B, C, G and H pass completely, A/D/F pass on at least one low-end and one mid-range phone, and every failure has an issue filed.
- Attach this filled-in file and any numbers (D1, D4, I1–I3) to the PR.
- Stop the tunnel (Ctrl+C), `docker stop vgyan-pg`, and uninstall test builds signed with the debug key from shared phones.
