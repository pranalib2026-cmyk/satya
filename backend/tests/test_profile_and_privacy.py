"""Integration tests for User Profile Dossier, DPDP Consent Ledger, Data Export, and Account Erasure."""

import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.modules.auth.models import RefreshToken
from app.modules.cases.models import LegalCase
from app.modules.documents.models import Document
from app.modules.users.models import User, UserConsent
from tests.conftest import TestingAsyncSessionLocal


@pytest_asyncio.fixture
async def citizen_auth_headers(async_client: AsyncClient, db_session: AsyncSession):
    """Fixture providing an authenticated citizen session and headers."""
    password = "TestCitizenPass123!"
    citizen = User(
        email=f"citizen_{uuid.uuid4().hex[:8]}@example.com",
        phone=f"+9198{uuid.uuid4().hex[:8]}",
        password_hash=hash_password(password),
        full_name="Rajesh Sharma",
        role="CITIZEN",
        is_verified=True,
        is_active=True,
        preferred_language="en",
        city="Pune",
        state="Maharashtra",
    )
    db_session.add(citizen)
    await db_session.commit()
    await db_session.refresh(citizen)

    # Login to obtain real JWT
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": citizen.email, "password": password},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    refresh_token = login_res.json()["refresh_token"]

    return {
        "headers": {"Authorization": f"Bearer {token}"},
        "user": citizen,
        "password": password,
        "token": token,
        "refresh_token": refresh_token,
    }


@pytest_asyncio.fixture
async def second_citizen_auth_headers(async_client: AsyncClient, db_session: AsyncSession):
    """Fixture providing a second authenticated citizen session."""
    password = "SecondCitizenPass123!"
    citizen2 = User(
        email=f"second_{uuid.uuid4().hex[:8]}@example.com",
        phone=f"+9199{uuid.uuid4().hex[:8]}",
        password_hash=hash_password(password),
        full_name="Pooja Verma",
        role="CITIZEN",
        is_verified=True,
        is_active=True,
        preferred_language="hi",
        city="Mumbai",
        state="Maharashtra",
    )
    db_session.add(citizen2)
    await db_session.commit()
    await db_session.refresh(citizen2)

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": citizen2.email, "password": password},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    return {
        "headers": {"Authorization": f"Bearer {token}"},
        "user": citizen2,
        "password": password,
        "token": token,
    }


@pytest.mark.asyncio
async def test_get_user_profile(async_client: AsyncClient, citizen_auth_headers):
    """Test GET /users/me returns authenticated user's actual record."""
    res = await async_client.get("/api/v1/users/me", headers=citizen_auth_headers["headers"])
    assert res.status_code == 200
    data = res.json()
    user = citizen_auth_headers["user"]

    assert data["id"] == str(user.id)
    assert data["email"] == user.email
    assert data["full_name"] == "Rajesh Sharma"
    assert data["role"] == "CITIZEN"
    assert data["city"] == "Pune"
    assert data["state"] == "Maharashtra"
    assert data["preferred_language"] == "en"


@pytest.mark.asyncio
async def test_update_user_profile_success(async_client: AsyncClient, citizen_auth_headers):
    """Test PUT /users/me updates permissible fields and persists changes."""
    user_id = citizen_auth_headers["user"].id
    update_payload = {
        "full_name": "Rajesh V. Sharma",
        "city": "Bengaluru",
        "state": "Karnataka",
        "preferred_language": "kn",
    }
    res = await async_client.put(
        "/api/v1/users/me",
        headers=citizen_auth_headers["headers"],
        json=update_payload,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["full_name"] == "Rajesh V. Sharma"
    assert data["city"] == "Bengaluru"
    assert data["state"] == "Karnataka"
    assert data["preferred_language"] == "kn"

    # Verify directly from DB in fresh session
    async with TestingAsyncSessionLocal() as fresh_db:
        user_db = await fresh_db.scalar(select(User).where(User.id == user_id))
        assert user_db.full_name == "Rajesh V. Sharma"
        assert user_db.city == "Bengaluru"
        assert user_db.state == "Karnataka"
        assert user_db.preferred_language == "kn"


@pytest.mark.asyncio
async def test_update_user_profile_duplicate_email_conflict(
    async_client: AsyncClient,
    citizen_auth_headers,
    second_citizen_auth_headers,
):
    """Test PUT /users/me rejects duplicate email with 409 ConflictException."""
    res = await async_client.put(
        "/api/v1/users/me",
        headers=citizen_auth_headers["headers"],
        json={"email": second_citizen_auth_headers["user"].email},
    )
    assert res.status_code == 409
    body = res.json()
    assert body["error"]["code"] == "CONFLICT"
    assert "already registered" in body["error"]["message"]


@pytest.mark.asyncio
async def test_update_user_profile_forbid_privileged_fields(async_client: AsyncClient, citizen_auth_headers):
    """Test PUT /users/me rejects tampering with role, is_verified, or id."""
    res = await async_client.put(
        "/api/v1/users/me",
        headers=citizen_auth_headers["headers"],
        json={"role": "ADMIN", "is_verified": True},
    )
    assert res.status_code == 422  # Pydantic extra='forbid' validation error


@pytest.mark.asyncio
async def test_dpdp_consent_grant_and_retrieval(async_client: AsyncClient, citizen_auth_headers):
    """Test recording and listing DPDP consent ledger entries."""
    grant_payload = {
        "consent_type": "share_brief",
        "version": "1.0",
        "purpose": "Transmission of case synopsis to empanelled trial counsel",
        "advocate_id": "adv_karnataka_882",
        "items_shared": ["Matter Summary", "Demand Notice 2026"],
    }
    res = await async_client.post(
        "/api/v1/users/me/consents",
        headers=citizen_auth_headers["headers"],
        json=grant_payload,
    )
    assert res.status_code == 201
    consent_data = res.json()
    assert consent_data["consent_type"] == "share_brief"
    assert consent_data["action"] == "GRANTED"
    assert consent_data["is_revoked"] is False
    assert consent_data["advocate_id"] == "adv_karnataka_882"
    assert len(consent_data["items_shared"]) == 2

    # Query list
    list_res = await async_client.get("/api/v1/users/me/consents", headers=citizen_auth_headers["headers"])
    assert list_res.status_code == 200
    status_data = list_res.json()
    assert status_data["active_count"] >= 1
    assert any(c["id"] == consent_data["id"] for c in status_data["consents"])


@pytest.mark.asyncio
async def test_dpdp_consent_withdrawal_and_immutable_audit_trail(async_client: AsyncClient, citizen_auth_headers):
    """Test revoking consent and verifying immutable audit ledger."""
    # 1. Grant consent
    grant_res = await async_client.post(
        "/api/v1/users/me/consents",
        headers=citizen_auth_headers["headers"],
        json={
            "consent_type": "share_documents",
            "version": "1.0",
            "purpose": "Allow counsel review of tenancy agreement",
        },
    )
    assert grant_res.status_code == 201
    consent_id = grant_res.json()["id"]

    # 2. Withdraw consent
    revoke_res = await async_client.post(
        f"/api/v1/users/me/consents/{consent_id}/withdraw",
        headers=citizen_auth_headers["headers"],
    )
    assert revoke_res.status_code == 200
    revoked = revoke_res.json()
    assert revoked["is_revoked"] is True
    assert revoked["revoked_at"] is not None

    # 3. Repeat withdrawal is rejected
    repeat_res = await async_client.post(
        f"/api/v1/users/me/consents/{consent_id}/withdraw",
        headers=citizen_auth_headers["headers"],
    )
    assert repeat_res.status_code == 400

    # 4. Check audit history - both GRANT and WITHDRAWN records exist
    history_res = await async_client.get(
        "/api/v1/users/me/consents/history",
        headers=citizen_auth_headers["headers"],
    )
    assert history_res.status_code == 200
    history = history_res.json()
    actions = [h["action"] for h in history if h["consent_type"] == "share_documents"]
    assert "GRANTED" in actions
    assert "WITHDRAWN" in actions


@pytest.mark.asyncio
async def test_cross_tenant_consent_access_forbidden(
    async_client: AsyncClient,
    citizen_auth_headers,
    second_citizen_auth_headers,
):
    """Test that users cannot view or revoke another citizen's consent."""
    # Citizen 1 grants consent
    grant_res = await async_client.post(
        "/api/v1/users/me/consents",
        headers=citizen_auth_headers["headers"],
        json={
            "consent_type": "terms",
            "version": "2.0",
            "purpose": "Platform service agreement",
        },
    )
    consent_id = grant_res.json()["id"]

    # Citizen 2 attempts to revoke Citizen 1's consent
    unauthorized_res = await async_client.post(
        f"/api/v1/users/me/consents/{consent_id}/withdraw",
        headers=second_citizen_auth_headers["headers"],
    )
    assert unauthorized_res.status_code == 404


@pytest.mark.asyncio
async def test_data_export_ownership_and_privacy(
    async_client: AsyncClient,
    citizen_auth_headers,
    second_citizen_auth_headers,
    db_session: AsyncSession,
):
    """Test POST /users/me/data-export exports authenticated user's actual data without leaks."""
    user = citizen_auth_headers["user"]

    # Attach a case and document to Citizen 1
    legal_case = LegalCase(
        case_reference=f"NYA-EXP-{uuid.uuid4().hex[:6].upper()}",
        client_id=user.id,
        title="Dispute with Commercial Lessor",
        practice_group="Trials & Disputes",
        matter_type="Civil Suit",
        summary="Lease agreement security deposit default",
    )
    db_session.add(legal_case)
    await db_session.commit()

    doc = Document(
        uploader_id=user.id,
        case_id=legal_case.id,
        file_name="Lease_Agreement_2025.pdf",
        storage_path="storage/vault/lease.pdf",
        file_size_bytes=42000,
        mime_type="application/pdf",
        checksum_sha256="abcd1234efgh5678" * 4,
        storage_backend="local",
        storage_key="exports/test/lease.pdf",
    )
    db_session.add(doc)
    await db_session.commit()

    # Request export
    res = await async_client.post("/api/v1/users/me/data-export", headers=citizen_auth_headers["headers"])
    assert res.status_code == 200
    export_payload = res.json()

    assert export_payload["status"] == "COMPLETED"
    assert export_payload["user_id"] == str(user.id)
    assert export_payload["download_url"] is not None

    data = export_payload["data"]
    assert data["profile"]["email"] == user.email
    assert "password_hash" not in data["profile"]
    assert len(data["legal_cases"]) >= 1
    assert data["legal_cases"][0]["title"] == "Dispute with Commercial Lessor"
    assert len(data["vault_documents_metadata"]) >= 1
    assert data["vault_documents_metadata"][0]["file_name"] == "Lease_Agreement_2025.pdf"

    # Verify second citizen's data is NOT in Citizen 1's export
    assert second_citizen_auth_headers["user"].email not in str(export_payload)


@pytest.mark.asyncio
async def test_account_deletion_requires_explicit_confirmation(async_client: AsyncClient, citizen_auth_headers):
    """Test DELETE /users/me fails if confirmation string is not exact."""
    res = await async_client.request(
        "DELETE",
        "/api/v1/users/me",
        headers=citizen_auth_headers["headers"],
        json={"confirmation": "please delete me"},
    )
    assert res.status_code == 400
    assert "explicit confirmation" in res.json()["error"]["message"]


@pytest.mark.asyncio
async def test_account_deletion_with_legal_records_applies_statutory_retention_and_invalidates_tokens(
    async_client: AsyncClient,
    citizen_auth_headers,
    db_session: AsyncSession,
):
    """Test DELETE /users/me scrubs PII, preserves statutory case filings, and deletes tokens."""
    user = citizen_auth_headers["user"]
    user_id = user.id

    # Add a legal case so statutory retention rule triggers
    legal_case = LegalCase(
        case_reference=f"NYA-DEL-{uuid.uuid4().hex[:6].upper()}",
        client_id=user_id,
        title="Statutory Trial Matter",
        practice_group="Trials & Disputes",
    )
    db_session.add(legal_case)
    await db_session.commit()

    # Execute purge
    delete_res = await async_client.request(
        "DELETE",
        "/api/v1/users/me",
        headers=citizen_auth_headers["headers"],
        json={"confirmation": "CONFIRM_DELETE_NYAYASETU_ACCOUNT"},
    )
    assert delete_res.status_code == 200
    resp_body = delete_res.json()
    assert resp_body["status"] == "PURGED"
    assert "Limitation Act 1963" in resp_body["retention_policy"]

    # Verify PII scrub in DB in fresh session
    async with TestingAsyncSessionLocal() as fresh_db:
        refreshed_user = await fresh_db.scalar(select(User).where(User.id == user_id))
        assert refreshed_user.is_active is False
        assert refreshed_user.full_name == "Anonymized Citizen [Account Purged]"
        assert "@deleted.nyayasetu.local" in refreshed_user.email
        assert refreshed_user.password_hash == "PURGED_ACCOUNT_PASSWORD_INACCESSIBLE"

        # Verify refresh tokens are wiped
        tokens_count = await fresh_db.scalar(
            select(RefreshToken).where(RefreshToken.user_id == user_id)
        )
        assert tokens_count is None

    # Attempt to refresh token using previously valid refresh token
    refresh_res = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": citizen_auth_headers["refresh_token"]},
    )
    assert refresh_res.status_code == 401
