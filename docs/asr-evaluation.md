# Offline speech recognition: design and evaluation

## How it works

| Step | Where | Detail |
|---|---|---|
| Record | `client/modules/vgyan-speech` (Kotlin) | `AudioRecord`, `VOICE_RECOGNITION` source, 16 kHz mono 16-bit PCM written straight to a WAV file. This WAV is the research original. |
| Recognise | same module, second thread | Vosk (`com.alphacephei:vosk-android:0.3.47`) is fed the same audio from a queue while the child reads, with `setWords(true)` for per-word start/end times and confidence. The capture thread never waits for the recogniser, so a slow phone cannot drop audio. |
| Finish | on "stop" | Only the backlog is decoded, so the wait after stopping is short. |
| Analyse | `client/src/features/reading/analyzer.ts` | Deterministic word alignment against the passage → correct / substitution / omission / insertion, accuracy, WPM, WCPM, pace, practice words. Gemini is never involved. |
| Verify | `backend/app/services/analysis.py` | The server re-runs the identical alignment on (passage, transcript) and flags any record whose counts differ (`metrics_verified = false`). Both implementations run the same fixtures (`shared/alignment-fixtures.json`). |

### Why a custom native module and not `react-native-vosk`

The research protocol needs the original WAV kept *and* recognised. `react-native-vosk` recognises from the microphone stream only. It cannot save that audio, transcribe an existing file, or report word timings for a saved recording. The custom module does all three in about 400 lines of Kotlin, using the official Vosk Android library.

### Models

Models are **downloaded on first use**, not bundled. This keeps the APK small: speech models are 36 MB or more each. Downloads are resumable and MD5-verified, and the app shows progress. Download URL, checksum and version are build-time settings (`EXPO_PUBLIC_ASR_MODEL_{EN,KN}_{URL,MD5,VERSION}`), so the research team can switch to a validated model without code changes. The model version is stored with every attempt.

| Language | Default | Status |
|---|---|---|
| English | `vosk-model-small-en-in-0.4` (Indian English, 36 MB, Apache-2.0, MD5 `62fd085f33c8c5fc01a235030e2a1fe3`) | Works |
| Kannada | none | **Blocked.** No public Kannada Vosk model exists. The models in the StudentSkillManager app have static decoding graphs of about 133 words and no lexicon, so they cannot recognise VGyan passages or be recompiled. |

When no model is installed for a language, the recording is still saved and synced with `asrStatus = "pending"`. Its metrics stay empty, never zero or estimated. It is excluded from every average. Once a model is installed, the phone transcribes it and syncs the completed version. The server accepts the first transcript once and treats it as immutable afterwards.

## Results so far (synthetic speech only)

Windows text-to-speech (US English voices) read the three English passages exactly as written. Because the reading is perfect, every error is an ASR error.

| Model | Easy (37 words) | Medium (75) | Advanced (103) | ASR time for 40 s of audio (desktop) |
|---|---|---|---|---|
| small-en-in-0.4 | 89.2% accuracy | 93.3% | 86.4% | 2.4 s (real-time factor 0.06) |
| small-en-us-0.15 | 91.9% | 96.0% | 91.3% | 2.6 s |

- A perfect reader loses **4–14 accuracy points** to ASR errors. Mean WER is 13% for the Indian model. Most errors are proper nouns the model doesn't know ("Minu" → "minute", "why do") and short function words.
- The US model does better here partly because the synthetic voices are American. This test cannot choose between the models for Indian children.
- Word timestamps and confidences are returned for every word. Mean confidence was 0.94–0.99 even on wrong words, so confidence alone is not a reliable error detector.
- Speed is not a concern: recognition runs during recording and decodes about 15× faster than real time on a desktop. **Not yet measured on a low-end phone.**

**These numbers do not show the metrics are valid for children.** They show the pipeline works and set a lower bound on ASR error.

## Validation still required before research use

1. Record 30 or more children per language and level on the target phones. Use the app itself, so the audio path is identical.
2. Have trained listeners transcribe each recording verbatim, keeping the child's errors.
3. Run `python tools/asr-eval/vosk_eval.py --model <dir> --manifest samples.csv`. It reports ASR WER against the human transcript, plus the difference between ASR-derived and human-derived accuracy (`acc_diff`).
4. Agree acceptance targets with the research lead before relying on the metrics. A reasonable starting point: mean |acc_diff| ≤ 5 points with no systematic bias, and WER ≤ 20%, per language and level.
5. Repeat on a low-end phone (2–3 GB RAM). Record the time from tapping stop to the result, and peak memory while the model is loaded.
6. For Kannada, the research team must supply a model with a full lexicon or language model. Vosk/Kaldi TDNN-chain format is used as-is; anything else needs a different engine.

The project brief targets about 3 seconds or less of ASR processing for passages up to 500 words. Because recognition streams during reading, that target depends on device speed. It must be confirmed on a real phone.
