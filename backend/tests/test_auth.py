"""Comprehensive test suite for Authentication and Authorization."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.modules.users.models import User


# --------------------------------------------------------------------------
# 1. Registration Tests
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_successful_citizen_registration(async_client: AsyncClient):
    """Verify that a citizen can register successfully and receives HTTP 201."""
    payload = {
        "account_type": "CITIZEN",
        "full_name": "Aarav Sharma",
        "email": "aarav.sharma@example.com",
        "phone": "+919876543210",
        "password": "Password123",
        "preferred_language": "hi",
    }
    response = await async_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["full_name"] == "Aarav Sharma"
    assert data["email"] == "aarav.sharma@example.com"
    assert data["role"] == "CITIZEN"
    assert data["is_verified"] is False
    assert "password" not in data
    assert "password_hash" not in data


@pytest.mark.asyncio
async def test_successful_advocate_registration(async_client: AsyncClient):
    """Verify that an advocate can register with Bar Council credentials."""
    payload = {
        "account_type": "ADVOCATE",
        "full_name": "Adv. Rajeshwari Sen",
        "email": "r.sen@nyayasetu.in",
        "phone": "+919811223344",
        "password": "LegalPassword2026",
        "bar_council_id": "D/1234/2006",
        "bar_council_name": "Bar Council of Delhi",
        "in_practice_years": 18,
        "primary_practice": "Trials & Disputes",
        "city": "New Delhi",
        "state": "Delhi",
        "pincode": "110001",
    }
    response = await async_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["full_name"] == "Adv. Rajeshwari Sen"
    assert data["email"] == "r.sen@nyayasetu.in"
    assert data["role"] == "ADVOCATE"


@pytest.mark.asyncio
async def test_duplicate_account_registration(async_client: AsyncClient):
    """Verify that registering with an existing email or phone returns 409 Conflict."""
    payload = {
        "account_type": "CITIZEN",
        "full_name": "Pooja Hegde",
        "email": "pooja.duplicate@example.com",
        "phone": "+919988776655",
        "password": "SecurePassword1",
    }
    # Initial registration
    res1 = await async_client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    # Attempt duplicate email
    dup_email_payload = {**payload, "phone": "+919988776600"}
    res2 = await async_client.post("/api/v1/auth/register", json=dup_email_payload)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["error"]["message"]

    # Attempt duplicate phone
    dup_phone_payload = {**payload, "email": "different.email@example.com"}
    res3 = await async_client.post("/api/v1/auth/register", json=dup_phone_payload)
    assert res3.status_code == 409


@pytest.mark.asyncio
async def test_admin_role_self_assignment_forbidden(async_client: AsyncClient):
    """Verify security rule: users cannot assign themselves the ADMIN role."""
    payload = {
        "account_type": "ADMIN",
        "full_name": "Rogue Admin",
        "email": "rogue.admin@example.com",
        "phone": "+919000000001",
        "password": "HackPassword1",
    }
    response = await async_client.post("/api/v1/auth/register", json=payload)
    # Pydantic validator rejects ADMIN account_type with 422
    assert response.status_code in (400, 403, 422)


# --------------------------------------------------------------------------
# 2. Login Tests
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_successful_login(async_client: AsyncClient):
    """Verify that valid credentials return access & refresh tokens."""
    # 1. Register user
    reg_payload = {
        "account_type": "CITIZEN",
        "full_name": "Devika Nair",
        "email": "devika.login@example.com",
        "phone": "+919871112233",
        "password": "CorrectPassword1",
    }
    await async_client.post("/api/v1/auth/register", json=reg_payload)

    # 2. Login
    login_payload = {
        "email": "devika.login@example.com",
        "password": "CorrectPassword1",
    }
    response = await async_client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 3600
    assert data["user"]["email"] == "devika.login@example.com"
    assert data["user"]["role"] == "CITIZEN"
    assert "password_hash" not in data["user"]


@pytest.mark.asyncio
async def test_incorrect_password(async_client: AsyncClient):
    """Verify that invalid password returns HTTP 401 Unauthorized."""
    # 1. Register user
    reg_payload = {
        "account_type": "CITIZEN",
        "full_name": "Vikram Seth",
        "email": "vikram.seth@example.com",
        "phone": "+919872223344",
        "password": "RealPassword123",
    }
    await async_client.post("/api/v1/auth/register", json=reg_payload)

    # 2. Login with wrong password
    bad_login = {
        "email": "vikram.seth@example.com",
        "password": "WrongPassword999",
    }
    response = await async_client.post("/api/v1/auth/login", json=bad_login)
    assert response.status_code == 401
    assert "Incorrect email address or password" in response.json()["error"]["message"]


@pytest.mark.asyncio
async def test_non_existent_user_login(async_client: AsyncClient):
    """Verify that logging in with non-existent email returns 401."""
    bad_login = {
        "email": "ghost.user@example.com",
        "password": "AnyPassword1",
    }
    response = await async_client.post("/api/v1/auth/login", json=bad_login)
    assert response.status_code == 401


# --------------------------------------------------------------------------
# 3. Protected Routes & Unauthorized Access
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unauthorized_access_to_me(async_client: AsyncClient):
    """Verify that accessing GET /api/v1/auth/me without token returns 401."""
    response = await async_client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Authentication credentials were not provided" in response.json()["error"]["message"]


@pytest.mark.asyncio
async def test_authorized_access_to_me(async_client: AsyncClient):
    """Verify that authenticated user can retrieve their profile with bearer token."""
    # 1. Register
    reg_payload = {
        "account_type": "CITIZEN",
        "full_name": "Meera Joshi",
        "email": "meera.joshi@example.com",
        "phone": "+919873334455",
        "password": "MeeraPassword1",
    }
    await async_client.post("/api/v1/auth/register", json=reg_payload)

    # 2. Login
    login_res = await async_client.post("/api/v1/auth/login", json={
        "email": "meera.joshi@example.com",
        "password": "MeeraPassword1",
    })
    access_token = login_res.json()["access_token"]

    # 3. Call GET /me with token
    headers = {"Authorization": f"Bearer {access_token}"}
    me_res = await async_client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    data = me_res.json()
    assert data["email"] == "meera.joshi@example.com"
    assert data["full_name"] == "Meera Joshi"
    assert data["role"] == "CITIZEN"


# --------------------------------------------------------------------------
# 4. Role-Based Authorization Restrictions
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_role_restrictions(async_client: AsyncClient):
    """Verify that CITIZEN role cannot access ADVOCATE or ADMIN protected endpoints."""
    # 1. Register a CITIZEN
    await async_client.post("/api/v1/auth/register", json={
        "account_type": "CITIZEN",
        "full_name": "Citizen Client",
        "email": "client@example.com",
        "phone": "+919874445566",
        "password": "ClientPassword1",
    })

    # Login
    login_res = await async_client.post("/api/v1/auth/login", json={
        "email": "client@example.com",
        "password": "ClientPassword1",
    })
    citizen_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {citizen_token}"}

    # 2. Allowed: citizen endpoint
    res_cit = await async_client.get("/api/v1/auth/citizen-only", headers=headers)
    assert res_cit.status_code == 200

    # 3. Forbidden: advocate endpoint
    res_adv = await async_client.get("/api/v1/auth/advocate-only", headers=headers)
    assert res_adv.status_code == 403
    assert "Access forbidden" in res_adv.json()["error"]["message"]

    # 4. Forbidden: admin endpoint
    res_adm = await async_client.get("/api/v1/auth/admin-only", headers=headers)
    assert res_adm.status_code == 403


# --------------------------------------------------------------------------
# 5. Refresh Token Rotation & Revocation
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_refresh_token_rotation_and_revocation(async_client: AsyncClient):
    """Verify refresh token rotation and logout revocation."""
    # 1. Register & login
    await async_client.post("/api/v1/auth/register", json={
        "account_type": "CITIZEN",
        "full_name": "Siddharth Roy",
        "email": "siddharth@example.com",
        "phone": "+919875556677",
        "password": "SiddharthPassword1",
    })
    login_res = await async_client.post("/api/v1/auth/login", json={
        "email": "siddharth@example.com",
        "password": "SiddharthPassword1",
    })
    tokens = login_res.json()
    old_refresh = tokens["refresh_token"]

    # 2. Rotate refresh token
    rotate_res = await async_client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert rotate_res.status_code == 200
    new_tokens = rotate_res.json()
    new_refresh = new_tokens["refresh_token"]
    assert new_refresh != old_refresh

    # 3. Old refresh token should now be rejected (reuse detection)
    stale_res = await async_client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert stale_res.status_code == 401

    # 4. Logout using active bearer token
    auth_header = {"Authorization": f"Bearer {new_tokens['access_token']}"}
    logout_res = await async_client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": new_refresh},
        headers=auth_header,
    )
    assert logout_res.status_code == 200

    # 5. Refreshing with logged out token should fail
    after_logout_res = await async_client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh})
    assert after_logout_res.status_code == 401
