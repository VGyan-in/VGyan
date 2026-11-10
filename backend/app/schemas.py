import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

Language = Literal["English", "Kannada"]
Level = Literal["Easy", "Medium", "Advanced"]


class CamelModel(BaseModel):
    """Accepts the app's camelCase JSON; unknown keys are ignored (the raw JSON is kept separately)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


# ---------- Auth ----------


class StudentRegisterIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    student_id: str | None = Field(default=None, min_length=3, max_length=40, description="Participant ID")
    full_name: str = Field(alias="fullName", min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=254)
    password: str = Field(min_length=6, max_length=128)
    class_code: str | None = Field(default=None, alias="classCode", max_length=12)

    @field_validator("student_id")
    @classmethod
    def _pid(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        v = v.strip().upper()
        if not all(c.isalnum() or c in "-_" for c in v):
            raise ValueError("Participant ID may contain letters, digits, '-' and '_' only")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        v = v.strip().lower()
        if "@" not in v or v.startswith("@") or v.endswith("@"):
            raise ValueError("Invalid e-mail address")
        return v


class StudentLoginIn(BaseModel):
    student_id: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class StaffLoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    participant_id: str | None = None
    role: str


class StudentProfileIn(CamelModel):
    name: str | None = Field(default=None, max_length=200)
    grade: str | None = Field(default=None, max_length=10)
    section: str | None = Field(default=None, max_length=10)
    school: str | None = Field(default=None, max_length=200)
    school_type: str | None = Field(default=None, max_length=40)
    medium: str | None = Field(default=None, max_length=40)
    native_language: str | None = Field(default=None, max_length=40)
    other_languages: str | None = Field(default=None, max_length=200)
    age_group: str | None = Field(default=None, max_length=20)
    gender: str | None = Field(default=None, max_length=20)
    class_code: str | None = Field(default=None, max_length=12)


PROFILE_KEYS = ("grade", "section", "school", "schoolType", "medium", "nativeLanguage", "otherLanguages", "ageGroup", "gender")


# ---------- Sync records (as sent by the app) ----------


class SessionIn(CamelModel):
    session_id: uuid.UUID
    app_version: str = Field(max_length=40)
    device_info: str = Field(max_length=200)
    started_at: datetime


class ConsentIn(CamelModel):
    id: uuid.UUID
    participant_id: str
    consent_version: str = Field(max_length=20)
    accepted_at: datetime
    withdrawn_at: datetime | None = None
    signer_type: Literal["guardian", "student"]
    signer_name: str = Field(min_length=1, max_length=200)
    signer_relation: str = Field(default="", max_length=60)
    language: Literal["en", "kn", "both"]
    audio_consent: bool
    handwriting_consent: bool
    research_consent: bool
    status: Literal["active", "withdrawn"]


class AlignedWordIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    status: Literal["correct", "substitution", "omission", "insertion"]
    ref: str | None = None
    hyp: str | None = None


class AsrWordIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    word: str
    start: float
    end: float
    conf: float


class FeedbackIn(CamelModel):
    summary: str = ""
    strengths: list[str] = []
    improvements: list[str] = []
    suggestions: list[str] | None = None
    practice_words: list[str] | None = None
    model_version: str
    prompt_version: str


class WritingFeedbackIn(FeedbackIn):
    grammar_score: float | None = None
    vocabulary_score: float | None = None
    spelling_score: float | None = None
    score: float | None = None
    misspelled: list[str] = []
    corrected_text: str | None = None


class ReadingRecordIn(CamelModel):
    id: uuid.UUID
    participant_id: str
    session_id: uuid.UUID | None = None
    session: SessionIn | None = None
    passage_id: str = Field(max_length=40)
    title: str = Field(default="", max_length=200)
    language: Language
    level: Level
    created_at: datetime
    reference_text: str = Field(min_length=1, max_length=20000)
    transcript: str = Field(default="", max_length=20000)
    asr_words: list[AsrWordIn] | None = None
    duration_sec: float = Field(ge=0, le=3600)
    asr_confidence: float | None = None
    asr_model_version: str = Field(default="", max_length=80)
    analysis_version: str = Field(default="", max_length=40)
    accuracy: float = Field(ge=0, le=100)
    wpm: float = Field(ge=0)
    wcpm: float = Field(default=0, ge=0)
    pace: str = Field(default="", max_length=20)
    mistakes_count: int = Field(default=0, ge=0)
    substitutions: int = Field(ge=0)
    omissions: int = Field(ge=0)
    insertions: int = Field(ge=0)
    practice_words: list[str] = []
    words: list[AlignedWordIn] = []
    fluency: dict | None = None
    ai_status: Literal["pending", "completed", "failed"] = "pending"
    feedback: FeedbackIn | None = None
    audio_sha256: str | None = Field(default=None, max_length=64)
    audio_md5: str | None = Field(default=None, max_length=32)


class WritingRecordIn(CamelModel):
    id: uuid.UUID
    participant_id: str
    session_id: uuid.UUID | None = None
    session: SessionIn | None = None
    prompt_id: str = Field(max_length=40)
    prompt: str = Field(default="", max_length=2000)
    language: Language
    created_at: datetime
    input_method: Literal["typed", "camera", "gallery"]
    original_ocr: str | None = Field(default=None, max_length=20000)
    ocr_confidence: float | None = None
    ocr_engine_version: str | None = Field(default=None, max_length=80)
    ocr_id: uuid.UUID | None = None
    image_md5: str | None = Field(default=None, max_length=32)
    corrected_text: str = Field(max_length=20000)
    word_count: int = Field(ge=0)
    sentence_count: int = Field(ge=0)
    score: float | None = None
    grammar_score: float | None = None
    vocabulary_score: float | None = None
    spelling_score: float | None = None
    ai_status: Literal["pending", "completed", "failed"] = "pending"
    assessment: WritingFeedbackIn | None = None


class SyncOut(BaseModel):
    status: Literal["created", "updated", "unchanged"]
    id: uuid.UUID
    revision: int
    file_sha256: str | None = None
    file_md5: str | None = None
    file_bytes: int | None = None
    metrics_verified: bool | None = None


# ---------- AI ----------


class ReadingMetricsIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    accuracy: float = Field(ge=0, le=100)
    wpm: float = Field(ge=0)
    pace: str = Field(default="", max_length=20)
    substitutions: int = Field(default=0, ge=0)
    omissions: int = Field(default=0, ge=0)
    insertions: int = Field(default=0, ge=0)
    practice_words: list[str] = []


class ReadingFeedbackIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    attempt_id: uuid.UUID | None = None
    language: Language
    level: str = Field(default="", max_length=20)
    reference_text: str = Field(min_length=1, max_length=20000)
    transcript: str = Field(default="", max_length=20000)
    metrics: ReadingMetricsIn
    mistakes: list[AlignedWordIn] = []


class WritingAssessIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    attempt_id: uuid.UUID | None = None
    language: Language
    text: str = Field(min_length=1, max_length=20000)
    prompt: str = Field(default="", max_length=2000)
    grade: str = Field(default="", max_length=10)
    min_words: int = Field(default=40, ge=0, le=2000)


def _clean_list(v: list[str], limit: int) -> list[str]:
    out = []
    for s in v:
        s = s.strip()
        if s and s not in out:
            out.append(s[:300])
    return out[:limit]


class ReadingFeedbackOut(BaseModel):
    """Validated model output. Contains no numeric scores by design."""

    summary: str = Field(min_length=1, max_length=600)
    working_well: list[str]
    needs_improvement: list[str]
    suggestions: list[str]
    practice_words: list[str]
    model_version: str = ""
    prompt_version: str = ""

    @field_validator("working_well", "needs_improvement", "suggestions")
    @classmethod
    def _items(cls, v: list[str]) -> list[str]:
        return _clean_list(v, 5)

    @field_validator("practice_words")
    @classmethod
    def _words(cls, v: list[str]) -> list[str]:
        return _clean_list(v, 10)


class WritingAssessmentOut(ReadingFeedbackOut):
    practice_words: list[str] = []
    corrected: str = Field(max_length=25000)
    grammar_score: int = Field(ge=0, le=100)
    vocabulary_score: int = Field(ge=0, le=100)
    spelling_score: int = Field(ge=0, le=100)
    score: float = Field(ge=0, le=10)
    misspelled: list[str]

    @field_validator("misspelled")
    @classmethod
    def _miss(cls, v: list[str]) -> list[str]:
        return _clean_list(v, 30)


class OcrOut(BaseModel):
    ocr_id: uuid.UUID
    text: str
    confidence: float | None
    engine_version: str
    image_sha256: str


# ---------- Teacher / admin ----------


class CommentIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    student_id: uuid.UUID = Field(alias="studentId")
    text: str = Field(min_length=1, max_length=4000)
    category: Literal["Intervention", "Praise", "Parent Note", "General"]


class PassageIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: str = Field(min_length=2, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    kind: Literal["reading", "writing"]
    language: Language
    level: Level | None = None
    title: str = Field(min_length=1, max_length=200)
    kannada_title: str = Field(default="", alias="kannadaTitle", max_length=200)
    text: str = Field(min_length=1, max_length=20000)
    kannada_text: str = Field(default="", alias="kannadaText", max_length=20000)
    min_words: int | None = Field(default=None, alias="minWords", ge=0, le=2000)
    hint: str = Field(default="", max_length=1000)
    kannada_hint: str = Field(default="", alias="kannadaHint", max_length=1000)
    grade_min: int | None = Field(default=None, alias="gradeMin", ge=1, le=12)
    grade_max: int | None = Field(default=None, alias="gradeMax", ge=1, le=12)
    is_active: bool = Field(default=True, alias="isActive")


class AssignmentIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    passage_id: str = Field(alias="passageId")
    class_id: uuid.UUID = Field(alias="classId")
    due_at: datetime | None = Field(default=None, alias="dueAt")


class SchoolIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    district: str | None = Field(default=None, max_length=120)


class ClassIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    school_id: uuid.UUID = Field(alias="schoolId")
    grade: int = Field(ge=1, le=12)
    section: str = Field(min_length=1, max_length=10)


class StaffIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    email: str = Field(min_length=3, max_length=254)
    full_name: str = Field(alias="fullName", min_length=1, max_length=200)
    password: str = Field(min_length=10, max_length=128)
    role: Literal["teacher", "researcher", "admin"]
    school_id: uuid.UUID | None = Field(default=None, alias="schoolId")
    class_ids: list[uuid.UUID] = Field(default=[], alias="classIds")


class DeletionRequestIn(BaseModel):
    reason: str = Field(default="", max_length=2000)


class DeletionDecisionIn(BaseModel):
    action: Literal["complete", "reject"]
    note: str = Field(default="", max_length=2000)
