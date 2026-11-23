"""Add conversations and direct messages tables for chambers direct messaging.

Revision ID: 0014_conversations_and_direct_messaging
Revises: 0013_document_ocr_and_processing_status
Create Date: 2026-11-22 18:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0014_conversations_and_direct_messaging"
down_revision: Union[str, None] = "0013_document_ocr_and_processing_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. conversations table
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "participant_one_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "participant_two_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "case_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("legal_cases.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "appointment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("appointments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("subject", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="ACTIVE"),
        sa.Column(
            "blocked_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("last_message_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("participant_one_id != participant_two_id", name="chk_conversation_distinct_participants"),
    )
    op.create_index("ix_conversations_id", "conversations", ["id"])
    op.create_index("ix_conversations_participant_one_id", "conversations", ["participant_one_id"])
    op.create_index("ix_conversations_participant_two_id", "conversations", ["participant_two_id"])
    op.create_index("ix_conversations_case_id", "conversations", ["case_id"])
    op.create_index("ix_conversations_appointment_id", "conversations", ["appointment_id"])
    op.create_index("ix_conversations_status", "conversations", ["status"])
    op.create_index("ix_conversations_last_message_at", "conversations", ["last_message_at"])
    op.create_index("idx_conversations_participants", "conversations", ["participant_one_id", "participant_two_id"])

    # 2. messages table
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("attachment_name", sa.String(length=255), nullable=True),
        sa.Column(
            "attachment_document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivery_status", sa.String(length=32), nullable=False, server_default="DELIVERED"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_messages_id", "messages", ["id"])
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])
    op.create_index("ix_messages_sender_id", "messages", ["sender_id"])
    op.create_index("ix_messages_attachment_document_id", "messages", ["attachment_document_id"])
    op.create_index("ix_messages_is_read", "messages", ["is_read"])
    op.create_index("idx_messages_conversation_created", "messages", ["conversation_id", "created_at"])
    op.create_index("idx_messages_unread", "messages", ["conversation_id", "sender_id", "is_read"])


def downgrade() -> None:
    op.drop_index("idx_messages_unread", table_name="messages")
    op.drop_index("idx_messages_conversation_created", table_name="messages")
    op.drop_index("ix_messages_is_read", table_name="messages")
    op.drop_index("ix_messages_attachment_document_id", table_name="messages")
    op.drop_index("ix_messages_sender_id", table_name="messages")
    op.drop_index("ix_messages_conversation_id", table_name="messages")
    op.drop_index("ix_messages_id", table_name="messages")
    op.drop_table("messages")

    op.drop_index("idx_conversations_participants", table_name="conversations")
    op.drop_index("ix_conversations_last_message_at", table_name="conversations")
    op.drop_index("ix_conversations_status", table_name="conversations")
    op.drop_index("ix_conversations_appointment_id", table_name="conversations")
    op.drop_index("ix_conversations_case_id", table_name="conversations")
    op.drop_index("ix_conversations_participant_two_id", table_name="conversations")
    op.drop_index("ix_conversations_participant_one_id", table_name="conversations")
    op.drop_index("ix_conversations_id", table_name="conversations")
    op.drop_table("conversations")
