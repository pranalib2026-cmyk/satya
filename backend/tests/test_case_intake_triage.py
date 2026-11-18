"""Comprehensive test suite for Case Intake and Case Triage modules."""

from datetime import date
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.models import AuditLog
from app.modules.cases.models import LegalCase
from app.modules.users.models import User


async def create_and_login_citizen(
    async_client: AsyncClient,
    email: str = "ramesh.patel@example.com",
    phone: str = "+919876543210",
    name: str = "Ramesh Patel",
) -> tuple[str, str]:
    """Helper to register and log in a citizen, returning (user_id, access_token)."""
    reg_payload = {
        "account_type": "CITIZEN",
        "full_name": name,
        "email": email,
        "phone": phone,
        "password": "CitizenPassword2026",
        "preferred_language": "hi",
    }
    reg_res = await async_client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "CitizenPassword2026"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    user_id = reg_res.json()["id"]
    return user_id, token


# ──────────────────────────────────────────────────────────────
# 1. Case Intake & Initial Automatic Triage
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_case_intake_creation_and_auto_triage(async_client: AsyncClient, db_session: AsyncSession):
    """Verify citizen submits case intake and receives unique reference with structured triage assessment."""
    user_id, token = await create_and_login_citizen(async_client)

    payload = {
        "title": "Unlawful Deduction of Security Deposit by Landlord",
        "problem_description": (
            "I vacated my rented apartment in Whitefield after serving full two months notice period. "
            "The landlord Mr. Sharma is refusing to refund my security deposit of Rs 1,20,000 citing "
            "fictitious wall repainting damages. We have a registered rental agreement."
        ),
        "legal_issue_category": "Property & Real Estate",
        "state": "Karnataka",
        "district": "Bengaluru Urban",
        "relevant_court": "Court of Small Causes, Bengaluru",
        "incident_date": "2026-09-15",
        "preferred_language": "en",
        "urgency": "standard-30d",
        "supporting_info": "Registered 11-month agreement, bank transfer statement of deposit, move-out handover video.",
        "adverse_parties": "Rakesh Sharma (Landlord)",
    }

    res = await async_client.post(
        "/api/v1/cases",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()

    assert data["title"] == payload["title"]
    assert data["case_reference"].startswith("NYA-2026-CS-")
    assert data["client_id"] == user_id
    assert data["stage"] == "INTAKE"
    assert data["state"] == "Karnataka"
    assert data["district"] == "Bengaluru Urban"

    # Verify structured auto-triage output
    triage = data["triage_result"]
    assert triage is not None
    assert triage["identified_category"] == "Property & Real Estate"
    assert "Karnataka" in triage["summary_of_facts"]
    assert "Whitefield" in triage["summary_of_facts"] or "deposit" in triage["summary_of_facts"]
    assert triage["urgency_level"] == "STANDARD_30D"
    assert triage["complexity"] in ["LOW", "MEDIUM"]
    assert triage["suggested_next_step"] in ["SELF_HELP", "ADVOCATE_CONSULTATION"]
    assert "Bengaluru" in triage["possible_jurisdiction"]
    assert isinstance(triage["missing_information"], list)
    assert isinstance(triage["advocate_assistance_appropriate"], bool)
    assert isinstance(triage["show_free_legal_aid"], bool)

    # Verify audit log recorded
    audit_res = await db_session.execute(
        select(AuditLog).where(
            AuditLog.entity_type == "legal_cases",
            AuditLog.entity_id == data["id"],
            AuditLog.action == "CASE_INTAKE_CREATED",
        )
    )
    audit = audit_res.scalar_one_or_none()
    assert audit is not None
    assert audit.payload_snapshot["case_reference"] == data["case_reference"]


# ──────────────────────────────────────────────────────────────
# 2. Input Validation Tests
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_case_intake_validation_errors(async_client: AsyncClient):
    """Verify invalid payloads (short description or missing required fields) return 422."""
    _, token = await create_and_login_citizen(
        async_client,
        email="val.user@example.com",
        phone="+919876543211",
    )

    # Too short problem description
    invalid_payload = {
        "title": "Help",
        "problem_description": "Short",  # Min length is 10
        "legal_issue_category": "Civil",
        "state": "Maharashtra",
        "district": "Pune",
    }

    res = await async_client.post(
        "/api/v1/cases",
        json=invalid_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422
    err_body = res.json()
    assert err_body["success"] is False
    assert err_body["error"]["code"] == "VALIDATION_ERROR"


# ──────────────────────────────────────────────────────────────
# 3. Ownership Isolation Security Enforcement
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_case_ownership_isolation(async_client: AsyncClient):
    """Ensure Citizen B is strictly forbidden from accessing, modifying, or triaging Citizen A's case."""
    # 1. Citizen A creates a case
    _, token_a = await create_and_login_citizen(
        async_client,
        email="citizen.a@example.com",
        phone="+919876543221",
        name="Citizen Alpha",
    )
    create_res = await async_client.post(
        "/api/v1/cases",
        json={
            "title": "Commercial Contract Dispute",
            "problem_description": "Non-payment of outstanding invoices for supply of raw materials.",
            "legal_issue_category": "Corporate & Commercial",
            "state": "Delhi",
            "district": "New Delhi",
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert create_res.status_code == 201
    case_a_id = create_res.json()["id"]

    # 2. Citizen B registers and logs in
    _, token_b = await create_and_login_citizen(
        async_client,
        email="citizen.b@example.com",
        phone="+919876543222",
        name="Citizen Beta",
    )

    # 3. Citizen B tries to get Citizen A's case -> 403 Forbidden
    get_res = await async_client.get(
        f"/api/v1/cases/{case_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert get_res.status_code == 403
    assert "Access forbidden" in get_res.json()["error"]["message"]

    # 4. Citizen B tries to patch Citizen A's case -> 403 Forbidden
    patch_res = await async_client.patch(
        f"/api/v1/cases/{case_a_id}",
        json={"title": "Hacked Title by Unauthorized User"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert patch_res.status_code == 403

    # 5. Citizen B tries to trigger triage on Citizen A's case -> 403 Forbidden
    triage_res = await async_client.post(
        f"/api/v1/cases/{case_a_id}/triage",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert triage_res.status_code == 403

    # 6. Citizen B lists their cases -> should return 0 items (never exposes Citizen A's case)
    list_res = await async_client.get(
        "/api/v1/cases",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] == 0
    assert len(list_data["items"]) == 0


# ──────────────────────────────────────────────────────────────
# 4. Case Retrieval & Partial Update by Owner
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_case_get_and_update_by_owner(async_client: AsyncClient, db_session: AsyncSession):
    """Verify owner citizen can retrieve case by ID, list cases, and apply partial updates."""
    _, token = await create_and_login_citizen(
        async_client,
        email="sneha.reddy@example.com",
        phone="+919876543233",
        name="Sneha Reddy",
    )

    # Create Case
    create_res = await async_client.post(
        "/api/v1/cases",
        json={
            "title": "Defective Refrigerator Purchased from Appliance Store",
            "problem_description": "Compressor failed within 15 days of purchase. Store refuses replacement.",
            "legal_issue_category": "Consumer Dispute",
            "state": "Telangana",
            "district": "Hyderabad",
            "urgency": "standard-30d",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    case_id = create_res.json()["id"]

    # Owner retrieves case
    get_res = await async_client.get(
        f"/api/v1/cases/{case_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 200
    assert get_res.json()["title"] == "Defective Refrigerator Purchased from Appliance Store"

    # Owner updates supporting info and relevant court
    update_res = await async_client.patch(
        f"/api/v1/cases/{case_id}",
        json={
            "supporting_info": "Tax Invoice no. TX-8921 and warranty registration card provided.",
            "relevant_court": "District Consumer Disputes Redressal Commission Hyderabad-I",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert "Tax Invoice no. TX-8921" in updated_data["supporting_info"]
    assert updated_data["relevant_court"] == "District Consumer Disputes Redressal Commission Hyderabad-I"

    # Verify audit log
    audit_res = await db_session.execute(
        select(AuditLog).where(
            AuditLog.entity_type == "legal_cases",
            AuditLog.entity_id == case_id,
            AuditLog.action == "CASE_UPDATED",
        )
    )
    assert audit_res.scalar_one_or_none() is not None


# ──────────────────────────────────────────────────────────────
# 5. Triage Pathway: SELF_HELP
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_triage_next_step_self_help(async_client: AsyncClient):
    """Verify consumer grievance qualifies for SELF_HELP pathway (e-Daakhil / consumer grievance)."""
    _, token = await create_and_login_citizen(
        async_client,
        email="selfhelp.user@example.com",
        phone="+919876543244",
        name="Karan Verma",
    )

    create_res = await async_client.post(
        "/api/v1/cases",
        json={
            "title": "Online Food Delivery Undelivered Refund Refusal",
            "problem_description": "Ordered groceries worth Rs 650 on app. Order was cancelled but refund not credited. Simple refund grievance.",
            "legal_issue_category": "Consumer Dispute",
            "state": "Maharashtra",
            "district": "Pune",
            "urgency": "standard-30d",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    case_id = create_res.json()["id"]

    # Trigger triage evaluation
    triage_res = await async_client.post(
        f"/api/v1/cases/{case_id}/triage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert triage_res.status_code == 200
    triage = triage_res.json()

    assert triage["suggested_next_step"] == "SELF_HELP"
    assert triage["complexity"] == "LOW"
    assert triage["advocate_assistance_appropriate"] is False
    assert "District Consumer Disputes Redressal Commission" in triage["possible_jurisdiction"]


# ──────────────────────────────────────────────────────────────
# 6. Triage Pathway: FREE_LEGAL_AID
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_triage_next_step_free_legal_aid(async_client: AsyncClient):
    """Verify indigent citizen or domestic violence matter routes to FREE_LEGAL_AID under Section 12 NALSA Act."""
    _, token = await create_and_login_citizen(
        async_client,
        email="legalaid.user@example.com",
        phone="+919876543255",
        name="Sunita Devi",
    )

    create_res = await async_client.post(
        "/api/v1/cases",
        json={
            "title": "Domestic Violence and Desertion Without Maintenance",
            "problem_description": (
                "I am a domestic violence survivor deserted by husband with two small children. "
                "I have no income, belong to below poverty line (BPL) family, and cannot afford a lawyer. "
                "Seeking maintenance and protection order under PWDVA 2005 through free legal aid."
            ),
            "legal_issue_category": "Family & Matrimonial",
            "state": "Bihar",
            "district": "Patna",
            "urgency": "urgent-48h",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    case_id = create_res.json()["id"]

    triage_res = await async_client.post(
        f"/api/v1/cases/{case_id}/triage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert triage_res.status_code == 200
    triage = triage_res.json()

    assert triage["suggested_next_step"] == "FREE_LEGAL_AID"
    assert triage["show_free_legal_aid"] is True
    assert triage["advocate_assistance_appropriate"] is True
    assert "Family Court" in triage["possible_jurisdiction"]


# ──────────────────────────────────────────────────────────────
# 7. Triage Pathway: URGENT_ASSISTANCE
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_triage_next_step_urgent_assistance(async_client: AsyncClient):
    """Verify imminent arrest or emergency 24h triggers URGENT_ASSISTANCE pathway."""
    _, token = await create_and_login_citizen(
        async_client,
        email="urgent.user@example.com",
        phone="+919876543266",
        name="Vikram Singh",
    )

    create_res = await async_client.post(
        "/api/v1/cases",
        json={
            "title": "Imminent Demolition of Residential Dwelling Without Prior Notice",
            "problem_description": (
                "Municipal authorities have arrived with bulldozers for demolition of my ancestral house "
                "without any show-cause notice. Physical threat and dispossession taking place right now."
            ),
            "legal_issue_category": "Constitutional & Writs",
            "state": "Uttar Pradesh",
            "district": "Lucknow",
            "urgency": "emergency-24h",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    case_id = create_res.json()["id"]

    triage_res = await async_client.post(
        f"/api/v1/cases/{case_id}/triage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert triage_res.status_code == 200
    triage = triage_res.json()

    assert triage["suggested_next_step"] == "URGENT_ASSISTANCE"
    assert triage["urgency_level"] == "EMERGENCY_24H"
    assert triage["advocate_assistance_appropriate"] is True


# ──────────────────────────────────────────────────────────────
# 8. Triage Pathway: ADVOCATE_CONSULTATION & Evidentiary Gaps
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_triage_next_step_advocate_consultation_and_missing_info(async_client: AsyncClient):
    """Verify Section 138 NI Act cheque bounce routes to ADVOCATE_CONSULTATION and detects evidentiary gaps."""
    _, token = await create_and_login_citizen(
        async_client,
        email="advocate.consult@example.com",
        phone="+919876543277",
        name="Anand Kulkarni",
    )

    create_res = await async_client.post(
        "/api/v1/cases",
        json={
            "title": "Cheque Dishonour by Business Associate",
            "problem_description": "Cheque for Rs 15,00,000 bounced due to insufficient funds.",
            "legal_issue_category": "Cheque Bounce (Sec 138 NI Act)",
            "state": "Maharashtra",
            "district": "Mumbai",
            "urgency": "standard-30d",
            # Intentionally omitting incident_date and supporting details to test missing info
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    case_id = create_res.json()["id"]

    triage_res = await async_client.post(
        f"/api/v1/cases/{case_id}/triage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert triage_res.status_code == 200
    triage = triage_res.json()

    assert triage["suggested_next_step"] == "ADVOCATE_CONSULTATION"
    assert triage["advocate_assistance_appropriate"] is True
    assert "Judicial Magistrate First Class" in triage["possible_jurisdiction"] or "Metropolitan Magistrate" in triage["possible_jurisdiction"]

    # Verify missing information identifies key statutory prerequisites
    missing_items = " ".join(triage["missing_information"])
    assert "Exact date" in missing_items
    assert "demand notice" in missing_items.lower() or "memo" in missing_items.lower() or "cheque number" in missing_items.lower()


# ──────────────────────────────────────────────────────────────
# 9. Direct Preliminary Assessment API (POST /triage/assess)
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_preliminary_triage_assess_endpoint(async_client: AsyncClient):
    """Verify public/pre-case preliminary legal assessment endpoint."""
    payload = {
        "title": "Salary Withheld Post Resignation",
        "problem_description": "Employer refused to release two months pending salary and experience letter after notice period was completed.",
        "legal_issue_category": "Labour & Employment",
        "state": "Tamil Nadu",
        "district": "Chennai",
        "urgency": "standard-30d",
    }

    res = await async_client.post("/api/v1/triage/assess", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["identified_category"] == "Labour & Employment"
    assert "Labour Court" in data["possible_jurisdiction"] or "Industrial Tribunal" in data["possible_jurisdiction"]
    assert data["suggested_next_step"] in ["ADVOCATE_CONSULTATION", "SELF_HELP"]


# ──────────────────────────────────────────────────────────────
# 10. Unauthenticated Requests Rejected
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_unauthenticated_case_requests_rejected(async_client: AsyncClient):
    """Verify unauthenticated requests to case endpoints return HTTP 401."""
    # POST /cases without token
    res_post = await async_client.post("/api/v1/cases", json={"title": "Test", "problem_description": "Test description text"})
    assert res_post.status_code == 401

    # GET /cases without token
    res_get = await async_client.get("/api/v1/cases")
    assert res_get.status_code == 401
