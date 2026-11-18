"""Comprehensive test suite for Advocate Registration & Verification module (Step 5)."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.modules.admin.models import AuditLog
from app.modules.advocates.models import AdvocateProfile, AdvocateVerification
from app.modules.users.models import User


async def create_admin(db_session: AsyncSession, async_client: AsyncClient) -> tuple[str, str]:
    """Helper to create an ADMIN user in database and return (user_id, access_token)."""
    email = "superadmin@nyayasetu.gov.in"
    password = "AdminSecurePassword2026"
    admin = User(
        full_name="Platform Chief Verifier",
        email=email,
        phone="+919999111222",
        password_hash=hash_password(password),
        role="ADMIN",
        is_verified=True,
        is_active=True,
    )
    db_session.add(admin)
    await db_session.commit()

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == 200
    return str(admin.id), login_res.json()["access_token"]


# ──────────────────────────────────────────────────────────────
# 1. Advocate Apply (POST /advocates/apply)
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_advocate_apply_and_initial_pending_status(async_client: AsyncClient):
    """Verify advocate applies with complete information and initially receives PENDING status."""
    payload = {
        "full_name": "Adv. Vikram Malhotra",
        "email": "v.malhotra@nyayasetu.in",
        "phone": "+919810123456",
        "password": "SecurePassword2026",
        "bar_council_id": "D/1089/2014",
        "bar_council_name": "Bar Council of Delhi",
        "practice_areas": ["Trials & Disputes", "Criminal Defense"],
        "courts_of_practice": ["Supreme Court of India", "Delhi High Court"],
        "languages": ["English", "Hindi"],
        "years_of_experience": 12,
        "city": "New Delhi",
        "district": "Central Delhi",
        "state": "Delhi",
        "pincode": "110001",
        "latitude": 28.6139,
        "longitude": 77.2090,
    }

    res = await async_client.post("/api/v1/advocates/apply", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert data["full_name"] == "Adv. Vikram Malhotra"
    assert data["email"] == "v.malhotra@nyayasetu.in"
    assert data["bar_council_id"] == "D/1089/2014"
    assert data["district"] == "Central Delhi"
    assert data["years_of_experience"] == 12
    assert "Trials & Disputes" in data["practice_areas"]
    assert data["latitude"] == pytest.approx(28.6139, abs=0.001)
    assert data["longitude"] == pytest.approx(77.2090, abs=0.001)

    # CRITICAL INVARIANT: A registered advocate must NOT automatically become verified!
    assert data["platform_verification_status"] == "PENDING"
    assert data["is_verified"] is False


# ──────────────────────────────────────────────────────────────
# 2. Upload Verification Documents & View in GET /advocates/me
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upload_documents_and_get_advocate_me(async_client: AsyncClient):
    """Verify advocate uploads documents and inspects their full profile via GET /advocates/me."""
    # 1. Apply
    apply_payload = {
        "full_name": "Adv. Meera Nair",
        "email": "m.nair@nyayasetu.in",
        "phone": "+919810234567",
        "password": "PasswordMeera2026",
        "bar_council_id": "D/2099/2016",
        "bar_council_name": "Bar Council of Delhi",
        "practice_areas": ["Corporate & M&A"],
        "years_of_experience": 8,
        "city": "New Delhi",
        "district": "South Delhi",
        "state": "Delhi",
    }
    apply_res = await async_client.post("/api/v1/advocates/apply", json=apply_payload)
    assert apply_res.status_code == 201

    # 2. Login
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "m.nair@nyayasetu.in", "password": "PasswordMeera2026"},
    )
    assert login_res.status_code == 200
    adv_token = login_res.json()["access_token"]

    # 3. Upload Enrollment Certificate
    cert_content = b"%PDF-1.4 sample bar enrollment certificate"
    doc_res1 = await async_client.post(
        "/api/v1/advocates/me/verification/documents",
        data={"verification_type": "ENROLLMENT_CERTIFICATE"},
        files={"file": ("enrollment_cert.pdf", cert_content, "application/pdf")},
        headers={"Authorization": f"Bearer {adv_token}"},
    )
    assert doc_res1.status_code == 201

    # 4. Upload Bar ID Card
    id_content = b"%PDF-1.4 sample bar identity card"
    doc_res2 = await async_client.post(
        "/api/v1/advocates/me/verification/documents",
        data={"verification_type": "BAR_ID_CARD"},
        files={"file": ("bar_id.pdf", id_content, "application/pdf")},
        headers={"Authorization": f"Bearer {adv_token}"},
    )
    assert doc_res2.status_code == 201

    # 5. Call GET /advocates/me
    me_res = await async_client.get(
        "/api/v1/advocates/me",
        headers={"Authorization": f"Bearer {adv_token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["full_name"] == "Adv. Meera Nair"
    assert me_data["platform_verification_status"] == "PENDING"
    assert me_data["is_verified"] is False
    assert len(me_data["documents"]) == 2


# ──────────────────────────────────────────────────────────────
# 3. Admin View Pending Applications (GET /admin/advocates/pending)
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_view_pending_advocates(async_client: AsyncClient, db_session: AsyncSession):
    """Verify admin can view pending advocate applications with document count."""
    # Register an advocate
    await async_client.post(
        "/api/v1/advocates/apply",
        json={
            "full_name": "Adv. Suresh Patel",
            "email": "s.patel@nyayasetu.in",
            "phone": "+919810345678",
            "password": "PasswordSuresh1",
            "bar_council_id": "GUJ/3001/2015",
            "bar_council_name": "Bar Council of Gujarat",
            "practice_areas": ["Real Estate"],
            "years_of_experience": 9,
            "city": "Ahmedabad",
            "district": "Ahmedabad",
            "state": "Gujarat",
        },
    )

    # Login as admin
    _, admin_token = await create_admin(db_session, async_client)

    # Call GET /admin/advocates/pending
    pending_res = await async_client.get(
        "/api/v1/admin/advocates/pending?status=PENDING",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert pending_res.status_code == 200
    pending_data = pending_res.json()
    assert pending_data["total"] >= 1
    items = pending_data["items"]
    patel_item = next((i for i in items if i["email"] == "s.patel@nyayasetu.in"), None)
    assert patel_item is not None
    assert patel_item["bar_council_id"] == "GUJ/3001/2015"
    assert patel_item["platform_verification_status"] == "PENDING"


# ──────────────────────────────────────────────────────────────
# 4. Admin View Single Advocate (GET /admin/advocates/{id})
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_get_advocate_by_id(async_client: AsyncClient, db_session: AsyncSession):
    """Verify admin can retrieve full advocate profile details by advocate ID."""
    apply_res = await async_client.post(
        "/api/v1/advocates/apply",
        json={
            "full_name": "Adv. Kavita Deshmukh",
            "email": "k.deshmukh@nyayasetu.in",
            "phone": "+919810456789",
            "password": "PasswordKavita1",
            "bar_council_id": "MAH/4001/2013",
            "bar_council_name": "Bar Council of Maharashtra & Goa",
            "practice_areas": ["Corporate & M&A"],
            "years_of_experience": 11,
            "city": "Mumbai",
            "district": "Mumbai City",
            "state": "Maharashtra",
        },
    )
    adv_id = apply_res.json()["id"]

    _, admin_token = await create_admin(db_session, async_client)

    get_res = await async_client.get(
        f"/api/v1/admin/advocates/{adv_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert get_res.status_code == 200
    adv_detail = get_res.json()
    assert adv_detail["id"] == adv_id
    assert adv_detail["full_name"] == "Adv. Kavita Deshmukh"
    assert adv_detail["district"] == "Mumbai City"


# ──────────────────────────────────────────────────────────────
# 5. Admin Review & Update Verification (UNDER_REVIEW & VERIFIED)
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_verification_workflow_under_review_and_verified(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Verify complete review lifecycle: PENDING -> UNDER_REVIEW -> VERIFIED, with matching integration."""
    # 1. Apply advocate
    apply_res = await async_client.post(
        "/api/v1/advocates/apply",
        json={
            "full_name": "Adv. Arjun Kapoor",
            "email": "a.kapoor@nyayasetu.in",
            "phone": "+919810567890",
            "password": "PasswordArjun1",
            "bar_council_id": "D/5001/2010",
            "bar_council_name": "Bar Council of Delhi",
            "practice_areas": ["Trials & Disputes"],
            "years_of_experience": 14,
            "city": "New Delhi",
            "district": "New Delhi",
            "state": "Delhi",
        },
    )
    adv_id = apply_res.json()["id"]

    # 2. Before verification: advocate must NOT appear in matching results!
    match_res_1 = await async_client.get("/api/v1/matching/advocates")
    assert match_res_1.status_code == 200
    matching_names_1 = [i["full_name"] for i in match_res_1.json()["items"]]
    assert "Adv. Arjun Kapoor" not in matching_names_1

    # 3. Admin transitions to UNDER_REVIEW
    _, admin_token = await create_admin(db_session, async_client)
    review_res = await async_client.patch(
        f"/api/v1/admin/advocates/{adv_id}/verification",
        json={
            "status": "UNDER_REVIEW",
            "internal_notes": "Advocate documents undergoing manual State Roll cross-check.",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert review_res.status_code == 200
    assert review_res.json()["platform_verification_status"] == "UNDER_REVIEW"

    # Still excluded from matching while UNDER_REVIEW
    match_res_2 = await async_client.get("/api/v1/matching/advocates")
    matching_names_2 = [i["full_name"] for i in match_res_2.json()["items"]]
    assert "Adv. Arjun Kapoor" not in matching_names_2

    # 4. Admin records VERIFIED decision
    verify_res = await async_client.patch(
        f"/api/v1/admin/advocates/{adv_id}/verification",
        json={
            "status": "VERIFIED",
            "decision_reason": "Matched against 2010 Delhi Bar Council Enrollment Register entry 5001.",
            "evidence_level": "OFFICIAL_ROLL_MATCHED",
            "source_name": "Bar Council of Delhi Official Roll 2010",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["platform_verification_status"] == "VERIFIED"
    assert verify_data["is_verified"] is True

    # 5. NOW advocate MUST appear in matching results!
    match_res_3 = await async_client.get("/api/v1/matching/advocates")
    matching_items = match_res_3.json()["items"]
    kapoor_match = next((i for i in matching_items if i["full_name"] == "Adv. Arjun Kapoor"), None)
    assert kapoor_match is not None
    assert kapoor_match["is_verified"] is True


# ──────────────────────────────────────────────────────────────
# 6. Admin Rejection Workflow
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_reject_advocate(async_client: AsyncClient, db_session: AsyncSession):
    """Verify admin rejection updates status to REJECTED and leaves is_verified False."""
    apply_res = await async_client.post(
        "/api/v1/advocates/apply",
        json={
            "full_name": "Adv. Disqualified Counsel",
            "email": "disqualified@nyayasetu.in",
            "phone": "+919810678901",
            "password": "PasswordDisq1",
            "bar_council_id": "D/6001/2020",
            "bar_council_name": "Bar Council of Delhi",
            "practice_areas": ["Criminal Defense"],
            "years_of_experience": 4,
            "city": "New Delhi",
            "state": "Delhi",
        },
    )
    adv_id = apply_res.json()["id"]

    _, admin_token = await create_admin(db_session, async_client)

    reject_res = await async_client.patch(
        f"/api/v1/admin/advocates/{adv_id}/verification",
        json={
            "status": "REJECTED",
            "decision_reason": "Enrollment number could not be authenticated with State Bar Council.",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["platform_verification_status"] == "REJECTED"
    assert reject_res.json()["is_verified"] is False


# ──────────────────────────────────────────────────────────────
# 7. Security: Citizen & Non-Admin Access Restrictions
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_security_restrictions_on_admin_advocate_endpoints(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Verify that citizens and non-admin users cannot access admin endpoints."""
    # Create citizen
    cit_reg = await async_client.post(
        "/api/v1/auth/register",
        json={
            "account_type": "CITIZEN",
            "full_name": "General Citizen",
            "email": "general.citizen@example.com",
            "phone": "+919810789012",
            "password": "CitizenPassword1",
        },
    )
    assert cit_reg.status_code == 201

    cit_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "general.citizen@example.com", "password": "CitizenPassword1"},
    )
    cit_token = cit_login.json()["access_token"]

    # Citizen calling GET /admin/advocates/pending -> 403 Forbidden
    res1 = await async_client.get(
        "/api/v1/admin/advocates/pending",
        headers={"Authorization": f"Bearer {cit_token}"},
    )
    assert res1.status_code == 403

    # Citizen calling PATCH /admin/advocates/{id}/verification -> 403 Forbidden
    import uuid
    dummy_id = uuid.uuid4()
    res2 = await async_client.patch(
        f"/api/v1/admin/advocates/{dummy_id}/verification",
        json={"status": "VERIFIED"},
        headers={"Authorization": f"Bearer {cit_token}"},
    )
    assert res2.status_code == 403


# ──────────────────────────────────────────────────────────────
# 8. Duplicate Bar Council ID Prevention & Duplicate User Check
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_duplicate_bar_council_id_and_email_prevention(async_client: AsyncClient):
    """Verify that applying with an already registered Bar Council enrollment or email raises 409 Conflict."""
    payload1 = {
        "full_name": "Adv. Original Counsel",
        "email": "original@nyayasetu.in",
        "phone": "+919810890123",
        "password": "PasswordOrig1",
        "bar_council_id": "D/8888/2015",
        "bar_council_name": "Bar Council of Delhi",
        "practice_areas": ["Real Estate"],
        "years_of_experience": 10,
        "city": "New Delhi",
        "state": "Delhi",
    }
    res1 = await async_client.post("/api/v1/advocates/apply", json=payload1)
    assert res1.status_code == 201

    # Attempt with same bar_council_id but different email & phone -> 409 Conflict
    payload_dup_bar = {
        **payload1,
        "email": "impostor@nyayasetu.in",
        "phone": "+919810890124",
        "full_name": "Adv. Impostor",
    }
    res2 = await async_client.post("/api/v1/advocates/apply", json=payload_dup_bar)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["error"]["message"]

    # Attempt with same email but different bar_council_id -> 409 Conflict
    payload_dup_email = {
        **payload1,
        "phone": "+919810890125",
        "bar_council_id": "D/8889/2015",
    }
    res3 = await async_client.post("/api/v1/advocates/apply", json=payload_dup_email)
    assert res3.status_code == 409


# ──────────────────────────────────────────────────────────────
# 9. Admin Self-Approval Prevention
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_cannot_approve_own_advocate_profile(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Verify security rule: an admin who also has an advocate profile cannot self-approve."""
    # Create admin
    admin_id, admin_token = await create_admin(db_session, async_client)

    # Admin applies as advocate using their existing token
    apply_payload = {
        "full_name": "Admin Dual Identity",
        "email": "superadmin@nyayasetu.gov.in",
        "phone": "+919999111222",
        "bar_council_id": "D/7777/2012",
        "bar_council_name": "Bar Council of Delhi",
        "practice_areas": ["Trials & Disputes"],
        "years_of_experience": 12,
        "city": "New Delhi",
        "state": "Delhi",
    }
    apply_res = await async_client.post(
        "/api/v1/advocates/apply",
        json=apply_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert apply_res.status_code == 201
    adv_id = apply_res.json()["id"]

    # Admin tries to approve their own advocate profile -> 403 Forbidden
    self_approve_res = await async_client.patch(
        f"/api/v1/admin/advocates/{adv_id}/verification",
        json={"status": "VERIFIED", "decision_reason": "I approve myself"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert self_approve_res.status_code == 403
    assert "cannot approve" in self_approve_res.json()["error"]["message"]


# ──────────────────────────────────────────────────────────────
# 10. Audit Log Creation for Decisions
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_audit_log_created_for_verification_decisions(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Verify that every verification decision writes an immutable record to AuditLog."""
    apply_res = await async_client.post(
        "/api/v1/advocates/apply",
        json={
            "full_name": "Adv. Audit Logged",
            "email": "audit.logged@nyayasetu.in",
            "phone": "+919810999888",
            "password": "PasswordAudit1",
            "bar_council_id": "D/9999/2018",
            "bar_council_name": "Bar Council of Delhi",
            "practice_areas": ["Corporate & M&A"],
            "years_of_experience": 6,
            "city": "New Delhi",
            "state": "Delhi",
        },
    )
    adv_id = apply_res.json()["id"]

    _, admin_token = await create_admin(db_session, async_client)

    patch_res = await async_client.patch(
        f"/api/v1/admin/advocates/{adv_id}/verification",
        json={
            "status": "VERIFIED",
            "decision_reason": "Full audit check passed.",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert patch_res.status_code == 200

    # Query AuditLog table
    audit_res = await db_session.execute(
        select(AuditLog).where(
            (AuditLog.entity_id == adv_id) &
            (AuditLog.action == "ADVOCATE_VERIFICATION_STATUS_VERIFIED")
        )
    )
    audit_entry = audit_res.scalar_one_or_none()
    assert audit_entry is not None
    assert audit_entry.payload_snapshot["status"] == "VERIFIED"
    assert audit_entry.payload_snapshot["reason"] == "Full audit check passed."

