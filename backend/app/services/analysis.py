"""Deterministic reading analysis, a line-for-line port of client/src/features/reading/analyzer.ts.

The server uses it to independently re-derive the word counts from (reference_text, transcript)
and flag any record whose device-computed metrics disagree. Keep the two implementations in
lock-step: tests/test_analysis.py runs the same fixtures as client/__tests__/reading-analyzer.test.ts.
"""

import math
import re
import unicodedata
from dataclasses import dataclass, field

ANALYSIS_VERSION = "align-v1"

_ZERO_WIDTH = re.compile("[​-‍﻿]")
_APOSTROPHES = re.compile("[’']")


def _js_round(x: float) -> float:
    """JavaScript Math.round (half rounds up), not Python's banker's rounding."""
    return math.floor(x + 0.5)


def normalize_word(word: str) -> str:
    w = unicodedata.normalize("NFC", word)
    w = _ZERO_WIDTH.sub("", w)
    w = _APOSTROPHES.sub("", w)
    w = "".join(ch for ch in w if unicodedata.category(ch)[0] in "LMN" or ch.isspace())
    return w.lower()


def tokenize(text: str) -> list[str]:
    return [t for t in unicodedata.normalize("NFC", text).split() if normalize_word(t)]


@dataclass
class Aligned:
    status: str
    ref: str | None = None
    hyp: str | None = None


def align_words(reference: list[str], spoken: list[str]) -> list[Aligned]:
    r = [normalize_word(w) for w in reference]
    h = [normalize_word(w) for w in spoken]
    n, m = len(r), len(h)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j - 1] + cost, dp[i - 1][j] + 1, dp[i][j - 1] + 1)

    out: list[Aligned] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            out.append(Aligned("omission", ref=reference[i - 1]))
            i -= 1
            continue
        if i > 0 and j > 0:
            cost = 0 if r[i - 1] == h[j - 1] else 1
            if dp[i][j] == dp[i - 1][j - 1] + cost:
                out.append(Aligned("correct" if cost == 0 else "substitution", ref=reference[i - 1], hyp=spoken[j - 1]))
                i -= 1
                j -= 1
                continue
        out.append(Aligned("insertion", hyp=spoken[j - 1]))
        j -= 1
    out.reverse()
    return out


def compute_accuracy(correct: int, reference_count: int) -> float:
    if reference_count == 0:
        return 0.0
    return _js_round(correct / reference_count * 1000) / 10


def compute_wpm(spoken_count: int, duration_ms: float) -> float:
    if duration_ms <= 0:
        return 0
    return _js_round(spoken_count / (duration_ms / 60000))


@dataclass
class Analysis:
    reference_count: int
    spoken_count: int
    correct: int
    substitutions: int
    omissions: int
    insertions: int
    accuracy: float
    wpm: float
    words: list[Aligned] = field(default_factory=list)


def analyze(reference_text: str, transcript: str, duration_ms: float) -> Analysis:
    ref = tokenize(reference_text)
    spoken = tokenize(transcript)
    words = align_words(ref, spoken)
    count = lambda s: sum(1 for w in words if w.status == s)  # noqa: E731
    correct = count("correct")
    return Analysis(
        reference_count=len(ref),
        spoken_count=len(spoken),
        correct=correct,
        substitutions=count("substitution"),
        omissions=count("omission"),
        insertions=count("insertion"),
        accuracy=compute_accuracy(correct, len(ref)),
        wpm=compute_wpm(len(spoken), duration_ms),
        words=words,
    )


def verify_reading_metrics(reference_text: str, transcript: str, duration_sec: float, reported: dict) -> dict:
    """Recompute counts server-side and compare with what the device reported."""
    a = analyze(reference_text, transcript, duration_sec * 1000)
    server = {
        "accuracy": a.accuracy,
        "wpm": a.wpm,
        "substitutions": a.substitutions,
        "omissions": a.omissions,
        "insertions": a.insertions,
    }
    mismatches = {}
    for k, v in server.items():
        rv = reported.get(k)
        tol = 1.0 if k == "wpm" else 0.05  # wpm may differ by rounding of the duration
        if rv is None or abs(float(rv) - float(v)) > tol:
            mismatches[k] = {"device": rv, "server": v}
    return {"analysis_version": ANALYSIS_VERSION, "server": server, "mismatches": mismatches, "verified": not mismatches}


def writing_counts(text: str) -> dict:
    words = tokenize(text)
    sentences = [s for s in re.split(r"[.!?।]+", text) if tokenize(s.strip())]
    return {"word_count": len(words), "sentence_count": len(sentences)}
