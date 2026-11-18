"""ConsultationRequest entity model for intake triage."""

import uuid
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Boolean, ForeignKey, Index, JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.users.models import User
    from app.modules.advocates.models import AdvocateProfile


class ConsultationRequest(Base, TimestampMixin):
    """Citizen or enterprise legal consultation intake before case creation or advocate engagement."""

    __tablename__ = "consultation_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    reference_code: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        nullable=False,
        index=True,
        comment="e.g. NYA-2026-CC-8421, NYA-2026-QC-7294, NYA-2026-WIZ-5120",
    )
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Linked registered user if authenticated, null for guest intake",
    )
    guest_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    guest_email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    guest_phone: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        index=True,
    )
    company_or_city: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    preferred_practice: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    targeted_advocate_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("advocate_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_screen: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="HOMEPAGE_CONFLICT_FORM",
        comment="HOMEPAGE_CONFLICT_FORM | CONTACT_WIZARD | QUICK_CONSULT_MODAL | TRANSPARENCY_PREVIEW",
    )
    urgency: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="standard-30d",
        comment="emergency-24h | urgent-48h | upcoming-30d | none-yet",
    )
    legal_problem_summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    adverse_party_names: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Names of adverse or opposing entities disclosed for conflict check",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="SUBMITTED",
        nullable=False,
        index=True,
        comment="SUBMITTED | CONFLICT_CHECKING | CLEARED | CONFLICT_FLAGGED | MATCHED | REJECTED",
    )
    non_confidential_acknowledged: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    triage_notes_json: Mapped[Optional[dict]] = mapped_column(
        JSONB().with_variant(JSON, "sqlite"),
        nullable=True,
        default=dict,
        comment="AI triage hints, extracted statutes, and recommended advocates",
    )

    # Relationships
    client: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="consultation_requests",
    )
    targeted_advocate: Mapped[Optional["AdvocateProfile"]] = relationship(
        "AdvocateProfile",
    )

    __table_args__ = (
        Index("idx_consultation_requests_status_urgency", "status", "urgency"),
    )
