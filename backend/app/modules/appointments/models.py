"""Appointment entity model for consultations."""

import uuid
from typing import TYPE_CHECKING, Optional
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.users.models import User
    from app.modules.advocates.models import AdvocateProfile
    from app.modules.cases.models import LegalCase


class Appointment(Base, TimestampMixin):
    """Scheduled client-advocate consultation session with fixed-fee tracking."""

    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    booking_reference: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        nullable=False,
        index=True,
        comment="Public tracking reference e.g., NYA-BK-2026-9042",
    )
    case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("legal_cases.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    advocate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("advocate_profiles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    scheduled_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    scheduled_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="REQUESTED",
        nullable=False,
        index=True,
        comment="REQUESTED | SCHEDULED | CONFIRMED | REJECTED | COMPLETED | CANCELLED | RESCHEDULED | NO_SHOW",
    )
    timezone: Mapped[str] = mapped_column(
        String(64),
        default="Asia/Kolkata",
        nullable=False,
        comment="IANA Timezone string e.g. Asia/Kolkata",
    )
    client_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Initial problem briefing or meeting request notes",
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Advocate rationale if appointment request rejected",
    )
    mode: Mapped[str] = mapped_column(
        String(32),
        default="VIDEO_CONFERENCE",
        nullable=False,
        comment="VIDEO_CONFERENCE | IN_CHAMBERS | PHONE",
    )
    meeting_link: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    fee_inr: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="Agreed fixed consultation fee or hourly base fee in INR",
    )
    payment_status: Mapped[str] = mapped_column(
        String(32),
        default="PENDING",
        nullable=False,
        index=True,
        comment="PENDING | PAID | REFUNDED | WAIVED",
    )
    payment_order_id: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
    )

    # Relationships
    case: Mapped[Optional["LegalCase"]] = relationship(
        "LegalCase",
        back_populates="appointments",
    )
    advocate: Mapped["AdvocateProfile"] = relationship(
        "AdvocateProfile",
        back_populates="appointments_as_advocate",
        foreign_keys=[advocate_id],
    )
    client: Mapped["User"] = relationship(
        "User",
        back_populates="appointments_as_client",
        foreign_keys=[client_id],
    )

    __table_args__ = (
        Index("idx_appointments_advocate_schedule", "advocate_id", "scheduled_start"),
    )
