"""Comprehensive test suite for Provider-Independent Document Storage and Cloudflare R2 Abstraction."""

from datetime import datetime
import io
from pathlib import Path
import tempfile
import unittest.mock as mock
import uuid
import pytest
import botocore.exceptions
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, validate_storage_configuration
from app.core.errors import ForbiddenException, NotFoundException
from app.core.security import hash_password
from app.core.storage import (
    BaseStorageProvider,
    CloudflareR2StorageProvider,
    LocalStorageProvider,
    get_storage_provider,
    set_storage_provider,
)
from app.modules.cases.models import LegalCase
from app.modules.documents.models import Document
from app.modules.users.models import User, UserRole


# ──────────────────────────────────────────────────────────────
# 1. LocalStorageProvider Unit Tests
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_local_storage_provider_lifecycle():
    """Test full upload, read, exists, and delete lifecycle of LocalStorageProvider."""
    with tempfile.TemporaryDirectory() as temp_dir:
        provider = LocalStorageProvider(base_dir=Path(temp_dir))
        assert provider.backend_name == "local"
        assert provider.supports_presigned_urls is False

        key = "vault/cases/case_123/doc_456_evidence.pdf"
        sample_bytes = b"%PDF-1.4 test evidence document\n%%EOF"

        # 1. Initially object does not exist
        assert await provider.exists(key) is False

        # 2. Upload file
        uploaded_key = await provider.upload(
            key=key,
            content=sample_bytes,
            content_type="application/pdf",
            metadata={"case_id": "case_123"},
        )
        assert uploaded_key == key
        assert await provider.exists(key) is True

        # 3. Download file
        downloaded = await provider.download(key)
        assert downloaded == sample_bytes

        # 4. Local path resolution
        local_path = provider.get_local_path(key)
        assert local_path is not None
        assert local_path.is_file()

        # 5. Presigned URL returns None for local filesystem
        presigned = await provider.generate_download_url(key)
        assert presigned is None

        # 6. Delete file
        deleted = await provider.delete(key)
        assert deleted is True
        assert await provider.exists(key) is False


@pytest.mark.asyncio
async def test_local_storage_provider_directory_traversal_protection():
    """Verify that storage keys attempting path traversal are rejected."""
    with tempfile.TemporaryDirectory() as temp_dir:
        provider = LocalStorageProvider(base_dir=Path(temp_dir))
        traversal_key = "../../etc/passwd"

        with pytest.raises(ValueError) as exc_info:
            await provider.upload(traversal_key, b"exploit")
        assert "resolves outside vault directory" in str(exc_info.value)


@pytest.mark.asyncio
async def test_local_storage_provider_download_not_found():
    """Verify downloading a non-existent key raises NotFoundException."""
    with tempfile.TemporaryDirectory() as temp_dir:
        provider = LocalStorageProvider(base_dir=Path(temp_dir))
        with pytest.raises(NotFoundException) as exc_info:
            await provider.download("vault/non_existent.pdf")
        assert "not found in local vault" in str(exc_info.value)


# ──────────────────────────────────────────────────────────────
# 2. CloudflareR2StorageProvider Offline Mock Unit Tests
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cloudflare_r2_storage_provider_operations():
    """Verify R2 S3-compatible provider operations using a mocked boto3 client (offline)."""
    mock_s3 = mock.MagicMock()

    # Mock get_object response
    mock_body = mock.MagicMock()
    mock_body.read.return_value = b"%PDF-1.4 cloud evidence"
    mock_s3.get_object.return_value = {"Body": mock_body}

    # Mock generate_presigned_url
    mock_s3.generate_presigned_url.return_value = (
        "https://test-account.r2.cloudflarestorage.com/nyayasetu-vault/evidence.pdf?sig=test123"
    )

    provider = CloudflareR2StorageProvider(
        account_id="test_account_id",
        access_key_id="test_access_key",
        secret_access_key="test_secret_key",
        bucket_name="nyayasetu-vault",
        s3_client=mock_s3,
    )

    assert provider.backend_name == "r2"
    assert provider.supports_presigned_urls is True
    assert provider.get_local_path("test/key.pdf") is None

    test_key = "vault/cases/case_abc/doc_xyz.pdf"
    content = b"%PDF-1.4 cloud evidence"

    # 1. Test Upload
    res_key = await provider.upload(
        key=test_key,
        content=content,
        content_type="application/pdf",
        metadata={"case_id": "case_abc"},
    )
    assert res_key == test_key
    mock_s3.upload_fileobj.assert_called_once()
    call_kwargs = mock_s3.upload_fileobj.call_args[1]
    assert call_kwargs["Bucket"] == "nyayasetu-vault"
    assert call_kwargs["Key"] == test_key
    assert call_kwargs["ExtraArgs"]["ContentType"] == "application/pdf"
    assert call_kwargs["ExtraArgs"]["Metadata"] == {"case_id": "case_abc"}

    # 2. Test Download
    downloaded = await provider.download(test_key)
    assert downloaded == content
    mock_s3.get_object.assert_called_once_with(Bucket="nyayasetu-vault", Key=test_key)

    # 3. Test Exists
    mock_s3.head_object.return_value = {"ContentLength": 100}
    exists = await provider.exists(test_key)
    assert exists is True
    mock_s3.head_object.assert_called_once_with(Bucket="nyayasetu-vault", Key=test_key)

    # 4. Test Presigned URL Generation
    url = await provider.generate_download_url(
        key=test_key,
        expiry_seconds=600,
        filename="evidence.pdf",
    )
    assert url == "https://test-account.r2.cloudflarestorage.com/nyayasetu-vault/evidence.pdf?sig=test123"
    mock_s3.generate_presigned_url.assert_called_once_with(
        ClientMethod="get_object",
        Params={
            "Bucket": "nyayasetu-vault",
            "Key": test_key,
            "ResponseContentDisposition": 'attachment; filename="evidence.pdf"',
        },
        ExpiresIn=600,
    )

    # 5. Test Delete
    deleted = await provider.delete(test_key)
    assert deleted is True
    mock_s3.delete_object.assert_called_once_with(Bucket="nyayasetu-vault", Key=test_key)


@pytest.mark.asyncio
async def test_cloudflare_r2_download_not_found():
    """Verify that R2 404 / NoSuchKey errors are translated to NotFoundException."""
    mock_s3 = mock.MagicMock()
    client_error = botocore.exceptions.ClientError(
        error_response={"Error": {"Code": "NoSuchKey", "Message": "The specified key does not exist."}},
        operation_name="GetObject",
    )
    mock_s3.get_object.side_effect = client_error

    provider = CloudflareR2StorageProvider(
        account_id="test_account",
        access_key_id="key",
        secret_access_key="secret",
        bucket_name="vault",
        s3_client=mock_s3,
    )

    with pytest.raises(NotFoundException) as exc_info:
        await provider.download("missing_key.pdf")
    assert "was not found in storage" in str(exc_info.value)


# ──────────────────────────────────────────────────────────────
# 3. Production Configuration Fail-Safe Validation Tests
# ──────────────────────────────────────────────────────────────

def test_production_fails_safely_if_local_storage_attempted():
    """Requirement 5: Production must fail startup if STORAGE_PROVIDER / STORAGE_BACKEND is 'local'."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        STORAGE_PROVIDER="local",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="valid-key",
    )
    with pytest.raises(RuntimeError) as exc_info:
        validate_storage_configuration(prod_settings)
    assert "STORAGE_PROVIDER cannot be 'local' in production" in str(exc_info.value)
    assert "Local filesystem storage is prohibited in production" in str(exc_info.value)


def test_production_fails_safely_if_r2_credentials_missing():
    """Requirement 5 & 9: Production must fail startup if R2 credentials are missing with safe error messages."""
    # Missing STORAGE_ACCESS_KEY_ID
    prod_settings = Settings(
        ENVIRONMENT="production",
        STORAGE_PROVIDER="r2",
        STORAGE_ENDPOINT_URL="https://test.r2.cloudflarestorage.com",
        STORAGE_BUCKET="vault",
        STORAGE_ACCESS_KEY_ID="",
        STORAGE_SECRET_ACCESS_KEY="sec123",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="valid-key",
    )
    with pytest.raises(RuntimeError) as exc_info:
        validate_storage_configuration(prod_settings)
    assert "STORAGE_ACCESS_KEY_ID is required in production" in str(exc_info.value)
    assert "sec123" not in str(exc_info.value)  # Never expose secrets in error message

    # Missing STORAGE_SECRET_ACCESS_KEY
    prod_settings_2 = Settings(
        ENVIRONMENT="production",
        STORAGE_PROVIDER="r2",
        STORAGE_ENDPOINT_URL="https://test.r2.cloudflarestorage.com",
        STORAGE_BUCKET="vault",
        STORAGE_ACCESS_KEY_ID="key123",
        STORAGE_SECRET_ACCESS_KEY="",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="valid-key",
    )
    with pytest.raises(RuntimeError) as exc_info:
        validate_storage_configuration(prod_settings_2)
    assert "STORAGE_SECRET_ACCESS_KEY is required in production" in str(exc_info.value)

    # Missing STORAGE_BUCKET
    prod_settings_3 = Settings(
        ENVIRONMENT="production",
        STORAGE_PROVIDER="r2",
        STORAGE_ENDPOINT_URL="https://test.r2.cloudflarestorage.com",
        STORAGE_BUCKET="",
        STORAGE_ACCESS_KEY_ID="key123",
        STORAGE_SECRET_ACCESS_KEY="sec123",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="valid-key",
    )
    with pytest.raises(RuntimeError) as exc_info:
        validate_storage_configuration(prod_settings_3)
    assert "STORAGE_BUCKET is required in production" in str(exc_info.value)

    # Missing STORAGE_ENDPOINT_URL
    prod_settings_4 = Settings(
        ENVIRONMENT="production",
        STORAGE_PROVIDER="r2",
        STORAGE_ENDPOINT_URL="",
        STORAGE_BUCKET="vault",
        STORAGE_ACCESS_KEY_ID="key123",
        STORAGE_SECRET_ACCESS_KEY="sec123",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="valid-key",
    )
    with pytest.raises(RuntimeError) as exc_info:
        validate_storage_configuration(prod_settings_4)
    assert "STORAGE_ENDPOINT_URL must be configured for Cloudflare R2" in str(exc_info.value)


def test_production_succeeds_with_valid_r2_configuration():
    """Verify production startup validation passes when R2 environment variables are properly configured."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        STORAGE_PROVIDER="r2",
        STORAGE_BUCKET="nyayasetu-vault-production",
        STORAGE_ENDPOINT_URL="https://cf_account_12345.r2.cloudflarestorage.com",
        STORAGE_REGION="auto",
        STORAGE_ACCESS_KEY_ID="r2_access_key_12345",
        STORAGE_SECRET_ACCESS_KEY="r2_secret_key_12345",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="valid-key",
    )
    # Should not raise any exception
    validate_storage_configuration(prod_settings)
    assert prod_settings.effective_storage_provider == "r2"
    assert prod_settings.effective_storage_region == "auto"
    assert prod_settings.effective_storage_endpoint_url == "https://cf_account_12345.r2.cloudflarestorage.com"
    assert prod_settings.effective_storage_bucket == "nyayasetu-vault-production"


def test_cloudflare_r2_initialization_with_explicit_region_auto():
    """Requirement 3: Verify CloudflareR2StorageProvider uses region 'auto' and S3-compatible SigV4."""
    with mock.patch("boto3.client") as mock_boto:
        provider = CloudflareR2StorageProvider(
            endpoint_url="https://account_123.r2.cloudflarestorage.com",
            bucket_name="nyayasetu-vault-production",
            access_key_id="key123",
            secret_access_key="sec123",
            region="auto",
        )
        assert provider.backend_name == "r2"
        assert provider.region == "auto"
        mock_boto.assert_called_once()
        call_kwargs = mock_boto.call_args[1]
        assert call_kwargs["region_name"] == "auto"
        assert call_kwargs["endpoint_url"] == "https://account_123.r2.cloudflarestorage.com"
        assert call_kwargs["aws_access_key_id"] == "key123"
        assert call_kwargs["aws_secret_access_key"] == "sec123"
        assert call_kwargs["config"].signature_version == "s3v4"


def test_development_allows_local_storage():
    """Verify development mode cleanly permits local storage backend."""
    dev_settings = Settings(
        ENVIRONMENT="development",
        STORAGE_BACKEND="local",
        AI_PROVIDER="mock",
    )
    # Should not raise
    validate_storage_configuration(dev_settings)


# ──────────────────────────────────────────────────────────────
# 4. End-to-End API Integration Tests (Upload, Metadata, Token, Download, Delete)
# ──────────────────────────────────────────────────────────────

async def setup_test_citizen_and_case(async_client: AsyncClient) -> tuple[str, str, str]:
    """Helper creating citizen and legal case, returning (citizen_id, token, case_id)."""
    random_id = uuid.uuid4().hex[:8]
    email = f"storage.test.{random_id}@example.com"
    phone = f"+9198{random_id[:8]}"
    reg_payload = {
        "account_type": "CITIZEN",
        "full_name": "Meera Sen",
        "email": email,
        "phone": phone,
        "password": "CitizenPassword2026",
        "preferred_language": "en",
    }
    reg_res = await async_client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    citizen_id = reg_res.json()["id"]

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "CitizenPassword2026"},
    )
    token = login_res.json()["access_token"]

    case_payload = {
        "title": "Property Boundary Dispute",
        "problem_description": "Encroachment by neighbour on ancestral residential plot in Delhi.",
        "legal_issue_category": "Property Disputes",
        "state": "Delhi",
        "district": "South Delhi",
        "relevant_court": "Saket District Court",
        "incident_date": "2026-02-15",
        "preferred_language": "en",
        "urgency": "MEDIUM",
    }
    case_res = await async_client.post(
        "/api/v1/cases",
        json=case_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    return citizen_id, token, case_id


@pytest.mark.asyncio
async def test_document_upload_records_storage_backend_and_key(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify upload records storage_backend and storage_key in PostgreSQL."""
    citizen_id, token, case_id = await setup_test_citizen_and_case(async_client)

    pdf_content = b"%PDF-1.4 sale deed contract document\n%%EOF"
    files = {"file": ("sale_deed.pdf", io.BytesIO(pdf_content), "application/pdf")}
    data = {"document_category": "CONTRACT", "is_confidential": "true"}

    upload_res = await async_client.post(
        f"/api/v1/documents/cases/{case_id}/upload",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
        data=data,
    )
    assert upload_res.status_code == 201
    doc_json = upload_res.json()
    doc_id = doc_json["id"]

    assert doc_json["storage_backend"] == "local"
    assert doc_json["file_name"] == "sale_deed.pdf"
    assert doc_json["storage_key"].startswith(f"vault/cases/{case_id}/")
    # Requirement 5: Unpredictable object keys - original filename is not in storage_key
    assert "sale_deed" not in doc_json["storage_key"]
    assert doc_json["storage_key"].endswith(".pdf")

    # Verify directly in database
    db_res = await db_session.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
    doc = db_res.scalar_one_or_none()
    assert doc is not None
    assert doc.storage_backend == "local"
    assert doc.storage_key == doc_json["storage_key"]


@pytest.mark.asyncio
async def test_document_deletion_lifecycle(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify document deletion removes file from storage and record from database."""
    citizen_id, token, case_id = await setup_test_citizen_and_case(async_client)

    pdf_content = b"%PDF-1.4 temporary document to delete\n%%EOF"
    upload_res = await async_client.post(
        f"/api/v1/documents/cases/{case_id}/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("to_delete.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # Delete document
    del_res = await async_client.delete(
        f"/api/v1/documents/{doc_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Verify document is gone from database
    db_res = await db_session.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
    assert db_res.scalar_one_or_none() is None

    # Verify downloading returns 404
    get_res = await async_client.get(
        f"/api/v1/documents/{doc_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_r2_provider_download_redirect_flow(
    async_client: AsyncClient,
):
    """Verify that when Cloudflare R2 provider is active, download redirects (HTTP 307) to presigned URL."""
    citizen_id, token, case_id = await setup_test_citizen_and_case(async_client)

    # 1. Upload in local mode first
    pdf_content = b"%PDF-1.4 document for redirect test\n%%EOF"
    upload_res = await async_client.post(
        f"/api/v1/documents/cases/{case_id}/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("r2_test.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # 2. Mock R2 provider
    mock_s3 = mock.MagicMock()
    presigned_target = "https://nyayasetu-r2.cloudflarestorage.com/download/presigned-sig"
    mock_s3.generate_presigned_url.return_value = presigned_target
    mock_s3.head_object.return_value = {"ContentLength": 100}

    r2_mock_provider = CloudflareR2StorageProvider(
        account_id="mock_acc",
        access_key_id="mock_key",
        secret_access_key="mock_sec",
        bucket_name="nyayasetu-vault",
        s3_client=mock_s3,
    )

    try:
        # Override active storage provider
        set_storage_provider(r2_mock_provider)

        # 3. Request download token
        token_res = await async_client.get(
            f"/api/v1/documents/{doc_id}/access-token",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert token_res.status_code == 200
        # download_url is the presigned R2 URL directly!
        assert token_res.json()["download_url"] == presigned_target

        # 4. Request /download endpoint with Bearer auth -> receives HTTP 307 redirect
        download_res = await async_client.get(
            f"/api/v1/documents/{doc_id}/download",
            headers={"Authorization": f"Bearer {token}"},
            follow_redirects=False,
        )
        assert download_res.status_code == 307
        assert download_res.headers["location"] == presigned_target
    finally:
        # Reset storage provider back to default
        set_storage_provider(None)


# ──────────────────────────────────────────────────────────────
# 5. Document Vault Hardening & Security Tests
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_unauthenticated_document_upload_rejected(
    async_client: AsyncClient,
):
    """Requirement 1: Enforce that unauthenticated uploads are strictly rejected (401)."""
    random_case_id = uuid.uuid4()
    pdf_content = b"%PDF-1.4 unauthenticated upload attempt\n%%EOF"

    res = await async_client.post(
        f"/api/v1/documents/cases/{random_case_id}/upload",
        files={"file": ("unauth.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_cross_tenant_document_access_and_deletion_rejected(
    async_client: AsyncClient,
):
    """Requirement 2: Verify Citizen B cannot view, download, or delete Citizen A's documents (403)."""
    # Citizen A creates case and uploads document
    _, token_a, case_a_id = await setup_test_citizen_and_case(async_client)
    pdf_content = b"%PDF-1.4 confidential case evidence\n%%EOF"

    upload_res = await async_client.post(
        f"/api/v1/documents/cases/{case_a_id}/upload",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("case_a_evidence.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # Citizen B registers
    _, token_b, _ = await setup_test_citizen_and_case(async_client)

    # 1. Citizen B tries to get document metadata -> 403
    meta_res = await async_client.get(
        f"/api/v1/documents/{doc_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert meta_res.status_code == 403

    # 2. Citizen B tries to request download token -> 403
    token_res = await async_client.get(
        f"/api/v1/documents/{doc_id}/access-token",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert token_res.status_code == 403

    # 3. Citizen B tries to download directly with their Bearer token -> 403
    dl_res = await async_client.get(
        f"/api/v1/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert dl_res.status_code == 403

    # 4. Citizen B tries to delete Citizen A's document -> 403
    del_res = await async_client.delete(
        f"/api/v1/documents/{doc_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert del_res.status_code == 403


@pytest.mark.asyncio
async def test_invalid_file_extension_and_content_signature_spoofing(
    async_client: AsyncClient,
):
    """Requirement 3: Validate extensions, MIME types, and magic bytes to prevent payload disguise."""
    _, token, case_id = await setup_test_citizen_and_case(async_client)

    # 1. Disallowed extension (.exe)
    res_exe = await async_client.post(
        f"/api/v1/documents/cases/{case_id}/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("payload.exe", io.BytesIO(b"MZ\x90\x00executable"), "application/octet-stream")},
    )
    assert res_exe.status_code == 400
    assert "File extension '.exe' is not permitted" in res_exe.json()["error"]["message"]

    # 2. Extension spoofing: .pdf extension with executable binary content
    fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00not a real pdf payload"
    res_spoof_pdf = await async_client.post(
        f"/api/v1/documents/cases/{case_id}/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("disguised_virus.pdf", io.BytesIO(fake_pdf), "application/pdf")},
    )
    assert res_spoof_pdf.status_code == 400
    assert "File content signature does not match PDF format" in res_spoof_pdf.json()["error"]["message"]

    # 3. Extension spoofing: .png extension with plain text content
    fake_png = b"just a plain text file pretending to be an image"
    res_spoof_png = await async_client.post(
        f"/api/v1/documents/cases/{case_id}/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("fake_image.png", io.BytesIO(fake_png), "image/png")},
    )
    assert res_spoof_png.status_code == 400
    assert "File content signature does not match PNG format" in res_spoof_png.json()["error"]["message"]


@pytest.mark.asyncio
async def test_oversized_file_rejected_at_10mb(
    async_client: AsyncClient,
):
    """Requirement 4: Enforce that individual uploads exceeding 10 MB are rejected."""
    _, token, case_id = await setup_test_citizen_and_case(async_client)

    # Create oversized PDF (10 MB + 1024 bytes)
    oversized_pdf = b"%PDF-1.4 " + (b"A" * (10 * 1024 * 1024 + 1024))
    res = await async_client.post(
        f"/api/v1/documents/cases/{case_id}/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("oversized.pdf", io.BytesIO(oversized_pdf), "application/pdf")},
    )
    assert res.status_code == 400
    assert "File exceeds maximum allowed upload size of 10MB" in res.json()["error"]["message"]


@pytest.mark.asyncio
async def test_user_quota_and_document_count_enforcement(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Requirement 6: Enforce configurable per-user storage quota and max documents limit without silent deletion."""
    _, token, case_id = await setup_test_citizen_and_case(async_client)
    sample_pdf = b"%PDF-1.4 test document content for quota validation\n%%EOF"

    # 1. Test per-user document count limit (configured to 2)
    with mock.patch("app.modules.documents.service.settings.STORAGE_USER_MAX_DOCUMENTS", 2):
        # Upload 1st document
        res1 = await async_client.post(
            f"/api/v1/documents/cases/{case_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("doc_1.pdf", io.BytesIO(sample_pdf), "application/pdf")},
        )
        assert res1.status_code == 201

        # Upload 2nd document
        res2 = await async_client.post(
            f"/api/v1/documents/cases/{case_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("doc_2.pdf", io.BytesIO(sample_pdf), "application/pdf")},
        )
        assert res2.status_code == 201

        # Upload 3rd document -> rejected
        res3 = await async_client.post(
            f"/api/v1/documents/cases/{case_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("doc_3.pdf", io.BytesIO(sample_pdf), "application/pdf")},
        )
        assert res3.status_code == 400
        assert "User document limit of 2 documents reached" in res3.json()["error"]["message"]

        # Invariant: Verify previous documents were NOT silently deleted
        list_res = await async_client.get(
            f"/api/v1/documents/cases/{case_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert list_res.status_code == 200
        assert list_res.json()["total"] == 2

    # 2. Test per-user storage quota (configured to 150 bytes)
    with mock.patch("app.modules.documents.service.settings.STORAGE_USER_QUOTA_BYTES", 150):
        # User already has 2 documents uploaded (~110 bytes total). Attempting 3rd upload pushes over 150 bytes
        res_quota = await async_client.post(
            f"/api/v1/documents/cases/{case_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("quota_overflow.pdf", io.BytesIO(sample_pdf), "application/pdf")},
        )
        assert res_quota.status_code == 400
        assert "User storage quota of" in res_quota.json()["error"]["message"]


@pytest.mark.asyncio
async def test_application_total_storage_capacity_limit(
    async_client: AsyncClient,
):
    """Requirement 5: Enforce application-level total storage limit (8 GB) without describing as Cloudflare cap."""
    _, token, case_id = await setup_test_citizen_and_case(async_client)
    sample_pdf = b"%PDF-1.4 test document content for total capacity check\n%%EOF"

    # Patch application total capacity to a tiny limit (50 bytes)
    with mock.patch("app.modules.documents.service.settings.STORAGE_TOTAL_CAPACITY_BYTES", 50):
        res = await async_client.post(
            f"/api/v1/documents/cases/{case_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("capacity_test.pdf", io.BytesIO(sample_pdf), "application/pdf")},
        )
        assert res.status_code == 400
        err_msg = res.json()["error"]["message"]
        assert "Application storage capacity limit reached" in err_msg
        # Invariant: Do not describe application limits as Cloudflare billing caps
        assert "cloudflare" not in err_msg.lower()
        assert "billing" not in err_msg.lower()


@pytest.mark.asyncio
async def test_user_upload_rate_limiting(
    async_client: AsyncClient,
):
    """Requirement 6: Enforce configurable per-user upload rate limits."""
    _, token, case_id = await setup_test_citizen_and_case(async_client)
    sample_pdf = b"%PDF-1.4 test document for rate limiting\n%%EOF"

    # Patch rate limit to 2 uploads per hour
    with mock.patch("app.modules.documents.service.settings.STORAGE_USER_UPLOAD_RATE_LIMIT_PER_HOUR", 2):
        # 1st upload
        res1 = await async_client.post(
            f"/api/v1/documents/cases/{case_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("rate_1.pdf", io.BytesIO(sample_pdf), "application/pdf")},
        )
        assert res1.status_code == 201

        # 2nd upload
        res2 = await async_client.post(
            f"/api/v1/documents/cases/{case_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("rate_2.pdf", io.BytesIO(sample_pdf), "application/pdf")},
        )
        assert res2.status_code == 201

        # 3rd upload within the hour -> throttled
        res3 = await async_client.post(
            f"/api/v1/documents/cases/{case_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("rate_3.pdf", io.BytesIO(sample_pdf), "application/pdf")},
        )
        assert res3.status_code == 400
        assert "Upload rate limit exceeded" in res3.json()["error"]["message"]


@pytest.mark.asyncio
async def test_failed_upload_cleanup_atomicity(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Requirement 10: Failed uploads do not leave misleading database records or orphaned storage objects."""
    _, token, case_id = await setup_test_citizen_and_case(async_client)
    sample_pdf = b"%PDF-1.4 test content for atomicity failure test\n%%EOF"

    # Create mock storage provider that tracks upload and delete
    mock_provider = mock.MagicMock(spec=BaseStorageProvider)
    mock_provider.backend_name = "mock_atomic"
    mock_provider.supports_presigned_urls = False
    mock_provider.get_local_path.return_value = None

    uploaded_keys = []
    deleted_keys = []

    async def mock_upload(key, content, content_type, metadata):
        uploaded_keys.append(key)
        return key

    async def mock_delete(key):
        deleted_keys.append(key)
        return True

    mock_provider.upload.side_effect = mock_upload
    mock_provider.delete.side_effect = mock_delete

    # Simulate database commit failure with active mock_provider
    try:
        set_storage_provider(mock_provider)
        with mock.patch("sqlalchemy.ext.asyncio.AsyncSession.commit", side_effect=RuntimeError("Simulated DB Crash")):
            with pytest.raises(RuntimeError):
                await async_client.post(
                    f"/api/v1/documents/cases/{case_id}/upload",
                    headers={"Authorization": f"Bearer {token}"},
                    files={"file": ("atomic_fail.pdf", io.BytesIO(sample_pdf), "application/pdf")},
                )
    finally:
        set_storage_provider(None)

    # 1. Verify that the file was deleted from storage provider (no orphaned objects)
    assert len(uploaded_keys) == 1
    assert len(deleted_keys) == 1
    assert uploaded_keys[0] == deleted_keys[0]

    # 2. Verify no document was saved in database
    db_res = await db_session.execute(
        select(Document).where(Document.file_name == "atomic_fail.pdf")
    )
    assert db_res.scalar_one_or_none() is None

