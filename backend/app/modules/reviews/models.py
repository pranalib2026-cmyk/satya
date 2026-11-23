"""Advocate Evaluation and Client Review entity models."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.users.models import User
    from app.modules.advocates.models import AdvocateProfile
    from app.modules.appointments.models import Appointment


def utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)


class Review(Base, TimestampMixin):
    """Verified client evaluation and statutory review for a completed consultation."""

    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
        comment="Associated verified appointment booking ID (strictly 1:1)",
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Authenticated citizen user who attended the consultation",
    )
    advocate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("advocate_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Verified advocate evaluated in this review",
    )
    rating: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
        comment="Client evaluation score between 1 and 5 stars",
    )
    comment: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Optional qualitative client feedback on procedural clarity and consultation",
    )
    tags: Mapped[Optional[List[str]]] = mapped_column(
        JSONB().with_variant(JSON, "sqlite"),
        nullable=True,
        default=list,
        comment="Specific counsel strengths selected by client",
    )
    matter_resolution: Mapped[Optional[str]] = mapped_column(
        String(32),
        nullable=True,
        comment="Matter outcome: 'yes' (Resolved), 'in_progress', 'no' (Advisory only)",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="PUBLISHED",
        nullable=False,
        index=True,
        comment="Moderation state: PENDING | PUBLISHED | REJECTED | HIDDEN",
    )
    moderation_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Administrative rationale if review rejected or hidden",
    )

    # Relationships
    booking: Mapped["Appointment"] = relationship(
        "Appointment",
        foreign_keys=[booking_id],
    )
    reviewer: Mapped["User"] = relationship(
        "User",
        foreign_keys=[reviewer_id],
    )
    advocate: Mapped["AdvocateProfile"] = relationship(
        "AdvocateProfile",
        foreign_keys=[advocate_id],
    )

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="chk_review_rating_range"),
        CheckConstraint(
            "status IN ('PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN')",
            name="chk_review_status",
        ),
        Index("idx_reviews_advocate_status", "advocate_id", "status"),
        Index("idx_reviews_reviewer", "reviewer_id"),
    )
