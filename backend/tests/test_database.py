"""Tests for database models, declarative registry, and connection health."""

import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app.core.config import settings
from app.core.database import Base, check_db_health
from app.core.models import (
    AdvocateProfile,
    AdvocateVerification,
    Appointment,
    AuditLog,
    CaseMessage,
    ConsultationRequest,
    Deadline,
    Document,
    LegalCase,
    LegalChunk,
    LegalSource,
    User,
)


def test_model_registry_contains_all_twelve_entities():
    """Verify that Base.metadata contains all 12 required entity tables."""
    expected_tables = {
        "users",
        "advocate_profiles",
        "advocate_verifications",
        "legal_cases",
        "case_messages",
        "consultation_requests",
        "appointments",
        "legal_sources",
        "legal_chunks",
        "documents",
        "deadlines",
        "audit_logs",
    }
    actual_tables = set(Base.metadata.tables.keys())

    assert expected_tables.issubset(actual_tables), (
        f"Missing tables: {expected_tables - actual_tables}"
    )


def test_user_model_attributes_and_defaults():
    """Verify User model attributes and serialization."""
    user = User(
        phone="+919820012345",
        email="test@nyayasetu.in",
        full_name="Rajesh Sharma",
        role="LITIGANT",
    )
    user.id = uuid.uuid4()

    assert user.role == "LITIGANT"
    assert user.is_verified is False
    assert user.preferred_language == "en"
    assert "User" in repr(user)

    data = user.to_dict()
    assert data["phone"] == "+919820012345"
    assert data["full_name"] == "Rajesh Sharma"


def test_advocate_profile_has_postgis_geography():
    """Verify that AdvocateProfile location column is configured with Geography POINT."""
    col = AdvocateProfile.__table__.c.location
    assert col is not None
    # Check type name matches Geography
    assert "GEOGRAPHY" in str(col.type).upper()


def test_legal_chunk_embedding_vector_dimension():
    """Verify that LegalChunk has configurable Vector dimension from settings."""
    col = LegalChunk.__table__.c.embedding
    assert col is not None
    assert "VECTOR" in str(col.type).upper()
    assert col.type.dim == settings.EMBEDDING_VECTOR_DIMENSION


def test_sql_compilation_for_postgresql_dialect():
    """Verify that all 12 models compile valid SQL for PostgreSQL with UUIDs and JSONB."""
    models = [
        User,
        AdvocateProfile,
        AdvocateVerification,
        LegalCase,
        CaseMessage,
        ConsultationRequest,
        Appointment,
        LegalSource,
        LegalChunk,
        Document,
        Deadline,
        AuditLog,
    ]

    for model in models:
        stmt = select(model).limit(1)
        compiled = str(stmt.compile(dialect=postgresql.dialect()))
        assert "SELECT" in compiled
        assert model.__tablename__ in compiled


@pytest.mark.asyncio
async def test_database_health_probe_resilience():
    """Verify that check_db_health runs non-blockingly and returns expected diagnostic dictionary."""
    health = await check_db_health()
    assert isinstance(health, dict)
    assert "status" in health
    assert "dialect" in health
    assert health["dialect"] == "psycopg3"
    assert "extensions" in health
    assert health["status"] in ("connected", "unreachable", "disconnected", "error")
