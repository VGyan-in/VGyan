import json
from pathlib import Path

import pytest

from app.services.analysis import analyze, normalize_word, verify_reading_metrics, writing_counts

FIXTURES = json.loads((Path(__file__).resolve().parents[2] / "shared" / "alignment-fixtures.json").read_text("utf-8"))["cases"]


@pytest.mark.parametrize("case", FIXTURES, ids=[c["name"] for c in FIXTURES])
def test_parity_with_client_fixtures(case):
    a = analyze(case["reference"], case["transcript"], case["durationMs"])
    assert [w.status for w in a.words] == case["statuses"]
    assert a.accuracy == case["accuracy"]
    assert a.wpm == case["wpm"]


def test_normalize_kannada_and_english():
    assert normalize_word("School.") == "school"
    assert normalize_word("don’t") == "dont"
    assert normalize_word("ಶಾಲೆ‌") == "ಶಾಲೆ"
    assert normalize_word("ಸುಂದರ.") == "ಸುಂದರ"  # vowel signs kept


def test_verify_flags_inflated_device_metrics():
    ok = verify_reading_metrics("a b c d", "a c d", 30, {"accuracy": 75, "wpm": 6, "substitutions": 0, "omissions": 1, "insertions": 0})
    assert ok["verified"] is True
    bad = verify_reading_metrics("a b c d", "a c d", 30, {"accuracy": 100, "wpm": 6, "substitutions": 0, "omissions": 0, "insertions": 0})
    assert bad["verified"] is False
    assert set(bad["mismatches"]) == {"accuracy", "omissions"}


def test_writing_counts_handles_danda():
    assert writing_counts("ನಾನು ಶಾಲೆಗೆ ಹೋಗುತ್ತೇನೆ। ನನಗೆ ಓದಲು ಇಷ್ಟ.") == {"word_count": 6, "sentence_count": 2}
    assert writing_counts("One. Two three!  ") == {"word_count": 3, "sentence_count": 2}
