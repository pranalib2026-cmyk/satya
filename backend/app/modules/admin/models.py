"""AuditLog entity model for regulatory and security auditing."""

import uuid
from typing import TYPE_CHECKING, Optional
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Index, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.modules.users.models import User


class AuditLog(Base):
    """Immutable audit trail for BCI regulatory compliance, conflict queries, and data access logs."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="User performing action, null if unauthenticated or automated system",
    )
    action: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        comment="CONFLICT_QUERY_RUN | CASE_STATUS_CHANGE | DOCUMENT_DOWNLOADED | APPOINTMENT_BOOKED",
    )
    entity_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="legal_cases | consultation_requests | documents | appointments",
    )
    entity_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45),
        nullable=True,
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    payload_snapshot: Mapped[Optional[dict]] = mapped_column(
        JSONB().with_variant(JSON, "sqlite"),
        nullable=True,
        default=dict,
        comment="Immutable cryptographic record of request / state delta",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    actor: Mapped[Optional["User"]] = relationship(
        "User",
    )

    __table_args__ = (
        Index("idx_audit_logs_action_created", "action", "created_at"),
    )
