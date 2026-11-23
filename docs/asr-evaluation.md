# Offline speech recognition: design and evaluation

## How it works

| Step | Where | Detail |
|---|---|---|
| Record | `client/modules/vgyan-speech` (Kotlin) | `AudioRecord`, `VOICE_RECOGNITION` source, 16 kHz mono 16-bit PCM written straight to a WAV file. This WAV is the research original. |
| Recognise | same module, second thread | Vosk (`com.alphacephei:vosk-android:0.3.47`) is fed the same audio from a queue while the child reads, with `setWords(true)` for per-word start/end times and confidence. The capture thread never waits for the recogniser, so a slow phone cannot drop audio. |
| Finish | on "stop" | Only the backlog is decoded, so the wait after stopping is short. |
| Interruptions | recording screen + module | Backgrounding, a call or screen-off discards the take (Android gives background apps silence). A lost microphone ends the take instead of spinning. |
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

**Nothing below involves children or any human speaker.** All numbers come from Windows text-to-speech
(two adult US-English voices). They test the pipeline and show the direction and size of ASR error. They
say nothing about how the model performs on Indian children.

### Reproduce

```powershell
pip install vosk                       # into the backend venv or a separate one
# models: https://alphacephei.com/vosk/models (vosk-model-small-en-in-0.4, MD5 62fd085f33c8c5fc01a235030e2a1fe3)
python tools/asr-eval/make_synthetic.py --out tools/asr-eval/data/synthetic          # Windows (SAPI voices), ~25 s
python tools/asr-eval/vosk_eval.py --model tools/asr-eval/models/vosk-model-small-en-in-0.4 --manifest tools/asr-eval/data/synthetic/manifest.csv --out en-in.csv --json en-in.json
```

The set has 108 recordings: 2 voices × 3 English passages × {perfect reading, reading with scripted
mistakes (one skipped and one substituted word per ~12 words)} × 3 rates (slow, normal, fast) ×
3 conditions (clean, white noise at 20 dB and 10 dB SNR, seeded). The "human transcript" of each row is
the exact text synthesised, so `acc_human` is the true accuracy and `acc_diff` is the error ASR adds to
the reading-accuracy metric. Generated audio and models are git-ignored (`tools/asr-eval/.gitignore`).

### Results (2026-11-23, desktop CPU, 108 recordings per model, 0 failures)

`vosk-model-small-en-in-0.4` (the app's default):

| Group | n | WER | CER | Mean abs. accuracy error | Bias | Within ±5 pts |
|---|---|---|---|---|---|---|
| All | 108 | 33.5% | 19.8% | 26.6 | −26.6 | 1% |
| Clean | 36 | 21.0% | 11.2% | 15.4 | −15.4 | 3% |
| Noise 20 dB | 36 | 33.2% | 19.0% | 26.1 | −26.1 | 0% |
| Noise 10 dB | 36 | 46.4% | 29.3% | 38.5 | −38.5 | 0% |
| Slow | 36 | 27.1% | 14.4% | 19.3 | −19.3 | 3% |
| Normal | 36 | 25.0% | 13.5% | 19.1 | −19.1 | 0% |
| Fast | 36 | 48.5% | 31.5% | 41.6 | −41.6 | 0% |
| Perfect reading, clean | 18 | 17.8% | 9.7% | 14.7 | −14.7 | 6% |
| With mistakes, clean | 18 | 24.2% | 12.7% | 16.0 | −16.0 | 0% |

`vosk-model-small-en-us-0.15` (for comparison):

| Group | n | WER | CER | Mean abs. accuracy error | Bias | Within ±5 pts |
|---|---|---|---|---|---|---|
| All | 108 | 16.3% | 7.3% | 12.0 | −12.0 | 20% |
| Clean | 36 | 10.5% | 4.4% | 7.0 | −7.0 | 36% |
| Noise 20 dB | 36 | 15.1% | 6.8% | 10.8 | −10.8 | 25% |
| Noise 10 dB | 36 | 23.3% | 10.7% | 18.0 | −18.0 | 0% |
| Fast | 36 | 23.8% | 11.6% | 18.4 | −18.4 | 3% |
| Perfect reading, clean | 18 | 9.5% | 4.2% | 7.3 | −7.3 | 33% |

Real-time factor (recognition time ÷ audio length) was 0.07–0.14 on a desktop. Model load took 0.4 s.
**Neither has been measured on a phone.**

### What this means

1. **The bias is always negative.** ASR errors are counted as the reader's mistakes, so accuracy is under-reported: by about 15 points for clean, normal-speed speech with the default model, and by up to about 40 points with noise or fast reading. A reader who makes no mistakes can fall below the dashboard's 75% "may need support" line.
2. **Scripted mistakes are partly detected.** Readings with mistakes show a similar bias to perfect ones, so the metric still moves in the right direction, but it cannot separate a child's error from an ASR error for an individual word.
3. **Noise matters most.** Classrooms are noisy; recording in a quiet corner is the most useful protocol instruction.
4. **The US model wins here, but this test favours it** (the voices are American). Choose the model only after testing with Indian children's speech.
5. Word confidences stayed high on wrong words in the earlier run, so confidence alone cannot flag ASR errors.

Changes made in response: the app labels the score "Reading accuracy (automatic estimate)" with a note
that the checker can mishear words; the dashboard's at-risk card tells teachers to listen to the
recording before acting on a flag. The 75% threshold itself is a research decision.

Earlier run (2026-11-11, perfect readings only, clean, normal speed, one voice): en-in 86–93%, en-us
91–96% accuracy on a 100% reading, consistent with the "perfect reading, clean" rows above.

## Validation still required before research use

1. Record 30 or more children per language and level on the target phones. Use the app itself, so the audio path is identical.
2. Have trained listeners transcribe each recording verbatim, keeping the child's errors.
3. Build a manifest with `source=human`, `condition` (e.g. classroom/quiet), `speed`, `speaker_group` (e.g. `child-grade3`, never a name) and run `python tools/asr-eval/vosk_eval.py --model <dir> --manifest samples.csv --json summary.json`. It reports WER, CER, `acc_diff` and failure rates per group, separately from any synthetic rows.
4. Agree acceptance targets with the research lead before relying on the metrics. A reasonable starting point: mean |acc_diff| ≤ 5 points with no systematic bias, and WER ≤ 20%, per language and level.
5. Repeat on a low-end phone (2–3 GB RAM). Record the time from tapping stop to the result, and peak memory while the model is loaded.
6. For Kannada, the research team must supply a model with a full lexicon or language model. Vosk/Kaldi TDNN-chain format is used as-is; anything else needs a different engine.

The project brief targets about 3 seconds or less of ASR processing for passages up to 500 words. Because recognition streams during reading, that target depends on device speed. It must be confirmed on a real phone.
