"""Deadline entity model for limitation and court calendar tracking."""

import uuid
from typing import TYPE_CHECKING, Optional
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.cases.models import LegalCase
    from app.modules.advocates.models import AdvocateProfile


class Deadline(Base, TimestampMixin):
    """Court hearing date, statutory limitation countdown, or filing compliance deadline."""

    __tablename__ = "deadlines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("legal_cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="e.g., Section 138 15-Day Demand Notice Expiry, Written Statement 30-Day Window",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    deadline_type: Mapped[str] = mapped_column(
        String(64),
        default="STATUTORY_LIMITATION",
        nullable=False,
        index=True,
        comment="STATUTORY_LIMITATION | COURT_HEARING | FILING_RESPONSE | NOTICE_EXPIRY | GENERAL",
    )
    source_basis: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Limitation Act 1963 Schedule, Order VIII Rule 1 CPC, Court Order, Statute",
    )
    statutory_provision: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        comment="Section 138(c) Negotiable Instruments Act, Order VIII Rule 1 CPC, Limitation Act 1963",
    )
    due_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    priority: Mapped[str] = mapped_column(
        String(32),
        default="HIGH",
        nullable=False,
        index=True,
        comment="CRITICAL | HIGH | MEDIUM | LOW",
    )
    is_advocate_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
        comment="Whether a verified legal advocate reviewed and confirmed this deadline",
    )
    confirmed_by_advocate_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("advocate_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    is_completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    reminders_json: Mapped[Optional[dict]] = mapped_column(
        JSONB().with_variant(JSON, "sqlite"),
        nullable=True,
        default=dict,
        comment="Configured notification alerts and sent reminder history",
    )

    # Relationships
    case: Mapped["LegalCase"] = relationship(
        "LegalCase",
        back_populates="deadlines",
    )
    confirmed_by_advocate: Mapped[Optional["AdvocateProfile"]] = relationship(
        "AdvocateProfile",
        foreign_keys=[confirmed_by_advocate_id],
    )

    __table_args__ = (
        Index("idx_deadlines_case_due", "case_id", "due_date"),
    )
