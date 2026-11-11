"""Evaluate a Vosk model on reading recordings the same way the app does.

Usage:
    pip install vosk
    python tools/asr-eval/vosk_eval.py --model path/to/vosk-model --manifest samples.csv [--out results.csv]

samples.csv columns:
    wav               path to a 16 kHz mono 16-bit WAV (exports from the server are already in this format)
    reference_text    the passage the child was asked to read
    human_transcript  (optional) what a trained listener heard, verbatim, including the child's errors

For every row it streams the WAV in 100 ms chunks (as the Android module does), aligns the ASR transcript
against the passage with the same algorithm as the app and server (backend/app/services/analysis.py), and,
when a human transcript exists, reports:
    asr_wer           word error rate of ASR against the human transcript
    acc_asr / acc_human   reading accuracy computed from each transcript
    acc_diff          acc_asr - acc_human (the bias the ASR introduces into the research metric)
Summary lines at the end give means and the share of readings within +/-5 accuracy points.

Before ASR-derived accuracy is used for research, the team should agree targets (for example: mean
|acc_diff| <= 5 points and asr_wer <= 20% on children's speech for each language and level).
"""

import argparse
import csv
import json
import statistics
import sys
import time
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from app.services.analysis import align_words, analyze, tokenize  # noqa: E402


def wer(ref: str, hyp: str) -> float:
    r, h = tokenize(ref), tokenize(hyp)
    words = align_words(r, h)
    errors = sum(1 for w in words if w.status != "correct")
    return errors / max(1, len(r))


def transcribe(model, path: str) -> tuple[str, list, float, float]:
    from vosk import KaldiRecognizer

    with wave.open(path, "rb") as wf:
        if wf.getframerate() != 16000 or wf.getnchannels() != 1 or wf.getsampwidth() != 2:
            raise ValueError(f"{path}: expected 16 kHz mono 16-bit WAV")
        seconds = wf.getnframes() / 16000
        rec = KaldiRecognizer(model, 16000)
        rec.SetWords(True)
        texts, words = [], []
        t0 = time.perf_counter()
        while data := wf.readframes(1600):
            if rec.AcceptWaveform(data):
                r = json.loads(rec.Result())
                texts.append(r.get("text", ""))
                words += r.get("result", [])
        r = json.loads(rec.FinalResult())
        texts.append(r.get("text", ""))
        words += r.get("result", [])
        return " ".join(t for t in texts if t), words, seconds, time.perf_counter() - t0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--out")
    args = ap.parse_args()

    from vosk import Model, SetLogLevel

    SetLogLevel(-1)
    t0 = time.perf_counter()
    model = Model(args.model)
    print(f"model loaded in {time.perf_counter() - t0:.2f}s")

    rows = []
    with open(args.manifest, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            hyp, words, secs, asr_s = transcribe(model, row["wav"])
            a = analyze(row["reference_text"], hyp, secs * 1000)
            out = {
                "wav": row["wav"],
                "audio_s": round(secs, 2),
                "asr_s": round(asr_s, 2),
                "rtf": round(asr_s / secs, 3) if secs else None,
                "acc_asr": a.accuracy,
                "subs": a.substitutions,
                "omits": a.omissions,
                "ins": a.insertions,
                "mean_conf": round(statistics.mean(w["conf"] for w in words), 3) if words else None,
                "asr_transcript": hyp,
            }
            human = (row.get("human_transcript") or "").strip()
            if human:
                out["acc_human"] = analyze(row["reference_text"], human, secs * 1000).accuracy
                out["acc_diff"] = round(out["acc_asr"] - out["acc_human"], 1)
                out["asr_wer"] = round(wer(human, hyp), 3)
            rows.append(out)
            print(json.dumps({k: v for k, v in out.items() if k != "asr_transcript"}, ensure_ascii=False))

    with_h = [r for r in rows if "acc_diff" in r]
    print(f"\n{len(rows)} recordings, mean RTF {statistics.mean(r['rtf'] for r in rows if r['rtf']):.3f}")
    if with_h:
        diffs = [r["acc_diff"] for r in with_h]
        print(f"vs human ({len(with_h)}): mean WER {statistics.mean(r['asr_wer'] for r in with_h):.1%}, "
              f"mean |acc diff| {statistics.mean(abs(d) for d in diffs):.1f} pts, "
              f"bias {statistics.mean(diffs):+.1f} pts, within ±5 pts: {sum(abs(d) <= 5 for d in diffs) / len(diffs):.0%}")
    if args.out:
        with open(args.out, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=sorted({k for r in rows for k in r}))
            w.writeheader()
            w.writerows(rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
