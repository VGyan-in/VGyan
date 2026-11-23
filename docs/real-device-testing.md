# Real-device testing plan

**Status: no physical-device testing has been done yet.** Everything below is the plan. The APK
compiles in CI, and the speech engine is verified as packaged, but recording, recognition, memory use and
battery behaviour have never run on hardware.

## Device matrix

The build supports Android 7.0 (API 24) and later and targets Android 16 (API 36). Native speech
libraries are included for `arm64-v8a` and `armeabi-v7a` (x86 emulators also work).

| Tier | Example | Android | RAM | Why |
|---|---|---|---|---|
| Low-end (must pass) | Redmi A-series, Samsung Galaxy A0x/M0x, itel/Lava | 10–13 (Go edition if possible) | 2–3 GB | Typical school/parent phone; slowest recognition, tightest memory, aggressive battery management |
| Mid-range | Redmi Note, Samsung Galaxy A1x/A3x | 13–15 | 4–6 GB | Most common |
| Recent | Pixel or any Android 15/16 | 15–16 | 6+ GB | Newest permission and background rules |
| Oldest supported (if available) | any | 7–9 | any | Minimum SDK sanity check |
| Small screen | ≤ 5.5″ | any | | Layout, passage text size, buttons |
| Tablet | 8–10″ | any | | Layout stretching |

Minimum for sign-off: one low-end and one mid-range phone, both on 4G and on no network.

## Install

1. Download the APK artifact from the GitHub Actions run (see USER_ACCEPTANCE_TESTING.md §2).
2. Enable *Install unknown apps* for your browser or file manager, or use USB debugging:
   `adb install -r vgyan-1.0.0-<sha>-release-debug-key-offline.apk`
3. A build ending `-offline` has no backend URL: everything stays on the phone. A build ending `-server`
   talks to the URL it was built with.

## Test scenarios

Record for each: device, Android version, build file name, pass/fail, notes, screenshots. Never use a
real child's data unless the ethics approval covers the test: use adult testers and the test accounts.

| # | Scenario | Steps | Expected | Failure looks like |
|---|---|---|---|---|
| D1 | First launch, permissions | Fresh install → register → consent → reading → tap mic | One microphone prompt; recording starts after Allow | Crash, repeated prompts, recording without prompt |
| D2 | Permission denied | Deny mic (choose "Don't allow" twice) → tap mic | Red notice + **Open app settings** button that opens VGyan's settings | No way forward, crash |
| D3 | Model download | English reading, model not installed → Download on Wi-Fi | Progress to 100%, "Installing", then ready; ~36 MB used | Stuck %, checksum error on a good connection |
| D4 | Download interrupted | Start download → airplane mode → reconnect → Download again | Resumes or restarts; ends ready | Corrupt model accepted, crash |
| D5 | English recognition | Read the Easy passage clearly at normal pace in a quiet room | Result within a few seconds; a transcript close to what was read. Write down the accuracy: synthetic tests predict roughly 75–95 % for a perfect reading (ASR under-counts), so a fluent reader scoring below ~70 % is worth reporting | Empty transcript, "Speech recognition failed", result > 10 s after stop |
| D6 | Recognition latency | Time from tapping stop to the result screen, for Easy and Advanced | Note seconds. Target: ≤ 3 s after stop on mid-range | > 10 s on low-end is a blocker for classroom use |
| D7 | Noise | Read with classroom-like background chatter or a fan | Accuracy drops (expected), app does not crash | Crash, hang |
| D8 | Reading mistakes | Deliberately skip a word and replace another | Those words marked omission/substitution | Mistakes not detected |
| D9 | Kannada | Kannada passage → record | "Offline speech checking for Kannada is not available yet" notice; result says "pending"; **no score shown** | Any accuracy number for Kannada, English text in the transcript |
| D10 | Backgrounding | Start recording → press Home → return | Take discarded with "Recording stopped because the app was closed or interrupted" | Saved attempt with silence, crash |
| D11 | Phone call | Start recording → receive a call | Take discarded or "could not be saved"; app usable after the call | Frozen mic, every later recording fails |
| D12 | Screen off | Start recording → press power → wait 5 s → unlock | Take discarded with the interruption message | Silent attempt saved |
| D13 | Too short | Record < 3 s | "That was too short" | Saved attempt |
| D14 | Maximum length | Record 3 minutes | Stops automatically and processes | Crash at 3 min, truncated file |
| D15 | App killed | Record → stop → on processing screen swipe the app away → reopen | Attempt is in history (pending or completed); no duplicate | Lost recording, duplicate |
| D16 | Offline queue | Airplane mode → do 2 readings and 1 typed writing → reconnect on Wi-Fi | Sync details show items pending, then synced; teacher sees them | Items stuck "uploading", duplicates on server |
| D17 | Mobile data | On 4G only, with auto-sync | Nothing uploads automatically (Wi-Fi only); **Upload now** (Profile) uploads | Large uploads on mobile data without consent of the user |
| D18 | Slow network | Throttle (phone hotspot with poor signal) during upload | Upload completes or retries; never shown synced before server confirmation | Shown synced but missing on dashboard |
| D19 | Shared phone | Student A records offline → sign out → Student B signs in online | A's items stay "Waiting for this student to sign in"; B's upload; when A signs in, A's upload | A's items "failed" permanently or uploaded under B |
| D20 | Withdrawal | Withdraw consent with unsynced attempts | Reading/writing locked; attempts not uploaded; withdrawal reaches the server | Attempts appear on dashboard after withdrawal |
| D21 | Storage full | Fill the phone to < 50 MB free → record | Clear error ("Check free storage space"); no crash | Crash, corrupted attempt |
| D22 | Battery | 30 minutes of repeated readings, screen on | Note % used. Compare with a video app | Phone hot, > 15 %/30 min |
| D23 | Memory | `adb shell dumpsys meminfo com.vgyan.app` during recognition | Note PSS; app not killed when switching to the camera | App restarts after the camera on low-end |
| D24 | Handwriting | Writing → camera → photo of handwritten English and Kannada | OCR text appears (server build with AI key); student can correct; blank page gives a clear message | Crash; corrected text overwritten |
| D25 | Font rendering | Kannada screens, consent text, passages | Kannada conjuncts render correctly, nothing clipped | Boxes, broken conjuncts, clipped text |
| D26 | Accessibility | TalkBack on: navigate consent, mic button, results | Buttons announced with meaningful labels | Unlabelled buttons |
| D27 | Large font | Settings → font size max | Text wraps, buttons reachable | Overlap, cut-off buttons |
| D28 | Audio playback | Dashboard → student → play the recording | Same audio as recorded, clear | Silence, distortion, wrong student |

## Measurements to send back

- D5/D6/D7/D8 accuracy and latency per device (use the result screen and a stopwatch).
- D22 battery and D23 memory figures.
- With consent from adult testers, export 10–20 recordings and their reference transcripts and run
  `tools/asr-eval/vosk_eval.py` with `source=human` (see asr-evaluation.md). These are the first
  real-speech numbers for the project.

## Logs

```powershell
adb logcat -c
adb logcat --pid=(adb shell pidof com.vgyan.app)      # PowerShell; bash: --pid=$(adb shell pidof com.vgyan.app)
```
Logs hold no names (participant IDs only), but recordings and screenshots may: store them as research data.
