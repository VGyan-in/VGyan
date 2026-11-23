"""Builds a reproducible SYNTHETIC evaluation set from the seeded English passages.

    python tools/asr-eval/make_synthetic.py --out tools/asr-eval/data/synthetic   (Windows: uses SAPI voices)

For every English reading passage it synthesises:
  * a perfect reading, and a reading with scripted mistakes (one substitution and one skipped word
    per ~12 words), so the evaluation measures whether ASR detects real reading errors, not only
    whether it can transcribe fluent text;
  * three speaking rates (slow / normal / fast);
  * three acoustic conditions (clean, white noise at 20 dB and 10 dB SNR), noise seeded for repeatability.

The manifest marks every row source=synthetic. Adult TTS voices say NOTHING about how the model
performs on children's speech; these numbers are a pipeline and regression check only.
"""

import argparse
import array
import csv
import math
import random
import subprocess
import sys
import wave
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from app.seed_data import READING  # noqa: E402

RATES = {"slow": -3, "normal": 0, "fast": 3}
SNRS = {"clean": None, "noise-20db": 20, "noise-10db": 10}
SUBSTITUTES = ["cat", "big", "run", "the", "sun", "tree", "red", "book"]

PS = r"""
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice($args[0])
$s.Rate = [int]$args[1]
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile($args[2], $fmt)
$s.Speak([IO.File]::ReadAllText($args[3]))
$s.Dispose()
"""


def with_mistakes(text: str, rng: random.Random) -> str:
    words = text.split()
    out = []
    for i, w in enumerate(words):
        if i % 12 == 5:
            continue  # omission
        if i % 12 == 9:
            out.append(rng.choice(SUBSTITUTES))  # substitution
            continue
        out.append(w)
    return " ".join(out)


def synth(voice: str, rate: int, text: str, dest: Path, tmp: Path) -> None:
    tmp.write_text(text, encoding="utf-8")
    script = tmp.with_suffix(".ps1")
    script.write_text(PS, encoding="utf-8")
    subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script), voice, str(rate), str(dest), str(tmp)],
        check=True,
    )


def add_noise(src: Path, dest: Path, snr_db: float, seed: int) -> None:
    with wave.open(str(src), "rb") as w:
        params = w.getparams()
        samples = array.array("h", w.readframes(w.getnframes()))
    power = sum(s * s for s in samples) / max(1, len(samples))
    sigma = math.sqrt(power / (10 ** (snr_db / 10)))
    rng = random.Random(seed)
    noisy = array.array("h", (max(-32768, min(32767, int(s + rng.gauss(0, sigma)))) for s in samples))
    with wave.open(str(dest), "wb") as w:
        w.setparams(params)
        w.writeframes(noisy.tobytes())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--voices", default="Microsoft David Desktop,Microsoft Zira Desktop")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    rng = random.Random(20261123)
    rows = []
    passages = [(pid, level, text) for pid, lang, level, _t, _k, text in READING if lang == "English"]
    for vi, voice in enumerate(v.strip() for v in args.voices.split(",")):
        for pid, level, text in passages:
            for variant, spoken in (("perfect", text), ("mistakes", with_mistakes(text, rng))):
                for speed, rate in RATES.items():
                    stem = f"{pid}-{variant}-{speed}-v{vi}"
                    clean = out / f"{stem}-clean.wav"
                    if not clean.exists():
                        synth(voice, rate, spoken, clean, out / "_tmp.txt")
                    for cond, snr in SNRS.items():
                        wav = clean if snr is None else out / f"{stem}-{cond}.wav"
                        if snr is not None and not wav.exists():
                            add_noise(clean, wav, snr, seed=zlib.crc32(f"{stem}-{cond}".encode()))
                        rows.append(
                            {
                                "wav": wav.name,
                                "reference_text": text,
                                "human_transcript": spoken,
                                "source": "synthetic",
                                "condition": cond,
                                "speed": speed,
                                "speaker_group": f"tts-adult-v{vi}",
                                "language": "English",
                                "level": level,
                                "variant": variant,
                            }
                        )
    for f in out.glob("_tmp.*"):
        f.unlink()
    with open(out / "manifest.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} rows -> {out / 'manifest.csv'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
