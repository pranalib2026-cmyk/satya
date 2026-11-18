"""Comprehensive test suite for the Advocate Matching Engine and Consultation Requests."""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.modules.admin.models import AuditLog
from app.modules.advocates.models import AdvocateProfile
from app.modules.cases.models import LegalCase
from app.modules.matching.engine import AdvocateMatchingEngine, haversine_distance_km
from app.modules.triage.models import ConsultationRequest
from app.modules.users.models import User


async def create_citizen(
    async_client: AsyncClient,
    email: str = "matching.citizen@example.com",
    name: str = "Ananya Iyer",
    phone: str = "+919876500001",
) -> tuple[str, str]:
    """Helper to register and log in a citizen, returning (user_id, access_token)."""
    reg_payload = {
        "account_type": "CITIZEN",
        "full_name": name,
        "email": email,
        "phone": phone,
        "password": "CitizenPassword2026",
        "preferred_language": "en",
    }
    reg_res = await async_client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "CitizenPassword2026"},
    )
    assert login_res.status_code == 200
    return reg_res.json()["id"], login_res.json()["access_token"]


async def create_advocate_profile(
    db: AsyncSession,
    full_name: str,
    email: str,
    phone: str,
    bar_council_id: str,
    bar_council_name: str,
    primary_practice: str,
    secondary_practices: list[str],
    courts_of_practice: list[str],
    languages: list[str],
    city: str,
    district: str,
    state: str,
    verification_status: str = "VERIFIED",
    fixed_fee: float = 1500.0,
    hourly_rate: float = 3000.0,
    years_experience: int = 10,
    lat: float = 28.6139,
    lon: float = 77.2090,
) -> tuple[User, AdvocateProfile]:
    """Helper to directly create and persist an advocate with specified verification status."""
    adv_user = User(
        full_name=full_name,
        email=email,
        phone=phone,
        password_hash=hash_password("AdvocateSecure2026"),
        role="ADVOCATE",
        is_verified=True,
        is_active=True,
    )
    db.add(adv_user)
    await db.flush()

    adv_profile = AdvocateProfile(
        user_id=adv_user.id,
        bar_council_id=bar_council_id,
        bar_council_name=bar_council_name,
        in_practice_years=years_experience,
        primary_practice=primary_practice,
        secondary_practices=secondary_practices,
        courts_of_practice=courts_of_practice,
        languages=languages,
        bio=f"Chamber of Adv. {full_name}",
        is_partner=False,
        hourly_rate_inr=hourly_rate,
        fixed_consultation_fee_inr=fixed_fee,
        location=f"POINT({lon} {lat})",
        city=city,
        district=district,
        state=state,
        pincode="110001",
        platform_verification_status=verification_status,
    )
    db.add(adv_profile)
    await db.commit()
    await db.refresh(adv_user)
    await db.refresh(adv_profile)
    return adv_user, adv_profile


# ──────────────────────────────────────────────────────────────
# 1. Hard Filter: Only VERIFIED Advocates Matched
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_matching_hard_filter_verification_status(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Ensure pending, under review, and rejected advocates are strictly excluded from matching."""
    citizen_id, citizen_token = await create_citizen(
        async_client,
        email="verif.filter.citizen@example.com",
        phone="+919876500011",
    )

    # 1. Create a verified candidate
    _, verified_adv = await create_advocate_profile(
        db_session,
        full_name="Adv. Verified Counsel",
        email="verified@nyayasetu.in",
        phone="+919810000001",
        bar_council_id="D/1001/2012",
        bar_council_name="Bar Council of Delhi",
        primary_practice="Consumer Dispute",
        secondary_practices=["Trials & Disputes"],
        courts_of_practice=["Delhi State Consumer Commission", "District Forum"],
        languages=["English", "Hindi"],
        city="New Delhi",
        district="New Delhi",
        state="Delhi",
        verification_status="VERIFIED",
    )

    # 2. Create pending and under-review candidates with identical practice area
    await create_advocate_profile(
        db_session,
        full_name="Adv. Pending Counsel",
        email="pending@nyayasetu.in",
        phone="+919810000002",
        bar_council_id="D/1002/2012",
        bar_council_name="Bar Council of Delhi",
        primary_practice="Consumer Dispute",
        secondary_practices=["Trials & Disputes"],
        courts_of_practice=["District Forum"],
        languages=["English", "Hindi"],
        city="New Delhi",
        district="New Delhi",
        state="Delhi",
        verification_status="PENDING",
    )

    await create_advocate_profile(
        db_session,
        full_name="Adv. Under Review Counsel",
        email="underreview@nyayasetu.in",
        phone="+919810000003",
        bar_council_id="D/1003/2012",
        bar_council_name="Bar Council of Delhi",
        primary_practice="Consumer Dispute",
        secondary_practices=["Trials & Disputes"],
        courts_of_practice=["District Forum"],
        languages=["English", "Hindi"],
        city="New Delhi",
        district="New Delhi",
        state="Delhi",
        verification_status="UNDER_REVIEW",
    )

    # 3. Create Case
    case_res = await async_client.post(
        "/api/v1/cases",
        json={
            "title": "Defective Laptop Consumer Dispute",
            "problem_description": "Purchased brand new gaming laptop from retail vendor. Motherboard died within warranty. Seller refuses replacement.",
            "legal_issue_category": "Consumer Dispute",
            "state": "Delhi",
            "district": "New Delhi",
        },
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    # 4. Request Matching
    match_res = await async_client.get(
        f"/api/v1/matching/cases/{case_id}/advocates",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert match_res.status_code == 200
    data = match_res.json()

    # Verify only verified candidate returned
    assert data["total_matches_returned"] == 1
    assert data["matches"][0]["advocate_id"] == str(verified_adv.id)
    assert data["matches"][0]["verified_status"] == "VERIFIED"
    assert data["matches"][0]["full_name"] == "Adv. Verified Counsel"


# ──────────────────────────────────────────────────────────────
# 2. Hard Filter: Practice Area Relevance
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_matching_hard_filter_practice_area(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Ensure advocates with irrelevant practice areas are filtered out."""
    citizen_id, citizen_token = await create_citizen(
        async_client,
        email="practice.citizen@example.com",
        phone="+919876500022",
    )

    # Candidate 1: Real Estate specialist
    _, prop_adv = await create_advocate_profile(
        db_session,
        full_name="Adv. Property Expert",
        email="property@nyayasetu.in",
        phone="+919810000004",
        bar_council_id="KAR/2001/2010",
        bar_council_name="Bar Council of Karnataka",
        primary_practice="Property & Real Estate",
        secondary_practices=["RERA", "Civil Dispute"],
        courts_of_practice=["Karnataka High Court", "City Civil Court Bengaluru"],
        languages=["English", "Kannada"],
        city="Bengaluru",
        district="Bengaluru Urban",
        state="Karnataka",
        verification_status="VERIFIED",
    )

    # Candidate 2: Strictly Corporate M&A specialist
    await create_advocate_profile(
        db_session,
        full_name="Adv. Corporate M&A Specialist",
        email="corp@nyayasetu.in",
        phone="+919810000005",
        bar_council_id="KAR/2002/2010",
        bar_council_name="Bar Council of Karnataka",
        primary_practice="Corporate & M&A",
        secondary_practices=["Securities", "Private Equity"],
        courts_of_practice=["NCLT Bengaluru Bench"],
        languages=["English", "Kannada"],
        city="Bengaluru",
        district="Bengaluru Urban",
        state="Karnataka",
        verification_status="VERIFIED",
    )

    # Create Property Case
    case_res = await async_client.post(
        "/api/v1/cases",
        json={
            "title": "Delayed Possession of High-Rise Apartment",
            "problem_description": "Builder failed to handover possession of flat 3 years past the RERA completion date.",
            "legal_issue_category": "Property & Real Estate",
            "state": "Karnataka",
            "district": "Bengaluru Urban",
        },
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    case_id = case_res.json()["id"]

    match_res = await async_client.get(
        f"/api/v1/matching/cases/{case_id}/advocates",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert match_res.status_code == 200
    matches = match_res.json()["matches"]

    # Only property advocate matched
    assert len(matches) == 1
    assert matches[0]["advocate_id"] == str(prop_adv.id)
    assert "Property & Real Estate" in matches[0]["relevant_practice_areas"]


# ──────────────────────────────────────────────────────────────
# 3. Matching Factors & Configurable Weights
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_matching_engine_factor_weights():
    """Verify engine factor calculation adheres to 35% practice, 25% jurisdiction, 20% language, 10% proximity, 10% availability."""
    engine = AdvocateMatchingEngine(
        weight_practice=0.35,
        weight_jurisdiction=0.25,
        weight_language=0.20,
        weight_proximity=0.10,
        weight_availability=0.10,
    )
    assert round(engine.w_practice, 2) == 0.35
    assert round(engine.w_jurisdiction, 2) == 0.25
    assert round(engine.w_language, 2) == 0.20
    assert round(engine.w_proximity, 2) == 0.10
    assert round(engine.w_availability, 2) == 0.10

    # Custom weights normalization
    custom_engine = AdvocateMatchingEngine(
        weight_practice=0.50,
        weight_jurisdiction=0.50,
        weight_language=0.0,
        weight_proximity=0.0,
        weight_availability=0.0,
    )
    assert round(custom_engine.w_practice, 2) == 0.50
    assert round(custom_engine.w_jurisdiction, 2) == 0.50


# ──────────────────────────────────────────────────────────────
# 4. Preferred Consultation Budget Filter (No Paid Ranking)
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_budget_filter_without_paid_placement_boost(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Ensure max_budget_inr filters out higher fees without boosting cheaper advocates inappropriately."""
    _, token = await create_citizen(
        async_client,
        email="budget.citizen@example.com",
        phone="+919876500033",
    )

    # Advocate A: Fixed fee 1000, 5 years experience, lower jurisdiction score
    adv_a_user, adv_a = await create_advocate_profile(
        db_session,
        full_name="Adv. Budget Counsel A",
        email="budget.a@nyayasetu.in",
        phone="+919810000010",
        bar_council_id="MAH/3001/2019",
        bar_council_name="Bar Council of Maharashtra & Goa",
        primary_practice="Cheque Bounce (Sec 138 NI Act)",
        secondary_practices=["Trials & Disputes"],
        courts_of_practice=["Metropolitan Magistrate Court"],
        languages=["English"],
        city="Mumbai",
        district="Mumbai City",
        state="Maharashtra",
        fixed_fee=1000.0,
        years_experience=5,
        lat=19.0760,
        lon=72.8777,
    )

    # Advocate B: Fixed fee 2000, 18 years experience, high jurisdiction match
    adv_b_user, adv_b = await create_advocate_profile(
        db_session,
        full_name="Adv. Senior Counsel B",
        email="budget.b@nyayasetu.in",
        phone="+919810000011",
        bar_council_id="MAH/3002/2006",
        bar_council_name="Bar Council of Maharashtra & Goa",
        primary_practice="Cheque Bounce (Sec 138 NI Act)",
        secondary_practices=["Criminal Defense", "Trials & Disputes"],
        courts_of_practice=["Bombay High Court", "Metropolitan Magistrate Court Mumbai"],
        languages=["English", "Marathi", "Hindi"],
        city="Mumbai",
        district="Mumbai City",
        state="Maharashtra",
        fixed_fee=2000.0,
        years_experience=18,
        lat=19.0760,
        lon=72.8777,
    )

    # Advocate C: Fixed fee 5000 (Expensive)
    await create_advocate_profile(
        db_session,
        full_name="Adv. Expensive Counsel C",
        email="budget.c@nyayasetu.in",
        phone="+919810000012",
        bar_council_id="MAH/3003/2000",
        bar_council_name="Bar Council of Maharashtra & Goa",
        primary_practice="Cheque Bounce (Sec 138 NI Act)",
        secondary_practices=["Trials & Disputes"],
        courts_of_practice=["Bombay High Court"],
        languages=["English", "Hindi"],
        city="Mumbai",
        district="Mumbai City",
        state="Maharashtra",
        fixed_fee=5000.0,
    )

    # Create Cheque Bounce Case in Mumbai
    case_res = await async_client.post(
        "/api/v1/cases",
        json={
            "title": "Dishonoured Cheque Dispute",
            "problem_description": "Cheque of Rs 5 Lakhs returned unpaid with memo funds insufficient.",
            "legal_issue_category": "Cheque Bounce (Sec 138 NI Act)",
            "state": "Maharashtra",
            "district": "Mumbai City",
            "preferred_language": "mr",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    case_id = case_res.json()["id"]

    # Query with max_budget_inr = 2500 -> should return A and B, but exclude C
    res = await async_client.get(
        f"/api/v1/matching/cases/{case_id}/advocates?max_budget_inr=2500",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    matches = res.json()["matches"]
    matched_ids = [m["advocate_id"] for m in matches]

    assert str(adv_a.id) in matched_ids
    assert str(adv_b.id) in matched_ids
    # Expensive C is excluded
    assert len(matches) == 2

    # Advocate B has better language match (Marathi) + court match (Bombay High Court),
    # so B ranks first despite having a higher fee (2000 vs 1000) -> Proves NO paid ranking!
    assert matches[0]["advocate_id"] == str(adv_b.id)
    assert matches[0]["match_score_percentage"] >= matches[1]["match_score_percentage"]


# ──────────────────────────────────────────────────────────────
# 5. Geographic Proximity & Distance Threshold Filtering
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_distance_calculation_and_proximity_filter(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify distance calculation using Haversine / PostGIS and max_distance_km filtering."""
    # Test haversine math directly: New Delhi to Mumbai ~ 1150 km
    delhi_lat, delhi_lon = 28.6139, 77.2090
    mumbai_lat, mumbai_lon = 19.0760, 72.8777
    dist = haversine_distance_km(delhi_lat, delhi_lon, mumbai_lat, mumbai_lon)
    assert 1100 <= dist <= 1200

    _, token = await create_citizen(
        async_client,
        email="distance.citizen@example.com",
        phone="+919876500044",
    )

    # Advocate Near: Within Delhi (coordinates 28.6139, 77.2090)
    _, near_adv = await create_advocate_profile(
        db_session,
        full_name="Adv. Local Delhi Counsel",
        email="near.delhi@nyayasetu.in",
        phone="+919810000021",
        bar_council_id="D/4001/2015",
        bar_council_name="Bar Council of Delhi",
        primary_practice="Criminal Defense",
        secondary_practices=["Trials & Disputes"],
        courts_of_practice=["Delhi High Court", "Tis Hazari Court"],
        languages=["English", "Hindi"],
        city="New Delhi",
        district="New Delhi",
        state="Delhi",
        lat=28.6200,
        lon=77.2100,  # ~ 1 km away
    )

    # Advocate Far: Supreme Court advocate located in Lucknow, UP
    await create_advocate_profile(
        db_session,
        full_name="Adv. Lucknow Counsel",
        email="far.lucknow@nyayasetu.in",
        phone="+919810000022",
        bar_council_id="UP/4002/2015",
        bar_council_name="Bar Council of Uttar Pradesh",
        primary_practice="Criminal Defense",
        secondary_practices=["Trials & Disputes"],
        courts_of_practice=["Supreme Court of India", "Allahabad High Court"],
        languages=["English", "Hindi"],
        city="Lucknow",
        district="Lucknow",
        state="Uttar Pradesh",
        lat=26.8467,
        lon=80.9462,  # ~ 420 km away
    )

    # Delhi Case
    case_res = await async_client.post(
        "/api/v1/cases",
        json={
            "title": "Bail Application in Commercial Crime",
            "problem_description": "Seeking regular bail before Sessions Court.",
            "legal_issue_category": "Criminal / Police Matters",
            "state": "Delhi",
            "district": "New Delhi",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    case_id = case_res.json()["id"]

    # Filter by max_distance_km = 50 -> Should only return near Delhi advocate
    res = await async_client.get(
        f"/api/v1/matching/cases/{case_id}/advocates?max_distance_km=50",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    matches = res.json()["matches"]
    assert len(matches) == 1
    assert matches[0]["advocate_id"] == str(near_adv.id)
    assert matches[0]["approximate_distance_km"] < 10.0


# ──────────────────────────────────────────────────────────────
# 6. Objective Match Explanation Generation (BCI Rule 36)
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_match_explanation_objective_and_factual(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify match explanation contains strictly verified facts without superlative promotional terms."""
    _, token = await create_citizen(
        async_client,
        email="explanation.citizen@example.com",
        phone="+919876500055",
    )

    _, adv = await create_advocate_profile(
        db_session,
        full_name="Adv. Priya Narang",
        email="p.narang@nyayasetu.in",
        phone="+919810000031",
        bar_council_id="D/5001/2011",
        bar_council_name="Bar Council of Delhi",
        primary_practice="Family & Matrimonial",
        secondary_practices=["Civil Dispute"],
        courts_of_practice=["Delhi High Court", "Family Courts Saket"],
        languages=["English", "Hindi"],
        city="New Delhi",
        district="South Delhi",
        state="Delhi",
        years_experience=15,
    )

    case_res = await async_client.post(
        "/api/v1/cases",
        json={
            "title": "Contested Matrimonial Custody Petition",
            "problem_description": "Filing petition for permanent child custody before competent family court.",
            "legal_issue_category": "Family & Matrimonial",
            "state": "Delhi",
            "district": "South Delhi",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    case_id = case_res.json()["id"]

    res = await async_client.get(
        f"/api/v1/matching/cases/{case_id}/advocates",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    match = res.json()["matches"][0]
    exp = match["match_explanation"]

    # Assert factual attributes present
    assert "Verified advocate" in exp
    assert "Bar Council of Delhi" in exp
    assert "D/5001/2011" in exp
    assert "15 years" in exp
    assert "Family & Matrimonial" in exp

    # Assert strict BCI Rule 36 compliance: NO promotional superlatives
    prohibited_terms = ["best lawyer", "top advocate", "guaranteed", "number 1", "famous", "leading"]
    for term in prohibited_terms:
        assert term not in exp.lower()


# ──────────────────────────────────────────────────────────────
# 7. Case Ownership Isolation on Matching
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_case_ownership_enforcement_on_matching(async_client: AsyncClient):
    """Verify citizen cannot match advocates for another citizen's case (403 Forbidden)."""
    _, token_a = await create_citizen(
        async_client,
        email="owner.a@example.com",
        phone="+919876500061",
        name="Citizen A",
    )
    _, token_b = await create_citizen(
        async_client,
        email="intruder.b@example.com",
        phone="+919876500062",
        name="Citizen B",
    )

    case_res = await async_client.post(
        "/api/v1/cases",
        json={
            "title": "Confidential Commercial Arbitration",
            "problem_description": "Dispute under contractual dispute resolution clause.",
            "legal_issue_category": "Corporate & Commercial",
            "state": "Delhi",
            "district": "New Delhi",
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    case_a_id = case_res.json()["id"]

    # Citizen B attempts to query matches for Case A -> 403 Forbidden
    res = await async_client.get(
        f"/api/v1/matching/cases/{case_a_id}/advocates",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res.status_code == 403
    assert "Access forbidden" in res.json()["error"]["message"]


# ──────────────────────────────────────────────────────────────
# 8. Private Consultation Request Workflow
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_consultation_request_workflow(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify citizen submits consultation request to matched advocate, checks audit log and lists requests."""
    citizen_id, citizen_token = await create_citizen(
        async_client,
        email="consult.citizen@example.com",
        phone="+919876500071",
        name="Sanjay Gupta",
    )

    adv_user, adv_profile = await create_advocate_profile(
        db_session,
        full_name="Adv. Meera Sanyal",
        email="m.sanyal@nyayasetu.in",
        phone="+919810000041",
        bar_council_id="D/6001/2013",
        bar_council_name="Bar Council of Delhi",
        primary_practice="Trials & Disputes",
        secondary_practices=["Civil Dispute"],
        courts_of_practice=["Delhi High Court"],
        languages=["English", "Hindi"],
        city="New Delhi",
        district="New Delhi",
        state="Delhi",
    )

    # 1. Citizen creates Case
    case_res = await async_client.post(
        "/api/v1/cases",
        json={
            "title": "Recovery of Unpaid Professional Dues",
            "problem_description": "Invoices unpaid for engineering consultancy services rendered.",
            "legal_issue_category": "Trials & Disputes",
            "state": "Delhi",
            "district": "New Delhi",
        },
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    case_id = case_res.json()["id"]

    # 2. Citizen posts consultation request
    consult_payload = {
        "case_id": case_id,
        "targeted_advocate_id": str(adv_profile.id),
        "budget_inr": 1500.0,
        "urgency": "urgent-48h",
        "notes": "Available for virtual video consultation post 5 PM.",
    }

    req_res = await async_client.post(
        "/api/v1/matching/consultation-requests",
        json=consult_payload,
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert req_res.status_code == 201
    consult_data = req_res.json()

    assert consult_data["reference_code"].startswith("NYA-2026-CR-")
    assert consult_data["targeted_advocate_id"] == str(adv_profile.id)
    assert consult_data["targeted_advocate_name"] == "Adv. Meera Sanyal"
    assert consult_data["status"] == "SUBMITTED"
    assert consult_data["budget_inr"] == 1500.0

    # 3. Verify audit log entry created
    audit_res = await db_session.execute(
        select(AuditLog).where(
            AuditLog.entity_type == "consultation_requests",
            AuditLog.entity_id == consult_data["id"],
            AuditLog.action == "CONSULTATION_REQUEST_SUBMITTED",
        )
    )
    assert audit_res.scalar_one_or_none() is not None

    # 4. Citizen lists their consultation requests
    list_res = await async_client.get(
        "/api/v1/matching/consultation-requests",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert any(item["id"] == consult_data["id"] for item in list_data["items"])


# ──────────────────────────────────────────────────────────────
# 9. Consultation Request with Unverified Advocate Rejected
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_consultation_request_unverified_advocate_rejected(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Ensure sending a consultation request to an unverified advocate returns 400 Bad Request."""
    _, token = await create_citizen(
        async_client,
        email="unverified.target@example.com",
        phone="+919876500081",
    )

    # Create unverified advocate
    _, unverified_adv = await create_advocate_profile(
        db_session,
        full_name="Adv. Unverified Target",
        email="unverified.target@nyayasetu.in",
        phone="+919810000051",
        bar_council_id="D/7001/2020",
        bar_council_name="Bar Council of Delhi",
        primary_practice="Trials & Disputes",
        secondary_practices=[],
        courts_of_practice=[],
        languages=["English"],
        city="New Delhi",
        district="New Delhi",
        state="Delhi",
        verification_status="PENDING",
    )

    req_res = await async_client.post(
        "/api/v1/matching/consultation-requests",
        json={
            "targeted_advocate_id": str(unverified_adv.id),
            "legal_problem_summary": "General inquiry",
            "preferred_practice": "Trials & Disputes",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert req_res.status_code == 400
    assert "platform-verified advocates" in req_res.json()["error"]["message"]


# ──────────────────────────────────────────────────────────────
# 10. Unauthenticated Access Rejected
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_unauthenticated_matching_requests_rejected(async_client: AsyncClient):
    """Ensure unauthenticated access to matching and consultation request routes returns 401."""
    random_case_id = str(uuid.uuid4())

    res_matching = await async_client.get(f"/api/v1/matching/cases/{random_case_id}/advocates")
    assert res_matching.status_code == 401

    res_consult_post = await async_client.post(
        "/api/v1/matching/consultation-requests",
        json={"targeted_advocate_id": str(uuid.uuid4())},
    )
    assert res_consult_post.status_code == 401

    res_consult_get = await async_client.get("/api/v1/matching/consultation-requests")
    assert res_consult_get.status_code == 401
