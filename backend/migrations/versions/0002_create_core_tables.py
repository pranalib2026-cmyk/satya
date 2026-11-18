"""Create core modular monolith tables.

Revision ID: 0002_core_tables
Revises: 0001_extensions
Create Date: 2026-11-17 15:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from geoalchemy2 import Geography
from pgvector.sqlalchemy import Vector

from app.core.config import settings

# revision identifiers, used by Alembic.
revision: str = "0002_core_tables"
down_revision: Union[str, None] = "0001_extensions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False, server_default="LITIGANT"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("preferred_language", sa.String(length=10), nullable=False, server_default="en"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_created_at", "users", ["created_at"])

    # 2. advocate_profiles table (with PostGIS Geography POINT)
    op.create_table(
        "advocate_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("bar_council_id", sa.String(length=64), nullable=False),
        sa.Column("bar_council_name", sa.String(length=128), nullable=False),
        sa.Column("in_practice_years", sa.Integer(), nullable=False),
        sa.Column("primary_practice", sa.String(length=64), nullable=False),
        sa.Column("secondary_practices", postgresql.ARRAY(sa.String(length=64)), nullable=True),
        sa.Column("courts_of_practice", postgresql.ARRAY(sa.String(length=128)), nullable=True),
        sa.Column("languages", postgresql.ARRAY(sa.String(length=32)), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("is_partner", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("hourly_rate_inr", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("fixed_consultation_fee_inr", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("location", Geography(geometry_type="POINT", srid=4326, spatial_index=True), nullable=True),
        sa.Column("city", sa.String(length=128), nullable=False),
        sa.Column("state", sa.String(length=128), nullable=False),
        sa.Column("pincode", sa.String(length=10), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("in_practice_years >= 0", name="chk_practice_years_positive"),
    )
    op.create_index("ix_advocate_profiles_id", "advocate_profiles", ["id"])
    op.create_index("ix_advocate_profiles_bar_council_id", "advocate_profiles", ["bar_council_id"], unique=True)
    op.create_index("ix_advocate_profiles_primary_practice", "advocate_profiles", ["primary_practice"])
    op.create_index("ix_advocate_profiles_city", "advocate_profiles", ["city"])
    op.create_index("ix_advocate_profiles_created_at", "advocate_profiles", ["created_at"])

    # 3. advocate_verifications table
    op.create_table(
        "advocate_verifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("advocate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("advocate_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("verification_type", sa.String(length=64), nullable=False),
        sa.Column("document_url", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("verified_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_advocate_verifications_id", "advocate_verifications", ["id"])
    op.create_index("ix_advocate_verifications_advocate_id", "advocate_verifications", ["advocate_id"])
    op.create_index("ix_advocate_verifications_status", "advocate_verifications", ["status"])

    # 4. legal_cases table
    op.create_table(
        "legal_cases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_reference", sa.String(length=32), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("lead_advocate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("advocate_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("practice_group", sa.String(length=64), nullable=False),
        sa.Column("matter_type", sa.String(length=64), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("adverse_parties", sa.Text(), nullable=False),
        sa.Column("adverse_counsel", sa.String(length=255), nullable=True),
        sa.Column("conflict_status", sa.String(length=32), nullable=False, server_default="CLEARANCE_PENDING"),
        sa.Column("stage", sa.String(length=32), nullable=False, server_default="INTAKE"),
        sa.Column("urgency", sa.String(length=32), nullable=False, server_default="standard-30d"),
        sa.Column("court_forum", sa.String(length=128), nullable=True),
        sa.Column("disposed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_legal_cases_id", "legal_cases", ["id"])
    op.create_index("ix_legal_cases_case_reference", "legal_cases", ["case_reference"], unique=True)
    op.create_index("ix_legal_cases_client_id", "legal_cases", ["client_id"])
    op.create_index("ix_legal_cases_lead_advocate_id", "legal_cases", ["lead_advocate_id"])
    op.create_index("ix_legal_cases_practice_group", "legal_cases", ["practice_group"])
    op.create_index("ix_legal_cases_conflict_status", "legal_cases", ["conflict_status"])
    op.create_index("idx_legal_cases_practice_status", "legal_cases", ["practice_group", "conflict_status"])

    # 5. case_messages table
    op.create_table(
        "case_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("legal_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("sender_role", sa.String(length=32), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("is_privileged", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_case_messages_id", "case_messages", ["id"])
    op.create_index("ix_case_messages_case_id", "case_messages", ["case_id"])
    op.create_index("ix_case_messages_sender_id", "case_messages", ["sender_id"])

    # 6. consultation_requests table
    op.create_table(
        "consultation_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("reference_code", sa.String(length=32), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("guest_name", sa.String(length=255), nullable=True),
        sa.Column("guest_email", sa.String(length=255), nullable=True),
        sa.Column("guest_phone", sa.String(length=20), nullable=True),
        sa.Column("company_or_city", sa.String(length=255), nullable=True),
        sa.Column("preferred_practice", sa.String(length=64), nullable=False),
        sa.Column("targeted_advocate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("advocate_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_screen", sa.String(length=64), nullable=False, server_default="HOMEPAGE_CONFLICT_FORM"),
        sa.Column("urgency", sa.String(length=32), nullable=False, server_default="standard-30d"),
        sa.Column("legal_problem_summary", sa.Text(), nullable=False),
        sa.Column("adverse_party_names", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="SUBMITTED"),
        sa.Column("non_confidential_acknowledged", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("triage_notes_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_consultation_requests_id", "consultation_requests", ["id"])
    op.create_index("ix_consultation_requests_reference_code", "consultation_requests", ["reference_code"], unique=True)
    op.create_index("ix_consultation_requests_client_id", "consultation_requests", ["client_id"])
    op.create_index("ix_consultation_requests_status", "consultation_requests", ["status"])
    op.create_index("idx_consultation_requests_status_urgency", "consultation_requests", ["status", "urgency"])

    # 7. appointments table
    op.create_table(
        "appointments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("booking_reference", sa.String(length=32), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("legal_cases.id", ondelete="SET NULL"), nullable=True),
        sa.Column("advocate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("advocate_profiles.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scheduled_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="SCHEDULED"),
        sa.Column("mode", sa.String(length=32), nullable=False, server_default="VIDEO_CONFERENCE"),
        sa.Column("meeting_link", sa.Text(), nullable=True),
        sa.Column("fee_inr", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("payment_status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("payment_order_id", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_appointments_id", "appointments", ["id"])
    op.create_index("ix_appointments_booking_reference", "appointments", ["booking_reference"], unique=True)
    op.create_index("ix_appointments_case_id", "appointments", ["case_id"])
    op.create_index("ix_appointments_advocate_id", "appointments", ["advocate_id"])
    op.create_index("ix_appointments_client_id", "appointments", ["client_id"])
    op.create_index("idx_appointments_advocate_schedule", "appointments", ["advocate_id", "scheduled_start"])

    # 8. legal_sources table
    op.create_table(
        "legal_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("short_code", sa.String(length=64), nullable=True),
        sa.Column("citation", sa.String(length=255), nullable=True),
        sa.Column("jurisdiction", sa.String(length=128), nullable=False, server_default="Supreme Court of India / Bharat Central"),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("official_source_url", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_legal_sources_id", "legal_sources", ["id"])
    op.create_index("ix_legal_sources_source_type", "legal_sources", ["source_type"])
    op.create_index("ix_legal_sources_title", "legal_sources", ["title"])
    op.create_index("ix_legal_sources_short_code", "legal_sources", ["short_code"])

    # 9. legal_chunks table (with pgvector embedding)
    op.create_table(
        "legal_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("legal_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_number", sa.String(length=64), nullable=True),
        sa.Column("clause_heading", sa.String(length=255), nullable=True),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("embedding", Vector(settings.EMBEDDING_VECTOR_DIMENSION), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_legal_chunks_id", "legal_chunks", ["id"])
    op.create_index("ix_legal_chunks_source_id", "legal_chunks", ["source_id"])
    op.create_index("ix_legal_chunks_section_number", "legal_chunks", ["section_number"])
    op.create_index("idx_legal_chunks_source_section", "legal_chunks", ["source_id", "section_number"])

    # 10. documents table
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("legal_cases.id", ondelete="CASCADE"), nullable=True),
        sa.Column("uploader_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=False),
        sa.Column("is_confidential", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("document_category", sa.String(length=64), nullable=False, server_default="EVIDENCE"),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_documents_id", "documents", ["id"])
    op.create_index("ix_documents_case_id", "documents", ["case_id"])
    op.create_index("ix_documents_uploader_id", "documents", ["uploader_id"])
    op.create_index("idx_documents_case_category", "documents", ["case_id", "document_category"])

    # 11. deadlines table
    op.create_table(
        "deadlines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("legal_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("statutory_provision", sa.String(length=128), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("priority", sa.String(length=32), nullable=False, server_default="HIGH"),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_deadlines_id", "deadlines", ["id"])
    op.create_index("ix_deadlines_case_id", "deadlines", ["case_id"])
    op.create_index("idx_deadlines_case_due", "deadlines", ["case_id", "due_date"])

    # 12. audit_logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("payload_snapshot", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"])
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("idx_audit_logs_action_created", "audit_logs", ["action", "created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("deadlines")
    op.drop_table("documents")
    op.drop_table("legal_chunks")
    op.drop_table("legal_sources")
    op.drop_table("appointments")
    op.drop_table("consultation_requests")
    op.drop_table("case_messages")
    op.drop_table("legal_cases")
    op.drop_table("advocate_verifications")
    op.drop_table("advocate_profiles")
    op.drop_table("users")
