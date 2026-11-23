"""Chambers Direct Communication and Messaging entity models."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.users.models import User
    from app.modules.cases.models import LegalCase
    from app.modules.appointments.models import Appointment
    from app.modules.documents.models import Document


def utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)


class Conversation(Base, TimestampMixin):
    """Secure, privileged communication thread between two authorized participants."""

    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    participant_one_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    participant_two_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("legal_cases.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Associated legal case dossier if conversation is matter-specific",
    )
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Associated consultation booking if consultation-specific",
    )
    subject: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Descriptive topic or chambers dispatch subject",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="ACTIVE",
        nullable=False,
        index=True,
        comment="ACTIVE | BLOCKED | ARCHIVED",
    )
    blocked_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="User ID who initiated the block action",
    )
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
        comment="Timestamp of the most recent message in this thread",
    )

    # Relationships
    participant_one: Mapped["User"] = relationship(
        "User",
        foreign_keys=[participant_one_id],
    )
    participant_two: Mapped["User"] = relationship(
        "User",
        foreign_keys=[participant_two_id],
    )
    case: Mapped[Optional["LegalCase"]] = relationship(
        "LegalCase",
        foreign_keys=[case_id],
    )
    appointment: Mapped[Optional["Appointment"]] = relationship(
        "Appointment",
        foreign_keys=[appointment_id],
    )
    messages: Mapped[List["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    __table_args__ = (
        Index("idx_conversations_participants", "participant_one_id", "participant_two_id"),
        CheckConstraint("participant_one_id != participant_two_id", name="chk_conversation_distinct_participants"),
    )


class Message(Base, TimestampMixin):
    """Direct confidential message exchanged in a conversation."""

    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    attachment_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    attachment_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    delivery_status: Mapped[str] = mapped_column(
        String(32),
        default="DELIVERED",
        nullable=False,
        comment="DELIVERED | READ",
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="messages",
    )
    sender: Mapped["User"] = relationship(
        "User",
        foreign_keys=[sender_id],
    )
    attachment_document: Mapped[Optional["Document"]] = relationship(
        "Document",
        foreign_keys=[attachment_document_id],
    )

    __table_args__ = (
        Index("idx_messages_conversation_created", "conversation_id", "created_at"),
        Index("idx_messages_unread", "conversation_id", "sender_id", "is_read"),
    )
