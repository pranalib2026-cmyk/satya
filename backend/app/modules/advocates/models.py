"""AdvocateProfile and AdvocateVerification entity models."""

import uuid
from typing import TYPE_CHECKING, Any, List, Optional
from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geography

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.users.models import User
    from app.modules.cases.models import LegalCase
    from app.modules.appointments.models import Appointment


class AdvocateProfile(Base, TimestampMixin):
    """Advocate professional profile containing Bar Council credentials and geographic location."""

    __tablename__ = "advocate_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    bar_council_id: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
        comment="Bar Council Enrolment ID (e.g., D/1234/2006, MAH/5678/2012)",
    )
    bar_council_name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        comment="State Bar Council (e.g., Bar Council of Delhi, Bar Council of Maharashtra & Goa)",
    )
    in_practice_years: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    primary_practice: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Trials & Disputes, Corporate & M&A, Criminal Defense, Real Estate, etc.",
    )
    secondary_practices: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String(64)).with_variant(JSON, "sqlite"),
        nullable=True,
    )
    courts_of_practice: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String(128)).with_variant(JSON, "sqlite"),
        nullable=True,
        comment="Supreme Court, Delhi High Court, Bombay High Court, NCLT, etc.",
    )
    languages: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String(32)).with_variant(JSON, "sqlite"),
        nullable=True,
        default=list,
    )
    bio: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    is_partner: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    hourly_rate_inr: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    fixed_consultation_fee_inr: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    # PostGIS Geography Location (Spatial GiST index managed via Alembic for PostgreSQL)
    location: Mapped[Optional[Any]] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False).with_variant(String, "sqlite"),
        nullable=True,
        comment="Latitude and Longitude point in WGS84 (SRID 4326)",
    )
    city: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
    )
    district: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        index=True,
    )
    state: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
    )
    pincode: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
    )

    # ── Credential Verification Fields (Step 4) ──
    platform_verification_status: Mapped[str] = mapped_column(
        String(32),
        default="PENDING",
        nullable=False,
        index=True,
        comment="PENDING | SUBMITTED | UNDER_REVIEW | NEEDS_MORE_INFORMATION | VERIFIED | REJECTED",
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="advocate_profile",
    )
    verifications: Mapped[List["AdvocateVerification"]] = relationship(
        "AdvocateVerification",
        back_populates="advocate",
        cascade="all, delete-orphan",
    )
    verification_application: Mapped[Optional["AdvocateVerificationApplication"]] = relationship(
        "AdvocateVerificationApplication",
        back_populates="advocate",
        uselist=False,
        cascade="all, delete-orphan",
    )
    cases_as_lead: Mapped[List["LegalCase"]] = relationship(
        "LegalCase",
        back_populates="lead_advocate",
        foreign_keys="[LegalCase.lead_advocate_id]",
    )
    appointments_as_advocate: Mapped[List["Appointment"]] = relationship(
        "Appointment",
        back_populates="advocate",
        foreign_keys="[Appointment.advocate_id]",
    )

    __table_args__ = (
        CheckConstraint("in_practice_years >= 0", name="chk_practice_years_positive"),
        CheckConstraint(
            "platform_verification_status IN ('PENDING','SUBMITTED','UNDER_REVIEW','NEEDS_MORE_INFORMATION','VERIFIED','REJECTED')",
            name="chk_platform_verification_status",
        ),
    )


class AdvocateVerificationApplication(Base, TimestampMixin):
    """Advocate credential verification application capturing enrollment details and admin workflow."""

    __tablename__ = "advocate_verification_applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    advocate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("advocate_profiles.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Enrollment credentials
    enrollment_number: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="Original enrollment number as entered by the advocate.",
    )
    enrollment_number_normalized: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
        comment="Normalized enrollment number for deduplication.",
    )
    enrollment_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Full name as printed on enrollment certificate.",
    )
    state_bar_council: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
    )
    enrollment_date: Mapped[Optional[Any]] = mapped_column(
        Date,
        nullable=True,
    )

    # AIBE & COP
    aibe_status: Mapped[Optional[str]] = mapped_column(
        String(32),
        nullable=True,
        default="NOT_APPLICABLE",
        comment="PASSED | NOT_APPLICABLE | PENDING",
    )
    cop_status: Mapped[Optional[str]] = mapped_column(
        String(32),
        nullable=True,
        default="NOT_APPLICABLE",
        comment="ACTIVE | EXPIRED | NOT_APPLICABLE",
    )

    # Contact information for verification
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Verification workflow
    platform_verification_status: Mapped[str] = mapped_column(
        String(32),
        default="PENDING",
        nullable=False,
        index=True,
    )
    evidence_level: Mapped[Optional[str]] = mapped_column(
        String(32),
        nullable=True,
        comment="DOCUMENTS_REVIEWED | OFFICIAL_ROLL_MATCHED | COUNCIL_CONFIRMED",
    )
    verification_method: Mapped[Optional[str]] = mapped_column(
        String(32),
        nullable=True,
        comment="AUTOMATIC | MANUAL_ADMIN | OFFICIAL_API",
    )
    source_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    decision_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    internal_notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Admin-only internal notes; never exposed to advocates or citizens.",
    )
    info_request_message: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Message sent to advocate when NEEDS_MORE_INFORMATION.",
    )
    reviewer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    submitted_at: Mapped[Optional[Any]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    decided_at: Mapped[Optional[Any]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Relationships
    advocate: Mapped["AdvocateProfile"] = relationship(
        "AdvocateProfile",
        back_populates="verification_application",
    )
    reviewer: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[reviewer_id],
    )

    __table_args__ = (
        CheckConstraint(
            "platform_verification_status IN ('PENDING','SUBMITTED','UNDER_REVIEW','NEEDS_MORE_INFORMATION','VERIFIED','REJECTED')",
            name="chk_app_verification_status",
        ),
        CheckConstraint(
            "evidence_level IS NULL OR evidence_level IN ('DOCUMENTS_REVIEWED','OFFICIAL_ROLL_MATCHED','COUNCIL_CONFIRMED')",
            name="chk_app_evidence_level",
        ),
    )


class AdvocateVerification(Base, TimestampMixin):
    """Uploaded credential document records linked to the verification application."""

    __tablename__ = "advocate_verifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    advocate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("advocate_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    verification_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="ENROLLMENT_CERTIFICATE | BAR_ID_CARD | AIBE_CERTIFICATE | COP_CERTIFICATE",
    )
    # Private storage key — never exposed publicly
    storage_key: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Internal storage path; never sent in API responses.",
    )
    filename: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    content_type: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    status: Mapped[str] = mapped_column(
        String(32),
        default="PENDING",
        nullable=False,
        index=True,
        comment="PENDING | VERIFIED | REJECTED",
    )

    # Relationships
    advocate: Mapped["AdvocateProfile"] = relationship(
        "AdvocateProfile",
        back_populates="verifications",
    )

    __table_args__ = (
        CheckConstraint(
            "verification_type IN ('ENROLLMENT_CERTIFICATE','BAR_ID_CARD','AIBE_CERTIFICATE','COP_CERTIFICATE')",
            name="chk_verification_doc_type",
        ),
    )
