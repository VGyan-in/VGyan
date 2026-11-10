from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration comes from environment variables (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://vgyan:vgyan@localhost:5433/vgyan"

    jwt_secret: str = "dev-only-insecure-secret-change-me-000000"
    jwt_algorithm: str = "HS256"
    student_token_ttl_days: int = 30
    staff_token_ttl_hours: int = 12

    cors_origins: str = "http://localhost:5173"

    storage_backend: Literal["local", "s3"] = "local"
    local_storage_dir: str = "./var/storage"
    s3_bucket: str = ""
    s3_endpoint_url: str | None = None
    s3_region: str = "auto"
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    signed_url_ttl_seconds: int = 300

    max_audio_mb: int = 30
    max_image_mb: int = 12

    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_seconds: float = 60.0

    # "gemini": Gemini vision with a transcription-only prompt (no confidence score).
    # "google_vision": Cloud Vision DOCUMENT_TEXT_DETECTION (returns confidence).
    # "none": OCR disabled; the app falls back to typed input.
    ocr_provider: Literal["gemini", "google_vision", "none"] = "gemini"
    google_vision_api_key: str | None = None

    allow_student_registration: bool = True
    rate_limit_enabled: bool = True
    public_base_url: str = "http://localhost:8000"

    # Consent text version the app currently shows. Older versions are still accepted
    # (they were valid when signed) but reported to teachers as needing renewal.
    consent_version: str = "1.0"

    @field_validator("database_url")
    @classmethod
    def _normalise_db_url(cls, v: str) -> str:
        # Hosts such as Railway/Heroku hand out postgres:// URLs; SQLAlchemy needs the driver name.
        if v.startswith("postgres://"):
            return "postgresql+psycopg://" + v[len("postgres://") :]
        if v.startswith("postgresql://"):
            return "postgresql+psycopg://" + v[len("postgresql://") :]
        return v

    @model_validator(mode="after")
    def _production_guards(self) -> "Settings":
        if self.env == "production":
            if self.jwt_secret.startswith("dev-only") or len(self.jwt_secret) < 32:
                raise ValueError("JWT_SECRET must be a random value of at least 32 characters in production")
            if self.storage_backend != "s3" or not self.s3_bucket:
                raise ValueError("Production requires STORAGE_BACKEND=s3 and S3_BUCKET (a private bucket)")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
