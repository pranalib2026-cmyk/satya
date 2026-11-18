"""Add advocate verification application and update verifications.

Revision ID: 0004_advocate_verification
Revises: 0003_auth_tokens
Create Date: 2026-11-17 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0004_advocate_verification"
down_revision: Union[str, None] = "0003_auth_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add platform_verification_status to advocate_profiles
    op.add_column(
        "advocate_profiles",
        sa.Column(
            "platform_verification_status",
            sa.String(length=32),
            nullable=False,
            server_default="PENDING",
            comment="PENDING | SUBMITTED | UNDER_REVIEW | NEEDS_MORE_INFORMATION | VERIFIED | REJECTED",
        ),
    )
    op.create_index(
        "ix_advocate_profiles_platform_verification_status",
        "advocate_profiles",
        ["platform_verification_status"],
    )
    op.create_check_constraint(
        "chk_platform_verification_status",
        "advocate_profiles",
        "platform_verification_status IN ('PENDING','SUBMITTED','UNDER_REVIEW','NEEDS_MORE_INFORMATION','VERIFIED','REJECTED')",
    )

    # 2. Create advocate_verification_applications table
    op.create_table(
        "advocate_verification_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "advocate_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("advocate_profiles.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        # Enrollment credentials
        sa.Column("enrollment_number", sa.String(length=64), nullable=False),
        sa.Column("enrollment_number_normalized", sa.String(length=64), nullable=False, unique=True),
        sa.Column("enrollment_name", sa.String(length=255), nullable=False),
        sa.Column("state_bar_council", sa.String(length=128), nullable=False),
        sa.Column("enrollment_date", sa.Date(), nullable=True),
        # AIBE & COP
        sa.Column("aibe_status", sa.String(length=32), nullable=True, server_default="NOT_APPLICABLE"),
        sa.Column("cop_status", sa.String(length=32), nullable=True, server_default="NOT_APPLICABLE"),
        # Contact info
        sa.Column("contact_phone", sa.String(length=20), nullable=True),
        sa.Column("contact_email", sa.String(length=255), nullable=True),
        # Verification workflow
        sa.Column(
            "platform_verification_status",
            sa.String(length=32),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("evidence_level", sa.String(length=32), nullable=True),
        sa.Column("verification_method", sa.String(length=32), nullable=True),
        sa.Column("source_name", sa.String(length=128), nullable=True),
        sa.Column("source_url", sa.String(length=512), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("internal_notes", sa.Text(), nullable=True),
        sa.Column("info_request_message", sa.Text(), nullable=True),
        sa.Column(
            "reviewer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        # Constraints
        sa.CheckConstraint(
            "platform_verification_status IN ('PENDING','SUBMITTED','UNDER_REVIEW','NEEDS_MORE_INFORMATION','VERIFIED','REJECTED')",
            name="chk_app_verification_status",
        ),
        sa.CheckConstraint(
            "evidence_level IS NULL OR evidence_level IN ('DOCUMENTS_REVIEWED','OFFICIAL_ROLL_MATCHED','COUNCIL_CONFIRMED')",
            name="chk_app_evidence_level",
        ),
    )
    op.create_index(
        "ix_verification_apps_id",
        "advocate_verification_applications",
        ["id"],
    )
    op.create_index(
        "ix_verification_apps_advocate_id",
        "advocate_verification_applications",
        ["advocate_id"],
    )
    op.create_index(
        "ix_verification_apps_enrollment_normalized",
        "advocate_verification_applications",
        ["enrollment_number_normalized"],
        unique=True,
    )
    op.create_index(
        "ix_verification_apps_status",
        "advocate_verification_applications",
        ["platform_verification_status"],
    )
    op.create_index(
        "ix_verification_apps_state_bar_council",
        "advocate_verification_applications",
        ["state_bar_council"],
    )

    # 3. Migrate advocate_verifications table to new schema
    # Drop old columns that are being replaced
    op.drop_column("advocate_verifications", "document_url")
    op.drop_column("advocate_verifications", "rejection_reason")
    op.drop_column("advocate_verifications", "verified_by")
    op.drop_column("advocate_verifications", "verified_at")

    # Add new columns
    op.add_column(
        "advocate_verifications",
        sa.Column("storage_key", sa.Text(), nullable=False, server_default="MIGRATION_PLACEHOLDER"),
    )
    op.add_column(
        "advocate_verifications",
        sa.Column("filename", sa.String(length=256), nullable=True),
    )
    op.add_column(
        "advocate_verifications",
        sa.Column("content_type", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "advocate_verifications",
        sa.Column("size_bytes", sa.Integer(), nullable=True),
    )

    # Add check constraint on verification_type
    op.create_check_constraint(
        "chk_verification_doc_type",
        "advocate_verifications",
        "verification_type IN ('ENROLLMENT_CERTIFICATE','BAR_ID_CARD','AIBE_CERTIFICATE','COP_CERTIFICATE')",
    )


def downgrade() -> None:
    # Revert advocate_verifications changes
    op.drop_constraint("chk_verification_doc_type", "advocate_verifications", type_="check")
    op.drop_column("advocate_verifications", "size_bytes")
    op.drop_column("advocate_verifications", "content_type")
    op.drop_column("advocate_verifications", "filename")
    op.drop_column("advocate_verifications", "storage_key")
    op.add_column("advocate_verifications", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("advocate_verifications", sa.Column("verified_by", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("advocate_verifications", sa.Column("rejection_reason", sa.Text(), nullable=True))
    op.add_column("advocate_verifications", sa.Column("document_url", sa.Text(), nullable=False, server_default=""))

    # Drop advocate_verification_applications
    op.drop_table("advocate_verification_applications")

    # Drop advocate_profiles changes
    op.drop_constraint("chk_platform_verification_status", "advocate_profiles", type_="check")
    op.drop_index("ix_advocate_profiles_platform_verification_status", "advocate_profiles")
    op.drop_column("advocate_profiles", "platform_verification_status")
