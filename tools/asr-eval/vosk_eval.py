"""Evaluate a Vosk model on reading recordings the same way the app does.

Usage:
    pip install vosk
    python tools/asr-eval/vosk_eval.py --model path/to/vosk-model --manifest samples.csv [--out results.csv] [--json summary.json]

samples.csv columns:
    wav               path (relative to the manifest) to a 16 kHz mono 16-bit WAV
    reference_text    the passage the reader was asked to read
    human_transcript  (optional) what a trained listener heard, verbatim, including the reader's errors.
                      For synthetic speech this is the exact text that was synthesised.
    source            "synthetic" or "human". Results are always summarised separately per source:
                      synthetic speech says nothing about children's speech.
    condition         free label, e.g. clean / noise-20db / noise-10db / classroom
    speed             free label, e.g. slow / normal / fast
    speaker_group     (optional) e.g. tts-adult, child-grade3. Never a name.
    language          (optional) English / Kannada

For every row it streams the WAV in 100 ms chunks (as the Android module does), aligns the ASR
transcript against the passage with the same algorithm as the app and server
(backend/app/services/analysis.py), and, when a human transcript exists, reports:
    asr_wer / asr_cer       word / character error rate of ASR against the human transcript
    acc_asr / acc_human     reading accuracy computed from each transcript
    acc_diff                acc_asr - acc_human (the bias the ASR introduces into the research metric)
    rtf                     recognition time / audio duration on this machine (not a phone)
Rows that fail (unreadable file, wrong format, recogniser error) are counted as failures.

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
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from app.services.analysis import align_words, analyze, normalize_word, tokenize  # noqa: E402


def wer(ref: str, hyp: str) -> float:
    r, h = tokenize(ref), tokenize(hyp)
    words = align_words(r, h)
    errors = sum(1 for w in words if w.status != "correct")
    return errors / max(1, len(r))


def _lev(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def cer(ref: str, hyp: str) -> float:
    """Character error rate on normalised text (case, punctuation and zero-width marks removed).
    Relevant for Kannada, where one word carries several aksharas."""
    r = " ".join(normalize_word(w) for w in tokenize(ref))
    h = " ".join(normalize_word(w) for w in tokenize(hyp))
    return _lev(r, h) / max(1, len(r))


def transcribe(model, path: Path) -> tuple[str, list, float, float]:
    from vosk import KaldiRecognizer

    with wave.open(str(path), "rb") as wf:
        if wf.getframerate() != 16000 or wf.getnchannels() != 1 or wf.getsampwidth() != 2:
            raise ValueError(f"{path.name}: expected 16 kHz mono 16-bit WAV")
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


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return round(statistics.mean(xs), 4) if xs else None


def summarise(rows: list[dict], failures: list[dict], keys: tuple[str, ...]) -> list[dict]:
    groups: dict[tuple, list[dict]] = defaultdict(list)
    fails: dict[tuple, int] = defaultdict(int)
    for r in rows:
        groups[tuple(r.get(k, "") for k in keys)].append(r)
    for f in failures:
        fails[tuple(f.get(k, "") for k in keys)] += 1
    out = []
    for g in sorted(set(groups) | set(fails)):
        rs = groups.get(g, [])
        diffs = [r["acc_diff"] for r in rs if "acc_diff" in r]
        out.append(
            {
                **dict(zip(keys, g, strict=True)),
                "n": len(rs),
                "failures": fails.get(g, 0),
                "failure_rate": round(fails.get(g, 0) / max(1, len(rs) + fails.get(g, 0)), 3),
                "mean_wer": _mean(r.get("asr_wer") for r in rs),
                "mean_cer": _mean(r.get("asr_cer") for r in rs),
                "mean_abs_acc_diff": _mean(abs(d) for d in diffs),
                "acc_bias": _mean(diffs),
                "within_5_pts": round(sum(abs(d) <= 5 for d in diffs) / len(diffs), 3) if diffs else None,
                "mean_rtf": _mean(r.get("rtf") for r in rs),
                "mean_asr_s": _mean(r.get("asr_s") for r in rs),
            }
        )
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--out")
    ap.add_argument("--json", help="write the grouped summary as JSON")
    args = ap.parse_args()

    from vosk import Model, SetLogLevel

    SetLogLevel(-1)
    t0 = time.perf_counter()
    model = Model(args.model)
    load_s = time.perf_counter() - t0
    print(f"model {Path(args.model).name} loaded in {load_s:.2f}s")

    base = Path(args.manifest).resolve().parent
    rows, failures = [], []
    with open(args.manifest, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            meta = {k: (row.get(k) or "").strip() for k in ("source", "condition", "speed", "speaker_group", "language")}
            meta["source"] = meta["source"] or "unspecified"
            wav = Path(row["wav"])
            wav = wav if wav.is_absolute() else base / wav
            try:
                hyp, words, secs, asr_s = transcribe(model, wav)
            except Exception as e:  # noqa: BLE001 - recorded as a failure, never silently dropped
                failures.append({**meta, "wav": row["wav"], "error": f"{type(e).__name__}: {e}"})
                print(f"FAIL {row['wav']}: {e}")
                continue
            a = analyze(row["reference_text"], hyp, secs * 1000)
            out = {
                **meta,
                "wav": row["wav"],
                "audio_s": round(secs, 2),
                "asr_s": round(asr_s, 3),
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
                out["asr_wer"] = round(wer(human, hyp), 4)
                out["asr_cer"] = round(cer(human, hyp), 4)
            rows.append(out)
            print(json.dumps({k: v for k, v in out.items() if k != "asr_transcript"}, ensure_ascii=False))

    by_source = summarise(rows, failures, ("source",))
    by_condition = summarise(rows, failures, ("source", "condition", "speed"))
    print(f"\n{len(rows)} recognised, {len(failures)} failed. Model load {load_s:.2f}s.")
    for s in by_source + by_condition:
        print(json.dumps(s, ensure_ascii=False))
    if args.out:
        with open(args.out, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=sorted({k for r in rows for k in r}))
            w.writeheader()
            w.writerows(rows)
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(
                {"model": Path(args.model).name, "model_load_s": round(load_s, 2), "by_source": by_source, "by_condition": by_condition, "failures": failures},
                f,
                indent=2,
                ensure_ascii=False,
            )
    return 0


if __name__ == "__main__":
    sys.exit(main())
