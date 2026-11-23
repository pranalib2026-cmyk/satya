"""Tests for system health check, database health, and module endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_endpoint(async_client: AsyncClient):
    """Verify that GET /api/v1/health returns HTTP 200 and expected schema including database diagnostic."""
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert "app_name" in data
    assert "version" in data
    assert "environment" in data
    assert "timestamp" in data
    assert "database" in data
    assert "status" in data["database"]
    assert "dialect" in data["database"]
    assert data["database"]["dialect"] == "psycopg3"


@pytest.mark.asyncio
async def test_root_endpoint(async_client: AsyncClient):
    """Verify root endpoint provides discovery links."""
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["health"] == "/api/v1/health"


@pytest.mark.asyncio
async def test_module_skeletons(async_client: AsyncClient):
    """Verify that domain module routers are registered under /api/v1."""
    modules = [
        "auth",
        "users",
        "dashboard",
        "advocates",
        "cases",
        "triage",
        "matching",
        "legal-knowledge",
        "legal-assistant",
        "documents",
        "appointments",
        "deadlines",
        "admin",
    ]

    for mod in modules:
        response = await async_client.get(f"/api/v1/{mod}/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "initialized"
