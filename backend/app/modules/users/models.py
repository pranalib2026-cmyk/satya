"""User entity and DPDP Consent models."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.modules.auth.schemas import UserRole

if TYPE_CHECKING:
    from app.modules.advocates.models import AdvocateProfile
    from app.modules.cases.models import LegalCase
    from app.modules.appointments.models import Appointment
    from app.modules.triage.models import ConsultationRequest
    from app.modules.auth.models import RefreshToken


class User(Base, TimestampMixin):
    """User account entity representing citizens, advocates, and administrators."""

    __tablename__ = "users"

    def __init__(self, **kwargs):
        kwargs.setdefault("is_verified", False)
        kwargs.setdefault("is_active", True)
        kwargs.setdefault("role", "CITIZEN")
        kwargs.setdefault("preferred_language", "en")
        super().__init__(**kwargs)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    phone: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
        index=True,
        comment="10-digit Indian mobile number (+91)",
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Argon2id password hash",
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="CITIZEN",
        server_default=text("'CITIZEN'"),
        index=True,
        comment="CITIZEN | ADVOCATE | ADMIN",
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
    )
    preferred_language: Mapped[str] = mapped_column(
        String(10),
        default="en",
        server_default=text("'en'"),
        nullable=False,
        comment="en, hi, mr, ta, te, bn, kn",
    )
    city: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Jurisdictional city / district",
    )
    state: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Jurisdictional state / territory",
    )

    # Relationships
    advocate_profile: Mapped[Optional["AdvocateProfile"]] = relationship(
        "AdvocateProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    cases_as_client: Mapped[List["LegalCase"]] = relationship(
        "LegalCase",
        back_populates="client",
        foreign_keys="[LegalCase.client_id]",
    )
    appointments_as_client: Mapped[List["Appointment"]] = relationship(
        "Appointment",
        back_populates="client",
        foreign_keys="[Appointment.client_id]",
    )
    consultation_requests: Mapped[List["ConsultationRequest"]] = relationship(
        "ConsultationRequest",
        back_populates="client",
    )
    consents: Mapped[List["UserConsent"]] = relationship(
        "UserConsent",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserConsent(Base, TimestampMixin):
    """Digital Personal Data Protection (DPDP) Act, 2023 Consent and Audit Ledger."""

    __tablename__ = "user_consents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    consent_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="terms | privacy | dpdp | share_brief | share_documents",
    )
    version: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="1.0",
        server_default=text("'1.0'"),
    )
    purpose: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Explicit statutory processing purpose",
    )
    action: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="GRANTED",
        server_default=text("'GRANTED'"),
        comment="GRANTED | WITHDRAWN",
    )
    advocate_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        comment="Advocate identifier if scope is case-sharing",
    )
    items_shared: Mapped[Optional[list]] = mapped_column(
        JSONB().with_variant(JSON, "sqlite"),
        nullable=True,
        comment="Array of document names or scope identifiers",
    )
    is_revoked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        index=True,
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45),
        nullable=True,
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
    )

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="consents")

