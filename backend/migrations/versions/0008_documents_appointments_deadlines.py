"""Add appointment timezone & status columns, and deadline confirmation & type columns.

Revision ID: 0008_documents_appointments_deadlines
Revises: 0007_legal_sources_metadata
Create Date: 2026-11-17 20:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0008_documents_appointments_deadlines"
down_revision: Union[str, None] = "0007_legal_sources_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Appointments updates
    op.add_column("appointments", sa.Column("timezone", sa.String(length=64), nullable=False, server_default="Asia/Kolkata"))
    op.add_column("appointments", sa.Column("client_notes", sa.Text(), nullable=True))
    op.add_column("appointments", sa.Column("rejection_reason", sa.Text(), nullable=True))

    # 2. Deadlines updates
    op.add_column("deadlines", sa.Column("deadline_type", sa.String(length=64), nullable=False, server_default="STATUTORY_LIMITATION"))
    op.add_column("deadlines", sa.Column("source_basis", sa.String(length=255), nullable=True))
    op.add_column("deadlines", sa.Column("is_advocate_confirmed", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("deadlines", sa.Column("confirmed_by_advocate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("advocate_profiles.id", ondelete="SET NULL"), nullable=True))
    op.add_column("deadlines", sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("deadlines", sa.Column("reminders_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    op.create_index("ix_deadlines_deadline_type", "deadlines", ["deadline_type"])
    op.create_index("ix_deadlines_is_advocate_confirmed", "deadlines", ["is_advocate_confirmed"])


def downgrade() -> None:
    op.drop_index("ix_deadlines_is_advocate_confirmed", "deadlines")
    op.drop_index("ix_deadlines_deadline_type", "deadlines")

    op.drop_column("deadlines", "reminders_json")
    op.drop_column("deadlines", "confirmed_at")
    op.drop_column("deadlines", "confirmed_by_advocate_id")
    op.drop_column("deadlines", "is_advocate_confirmed")
    op.drop_column("deadlines", "source_basis")
    op.drop_column("deadlines", "deadline_type")

    op.drop_column("appointments", "rejection_reason")
    op.drop_column("appointments", "client_notes")
    op.drop_column("appointments", "timezone")
