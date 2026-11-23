"""Add city and state to users table and create user_consents table.

Revision ID: 0012_profile_and_privacy
Revises: 0011_document_storage_r2
Create Date: 2026-11-22 12:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0012_profile_and_privacy"
down_revision: Union[str, None] = "0011_document_storage_r2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add city and state columns to users table
    op.add_column("users", sa.Column("city", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("state", sa.String(length=100), nullable=True))
    op.create_index("ix_users_city", "users", ["city"])

    # 2. Create user_consents table
    op.create_table(
        "user_consents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("consent_type", sa.String(length=64), nullable=False),
        sa.Column("version", sa.String(length=20), nullable=False, server_default="1.0"),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False, server_default="GRANTED"),
        sa.Column("advocate_id", sa.String(length=64), nullable=True),
        sa.Column("items_shared", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_index("ix_user_consents_id", "user_consents", ["id"])
    op.create_index("ix_user_consents_user_id", "user_consents", ["user_id"])
    op.create_index("ix_user_consents_consent_type", "user_consents", ["consent_type"])
    op.create_index("ix_user_consents_is_revoked", "user_consents", ["is_revoked"])


def downgrade() -> None:
    op.drop_index("ix_user_consents_is_revoked", table_name="user_consents")
    op.drop_index("ix_user_consents_consent_type", table_name="user_consents")
    op.drop_index("ix_user_consents_user_id", table_name="user_consents")
    op.drop_index("ix_user_consents_id", table_name="user_consents")
    op.drop_table("user_consents")
    op.drop_index("ix_users_city", table_name="users")
    op.drop_column("users", "state")
    op.drop_column("users", "city")
