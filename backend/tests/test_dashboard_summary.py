"""Integration tests for the Consolidated Dashboard Summary endpoint (/api/v1/dashboard/summary)."""

import uuid
from datetime import datetime, timedelta, timezone
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.modules.cases.models import CaseMessage, LegalCase
from app.modules.deadlines.models import Deadline
from app.modules.users.models import User


@pytest_asyncio.fixture
async def citizen_user_a(async_client: AsyncClient, db_session: AsyncSession):
    """Fixture providing Citizen User A."""
    password = "TestPassCitizenA123!"
    user = User(
        email=f"citizena_{uuid.uuid4().hex[:8]}@example.com",
        phone=f"+9191{uuid.uuid4().hex[:8]}",
        password_hash=hash_password(password),
        full_name="Aarav Deshmukh",
        role="CITIZEN",
        is_verified=True,
        is_active=True,
        preferred_language="en",
        city="Pune",
        state="Maharashtra",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": password},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    return {
        "user": user,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest_asyncio.fixture
async def citizen_user_b(async_client: AsyncClient, db_session: AsyncSession):
    """Fixture providing Citizen User B."""
    password = "TestPassCitizenB123!"
    user = User(
        email=f"citizenb_{uuid.uuid4().hex[:8]}@example.com",
        phone=f"+9192{uuid.uuid4().hex[:8]}",
        password_hash=hash_password(password),
        full_name="Bhavna Pillai",
        role="CITIZEN",
        is_verified=True,
        is_active=True,
        preferred_language="en",
        city="Chennai",
        state="Tamil Nadu",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": password},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    return {
        "user": user,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.mark.asyncio
async def test_dashboard_summary_unauthenticated_rejected(async_client: AsyncClient):
    """Unauthenticated or expired requests must be rejected with 401 Unauthorized."""
    res = await async_client.get("/api/v1/dashboard/summary")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_dashboard_summary_new_user_zero_counts(async_client: AsyncClient, citizen_user_a):
    """New citizen with no matters must receive zero counts, empty deadlines, and null recent case."""
    res = await async_client.get(
        "/api/v1/dashboard/summary",
        headers=citizen_user_a["headers"],
    )
    assert res.status_code == 200
    data = res.json()

    assert data["active_cases"] == 0
    assert data["pending_cases"] == 0
    assert data["completed_cases"] == 0
    assert data["total_cases"] == 0
    assert data["unread_messages"] == 0
    assert data["pending_actions"] == 0

    assert data["activeCases"] == 0
    assert data["unreadMessages"] == 0
    assert data["pendingActions"] == 0

    assert data["recent_case"] is None
    assert data["recentCase"] is None
    assert data["next_deadline"] is None
    assert data["upcoming_deadlines"] == []
    assert data["deadlines"] == []


@pytest.mark.asyncio
async def test_dashboard_summary_with_active_cases(
    async_client: AsyncClient,
    citizen_user_a,
    db_session: AsyncSession,
):
    """Citizen with active cases receives exact active counts and recentCase metadata."""
    user = citizen_user_a["user"]

    case = LegalCase(
        case_reference=f"NYA-ACT-{uuid.uuid4().hex[:6].upper()}",
        client_id=user.id,
        title="Commercial Lease Security Deposit Recovery",
        practice_group="Trials & Disputes",
        matter_type="Civil Suit",
        stage="PLEADINGS",
        conflict_status="CLEARED",
        court_forum="City Civil Court, Bengaluru",
    )
    db_session.add(case)
    await db_session.commit()

    # Add a deadline
    now = datetime.now(timezone.utc)
    deadline = Deadline(
        case_id=case.id,
        title="Written Statement Filing Window",
        due_date=now + timedelta(days=15),
        deadline_type="COURT_HEARING",
        priority="HIGH",
        is_advocate_confirmed=True,
        is_completed=False,
    )
    db_session.add(deadline)
    await db_session.commit()

    res = await async_client.get(
        "/api/v1/dashboard/summary",
        headers=citizen_user_a["headers"],
    )
    assert res.status_code == 200
    data = res.json()

    assert data["active_cases"] == 1
    assert data["total_cases"] == 1
    assert data["completed_cases"] == 0
    assert data["activeCases"] == 1

    # Recent Case inspection
    recent = data["recent_case"]
    assert recent is not None
    assert recent["title"] == "Commercial Lease Security Deposit Recovery"
    assert recent["stage"] == "PLEADINGS"
    assert recent["stage_label"] == "Pleadings & Filings"
    assert recent["stage_step"] == 3
    assert recent["progress_percentage"] == 60
    assert recent["status"] == "active"

    # Deadlines inspection
    assert len(data["upcoming_deadlines"]) == 1
    assert data["next_deadline"] is not None
    assert data["next_deadline"]["title"] == "Written Statement Filing Window"
    assert data["next_deadline"]["is_confirmed"] is True
    assert data["next_deadline"]["days_remaining"] >= 14


@pytest.mark.asyncio
async def test_dashboard_summary_with_completed_cases(
    async_client: AsyncClient,
    citizen_user_a,
    db_session: AsyncSession,
):
    """Citizen with disposed/completed cases reflects 0 active and 1 completed."""
    user = citizen_user_a["user"]

    case = LegalCase(
        case_reference=f"NYA-DIS-{uuid.uuid4().hex[:6].upper()}",
        client_id=user.id,
        title="Settled Consumer Forum Grievance",
        stage="DISPOSED",
        disposed_at=datetime.now(timezone.utc),
    )
    db_session.add(case)
    await db_session.commit()

    res = await async_client.get(
        "/api/v1/dashboard/summary",
        headers=citizen_user_a["headers"],
    )
    assert res.status_code == 200
    data = res.json()

    assert data["active_cases"] == 0
    assert data["completed_cases"] == 1
    assert data["total_cases"] == 1
    assert data["recent_case"]["status"] == "closed"
    assert data["recent_case"]["stage_step"] == 5
    assert data["recent_case"]["progress_percentage"] == 100


@pytest.mark.asyncio
async def test_dashboard_summary_with_mixed_case_statuses(
    async_client: AsyncClient,
    citizen_user_a,
    db_session: AsyncSession,
):
    """Citizen with mixed matter stages (INTAKE, PLEADINGS, DISPOSED)."""
    user = citizen_user_a["user"]

    case1 = LegalCase(
        case_reference=f"NYA-MIX1-{uuid.uuid4().hex[:4].upper()}",
        client_id=user.id,
        title="Intake Assessment Matter",
        stage="INTAKE",
    )
    case2 = LegalCase(
        case_reference=f"NYA-MIX2-{uuid.uuid4().hex[:4].upper()}",
        client_id=user.id,
        title="Hearing Stage Matter",
        stage="HEARING",
    )
    case3 = LegalCase(
        case_reference=f"NYA-MIX3-{uuid.uuid4().hex[:4].upper()}",
        client_id=user.id,
        title="Closed Dispute Matter",
        stage="DISPOSED",
    )
    db_session.add_all([case1, case2, case3])
    await db_session.commit()

    res = await async_client.get(
        "/api/v1/dashboard/summary",
        headers=citizen_user_a["headers"],
    )
    assert res.status_code == 200
    data = res.json()

    assert data["total_cases"] == 3
    assert data["active_cases"] == 2
    assert data["pending_cases"] == 1  # INTAKE is pending
    assert data["completed_cases"] == 1


@pytest.mark.asyncio
async def test_dashboard_summary_multi_tenant_isolation(
    async_client: AsyncClient,
    citizen_user_a,
    citizen_user_b,
    db_session: AsyncSession,
):
    """Two citizens must NEVER see each other's statistics or recent case titles."""
    user_a = citizen_user_a["user"]
    user_b = citizen_user_b["user"]

    # User A has 2 cases
    case_a1 = LegalCase(
        case_reference=f"NYA-UA1-{uuid.uuid4().hex[:4].upper()}",
        client_id=user_a.id,
        title="Citizen A Private Patent Infringement",
        stage="PLEADINGS",
    )
    case_a2 = LegalCase(
        case_reference=f"NYA-UA2-{uuid.uuid4().hex[:4].upper()}",
        client_id=user_a.id,
        title="Citizen A Trademark Dispute",
        stage="HEARING",
    )
    # User B has 1 case
    case_b = LegalCase(
        case_reference=f"NYA-UB1-{uuid.uuid4().hex[:4].upper()}",
        client_id=user_b.id,
        title="Citizen B Family Partition Matter",
        stage="INTAKE",
    )
    db_session.add_all([case_a1, case_a2, case_b])
    await db_session.commit()

    # Query Citizen A
    res_a = await async_client.get(
        "/api/v1/dashboard/summary",
        headers=citizen_user_a["headers"],
    )
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["total_cases"] == 2
    assert data_a["active_cases"] == 2
    assert "Citizen B" not in str(data_a)

    # Query Citizen B
    res_b = await async_client.get(
        "/api/v1/dashboard/summary",
        headers=citizen_user_b["headers"],
    )
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["total_cases"] == 1
    assert data_b["active_cases"] == 1
    assert data_b["recent_case"]["title"] == "Citizen B Family Partition Matter"
    assert "Citizen A" not in str(data_b)
