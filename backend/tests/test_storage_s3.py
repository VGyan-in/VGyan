import hashlib
import io

import boto3
import pytest
from moto import mock_aws

from app.core.config import get_settings
from app.services.storage import S3Storage, spool_upload
from tests.conftest import wav_bytes


@pytest.fixture
def s3(monkeypatch):
    with mock_aws():
        boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="vgyan-test")
        s = get_settings()
        monkeypatch.setattr(s, "s3_bucket", "vgyan-test")
        monkeypatch.setattr(s, "s3_region", "us-east-1")
        monkeypatch.setattr(s, "s3_endpoint_url", None)
        monkeypatch.setattr(s, "s3_access_key_id", "test")
        monkeypatch.setattr(s, "s3_secret_access_key", "test")
        yield S3Storage()


def test_s3_put_is_write_once_and_private(s3):
    data = wav_bytes()
    up = spool_upload(io.BytesIO(data), "audio")
    key = f"audio/VG-1/x/{up.sha256}.wav"
    s3.put_file(key, up.path, up.mime)
    s3.put_file(key, up.path, up.mime)  # idempotent
    assert s3.exists(key) and hashlib.sha256(s3.get_bytes(key)).hexdigest() == up.sha256
    url = s3.signed_url(key, 60)
    assert "X-Amz-Signature" in url and "X-Amz-Expires=60" in url
    acl = s3.client.get_object_acl(Bucket="vgyan-test", Key=key)
    assert all(g["Grantee"].get("URI") is None for g in acl["Grants"])  # no public grants
    s3.ping()


def test_size_limit(monkeypatch):
    monkeypatch.setattr(get_settings(), "max_image_mb", 0)
    from app.core.errors import ApiError

    with pytest.raises(ApiError) as e:
        spool_upload(io.BytesIO(b"\xff\xd8\xff" + b"0" * 100), "image")
    assert e.value.status == 413


def test_production_config_guards():
    from pydantic import ValidationError

    from app.core.config import Settings

    with pytest.raises(ValidationError):
        Settings(env="production", jwt_secret="short", storage_backend="s3", s3_bucket="b")
    with pytest.raises(ValidationError):
        Settings(env="production", jwt_secret="x" * 40, storage_backend="local")
    ok = Settings(env="production", jwt_secret="x" * 40, storage_backend="s3", s3_bucket="b", database_url="postgres://u:p@h/db")
    assert ok.database_url.startswith("postgresql+psycopg://")
