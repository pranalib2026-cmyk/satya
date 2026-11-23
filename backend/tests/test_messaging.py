"""Comprehensive test suite for Chambers Direct Communication & Persistent Messaging."""

import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.modules.admin.models import AuditLog
from app.modules.advocates.models import AdvocateProfile
from app.modules.communication.models import Conversation, Message
from app.modules.users.models import User


async def create_user_and_token(
    async_client: AsyncClient,
    db: AsyncSession,
    role: str = "CITIZEN",
    full_name: str = "Test User",
    email_prefix: str = "user",
) -> dict:
    """Helper creating user record and logging in to obtain JWT access token."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"{email_prefix}_{unique_suffix}@example.com"
    phone = f"+9198{uuid.uuid4().hex[:8]}"
    password = "TestPassword2026!"

    user = User(
        email=email,
        phone=phone,
        password_hash=hash_password(password),
        full_name=full_name,
        role=role,
        is_verified=True,
        is_active=True,
        preferred_language="en",
        city="Mumbai",
        state="Maharashtra",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    advocate_profile = None
    if role == "ADVOCATE":
        advocate_profile = AdvocateProfile(
            user_id=user.id,
            bar_council_id=f"MAH/{uuid.uuid4().hex[:6].upper()}/2018",
            bar_council_name="Bar Council of Maharashtra & Goa",
            in_practice_years=8,
            primary_practice="Trials & Disputes",
            secondary_practices=["Property Law", "Commercial Disputes"],
            courts_of_practice=["Bombay High Court", "City Civil Court, Mumbai"],
            languages=["English", "Marathi", "Hindi"],
            city="Mumbai",
            district="Mumbai",
            state="Maharashtra",
            platform_verification_status="VERIFIED",
            fixed_consultation_fee_inr=1500.0,
            hourly_rate_inr=3500.0,
        )
        db.add(advocate_profile)
        await db.commit()
        await db.refresh(advocate_profile)

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == 200, f"Login failed for {email}: {login_res.text}"
    token = login_res.json()["access_token"]

    return {
        "user": user,
        "advocate_profile": advocate_profile,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.mark.asyncio
async def test_messaging_unauthenticated_rejected(async_client: AsyncClient):
    """Endpoints require valid Bearer token authentication."""
    random_id = uuid.uuid4()

    # List conversations
    res = await async_client.get("/api/v1/conversations")
    assert res.status_code == 401

    # Create conversation
    res = await async_client.post("/api/v1/conversations", json={"recipient_id": str(random_id)})
    assert res.status_code == 401

    # Get conversation details
    res = await async_client.get(f"/api/v1/conversations/{random_id}")
    assert res.status_code == 401

    # Get messages
    res = await async_client.get(f"/api/v1/conversations/{random_id}/messages")
    assert res.status_code == 401

    # Send message
    res = await async_client.post(f"/api/v1/conversations/{random_id}/messages", json={"content": "Hello"})
    assert res.status_code == 401

    # Mark read
    res = await async_client.post(f"/api/v1/conversations/{random_id}/read")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_conversation_creation_and_messaging_flow(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Citizen creates a conversation thread with an advocate and exchanges messages."""
    citizen = await create_user_and_token(async_client, db_session, role="CITIZEN", full_name="Aarav Sharma", email_prefix="aarav")
    advocate = await create_user_and_token(async_client, db_session, role="ADVOCATE", full_name="Adv. Meera Sen", email_prefix="meera")

    # 1. Citizen starts conversation with advocate (passing advocate profile ID)
    create_payload = {
        "recipient_id": str(advocate["advocate_profile"].id),
        "subject": "Preliminary assessment for Tenancy dispute",
        "initial_message": "Good morning Advocate Sen, I need advice regarding an eviction notice.",
    }
    create_res = await async_client.post(
        "/api/v1/conversations",
        headers=citizen["headers"],
        json=create_payload,
    )
    assert create_res.status_code == 201, create_res.text
    conv_data = create_res.json()

    conv_id = conv_data["id"]
    assert conv_data["advocate_name"] == "Adv. Meera Sen"
    assert conv_data["initials"] == "MS"
    assert conv_data["unread"] == 0  # Citizen is the sender, so 0 unread for citizen
    assert conv_data["status"] == "ACTIVE"

    # 2. Verify message history contains the initial message
    msg_res = await async_client.get(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=citizen["headers"],
    )
    assert msg_res.status_code == 200
    msg_data = msg_res.json()
    assert msg_data["total"] == 1
    initial_msg = msg_data["items"][0]
    assert initial_msg["text"] == "Good morning Advocate Sen, I need advice regarding an eviction notice."
    assert initial_msg["from"] == "user"
    assert initial_msg["isRead"] is False
    assert initial_msg["deliveryStatus"] == "DELIVERED"

    # 3. Citizen sends a second follow-up message with an attachment reference
    send_payload = {
        "content": "I have also attached the registered tenancy agreement copy for your review.",
        "attachment_name": "Tenancy_Agreement_Registered_2024.pdf",
    }
    send_res = await async_client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=citizen["headers"],
        json=send_payload,
    )
    assert send_res.status_code == 201
    second_msg = send_res.json()
    assert second_msg["attachmentName"] == "Tenancy_Agreement_Registered_2024.pdf"
    assert second_msg["from"] == "user"

    # Verify total messages is now 2
    msg_res2 = await async_client.get(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=citizen["headers"],
    )
    assert msg_res2.json()["total"] == 2


@pytest.mark.asyncio
async def test_reciprocal_messaging_read_tracking_and_dashboard_counter(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Advocate sees unread message, unread increments in dashboard summary, and decreases on markRead."""
    citizen = await create_user_and_token(async_client, db_session, role="CITIZEN", full_name="Pooja Rao", email_prefix="pooja")
    advocate = await create_user_and_token(async_client, db_session, role="ADVOCATE", full_name="Adv. Vikramaditya Rao", email_prefix="vikram")

    # 1. Citizen sends a message to Advocate
    create_res = await async_client.post(
        "/api/v1/conversations",
        headers=citizen["headers"],
        json={
            "recipient_id": str(advocate["user"].id),
            "subject": "Cheque bounce Section 138 notice",
            "initial_message": "Need urgent assistance with NI Act Section 138 notice deadline.",
        },
    )
    assert create_res.status_code == 201
    conv_id = create_res.json()["id"]

    # 2. Advocate checks dashboard summary before reading
    dash_res_before = await async_client.get(
        "/api/v1/dashboard/summary",
        headers=advocate["headers"],
    )
    assert dash_res_before.status_code == 200
    assert dash_res_before.json()["unread_messages"] == 1
    assert dash_res_before.json()["unreadMessages"] == 1

    # 3. Advocate lists conversations and checks unread count
    adv_convs_res = await async_client.get(
        "/api/v1/conversations",
        headers=advocate["headers"],
    )
    assert adv_convs_res.status_code == 200
    adv_convs = adv_convs_res.json()["items"]
    assert len(adv_convs) == 1
    assert adv_convs[0]["unread"] == 1
    assert adv_convs[0]["advocate_name"] == "Pooja Rao"

    # 4. Advocate marks messages as read
    read_res = await async_client.post(
        f"/api/v1/conversations/{conv_id}/read",
        headers=advocate["headers"],
    )
    assert read_res.status_code == 200
    assert read_res.json()["marked_count"] == 1

    # 5. Advocate checks dashboard summary after reading: should now be 0
    dash_res_after = await async_client.get(
        "/api/v1/dashboard/summary",
        headers=advocate["headers"],
    )
    assert dash_res_after.status_code == 200
    assert dash_res_after.json()["unread_messages"] == 0
    assert dash_res_after.json()["unreadMessages"] == 0

    # 6. Verify message record in DB has is_read=True and read_at populated
    msgs_res = await async_client.get(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=advocate["headers"],
    )
    assert msgs_res.status_code == 200
    read_msg = msgs_res.json()["items"][0]
    assert read_msg["isRead"] is True
    assert read_msg["readAt"] is not None

    # 7. Advocate sends reply
    reply_res = await async_client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=advocate["headers"],
        json={"content": "Received. Section 138 notice has a strict 30-day statutory limitation period. Please share the cheque return memo."},
    )
    assert reply_res.status_code == 201

    # 8. Citizen checks their dashboard summary: unread count is now 1 for citizen
    citizen_dash_res = await async_client.get(
        "/api/v1/dashboard/summary",
        headers=citizen["headers"],
    )
    assert citizen_dash_res.status_code == 200
    assert citizen_dash_res.json()["unread_messages"] == 1


@pytest.mark.asyncio
async def test_multitenant_unauthorized_isolation(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Third-party user C cannot view, post, read, or block conversations between A and B."""
    citizen_a = await create_user_and_token(async_client, db_session, role="CITIZEN", full_name="User A", email_prefix="usera")
    advocate_b = await create_user_and_token(async_client, db_session, role="ADVOCATE", full_name="Advocate B", email_prefix="advb")
    citizen_c = await create_user_and_token(async_client, db_session, role="CITIZEN", full_name="Intruder C", email_prefix="userc")

    # Citizen A starts conversation with Advocate B
    create_res = await async_client.post(
        "/api/v1/conversations",
        headers=citizen_a["headers"],
        json={
            "recipient_id": str(advocate_b["user"].id),
            "subject": "Confidential matter",
            "initial_message": "Private privileged inquiry.",
        },
    )
    assert create_res.status_code == 201
    conv_id = create_res.json()["id"]

    # Citizen C attempts to view the thread metadata
    res = await async_client.get(
        f"/api/v1/conversations/{conv_id}",
        headers=citizen_c["headers"],
    )
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"

    # Citizen C attempts to retrieve messages
    res = await async_client.get(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=citizen_c["headers"],
    )
    assert res.status_code == 403

    # Citizen C attempts to send a message
    res = await async_client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=citizen_c["headers"],
        json={"content": "I am snooping into your private conversation"},
    )
    assert res.status_code == 403

    # Citizen C attempts to mark read
    res = await async_client.post(
        f"/api/v1/conversations/{conv_id}/read",
        headers=citizen_c["headers"],
    )
    assert res.status_code == 403

    # Citizen C attempts to block the conversation
    res = await async_client.post(
        f"/api/v1/conversations/{conv_id}/block",
        headers=citizen_c["headers"],
    )
    assert res.status_code == 403

    # Citizen C's conversation list must NOT contain the conversation
    list_res = await async_client.get(
        "/api/v1/conversations",
        headers=citizen_c["headers"],
    )
    assert list_res.status_code == 200
    assert len(list_res.json()["items"]) == 0


@pytest.mark.asyncio
async def test_validation_empty_and_oversized_messages(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Payload validations reject empty strings, whitespaces, and oversized messages."""
    citizen = await create_user_and_token(async_client, db_session, role="CITIZEN", full_name="User Valid", email_prefix="valid")
    advocate = await create_user_and_token(async_client, db_session, role="ADVOCATE", full_name="Adv Valid", email_prefix="advvalid")

    create_res = await async_client.post(
        "/api/v1/conversations",
        headers=citizen["headers"],
        json={
            "recipient_id": str(advocate["user"].id),
            "subject": "Validation Test",
            "initial_message": "Hello Advocate",
        },
    )
    assert create_res.status_code == 201
    conv_id = create_res.json()["id"]

    # 1. Blank content
    res = await async_client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=citizen["headers"],
        json={"content": ""},
    )
    assert res.status_code == 422

    # 2. Whitespace-only content
    res = await async_client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=citizen["headers"],
        json={"content": "     \n\t   "},
    )
    assert res.status_code == 422

    # 3. Oversized content (> 5000 characters)
    oversized = "A" * 5001
    res = await async_client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=citizen["headers"],
        json={"content": oversized},
    )
    assert res.status_code == 422

    # 4. Self-messaging is rejected
    self_res = await async_client.post(
        "/api/v1/conversations",
        headers=citizen["headers"],
        json={"recipient_id": str(citizen["user"].id)},
    )
    assert self_res.status_code == 400

    # 5. Non-existent recipient
    fake_id = uuid.uuid4()
    notfound_res = await async_client.post(
        "/api/v1/conversations",
        headers=citizen["headers"],
        json={"recipient_id": str(fake_id)},
    )
    assert notfound_res.status_code == 404

    # 6. Non-existent conversation
    non_conv_res = await async_client.get(
        f"/api/v1/conversations/{fake_id}",
        headers=citizen["headers"],
    )
    assert non_conv_res.status_code == 404


@pytest.mark.asyncio
async def test_unrelated_citizens_communication_restricted(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Unsolicited messaging between unrelated citizens without a shared matter is prohibited."""
    citizen_1 = await create_user_and_token(async_client, db_session, role="CITIZEN", full_name="Citizen One", email_prefix="c1")
    citizen_2 = await create_user_and_token(async_client, db_session, role="CITIZEN", full_name="Citizen Two", email_prefix="c2")

    res = await async_client.post(
        "/api/v1/conversations",
        headers=citizen_1["headers"],
        json={"recipient_id": str(citizen_2["user"].id)},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_block_and_report_conversation(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Users can block a thread to prevent inbound messages, and file compliance audit reports."""
    citizen = await create_user_and_token(async_client, db_session, role="CITIZEN", full_name="Citizen Block", email_prefix="cblock")
    advocate = await create_user_and_token(async_client, db_session, role="ADVOCATE", full_name="Advocate Block", email_prefix="ablock")

    create_res = await async_client.post(
        "/api/v1/conversations",
        headers=citizen["headers"],
        json={"recipient_id": str(advocate["user"].id), "initial_message": "Opening dispatch"},
    )
    conv_id = create_res.json()["id"]

    # 1. Citizen reports the conversation
    report_res = await async_client.post(
        f"/api/v1/conversations/{conv_id}/report",
        headers=citizen["headers"],
        json={"reason": "Advocate demanded unauthorized consultation surcharge outside platform rules."},
    )
    assert report_res.status_code == 200

    # Verify audit log was recorded
    audit_stmt = select(AuditLog).where(
        AuditLog.action == "CONVERSATION_REPORTED",
        AuditLog.entity_id == conv_id,
    )
    audit_entry = (await db_session.execute(audit_stmt)).scalar_one_or_none()
    assert audit_entry is not None
    assert audit_entry.actor_id == citizen["user"].id

    # 2. Citizen blocks the conversation
    block_res = await async_client.post(
        f"/api/v1/conversations/{conv_id}/block",
        headers=citizen["headers"],
    )
    assert block_res.status_code == 200
    assert block_res.json()["status"] == "BLOCKED"

    # 3. Advocate attempts to send a message to the blocked conversation -> rejected
    blocked_send = await async_client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=advocate["headers"],
        json={"content": "Trying to send a message to blocked conversation"},
    )
    assert blocked_send.status_code == 400
    assert "blocked" in blocked_send.text.lower()
