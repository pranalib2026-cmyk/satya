"""LegalCase and CaseMessage entity models."""

import uuid
from typing import TYPE_CHECKING, List, Optional
from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, JSON, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.users.models import User
    from app.modules.advocates.models import AdvocateProfile
    from app.modules.documents.models import Document
    from app.modules.deadlines.models import Deadline
    from app.modules.appointments.models import Appointment


class LegalCase(Base, TimestampMixin):
    """Core legal matter and court dossier management entity."""

    __tablename__ = "legal_cases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    case_reference: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique public reference e.g., NYA-2026-CC-8421",
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    lead_advocate_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("advocate_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    practice_group: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default="General Legal",
        index=True,
        comment="Trials & Disputes, Corporate & M&A, Employment, Real Estate, etc.",
    )
    matter_type: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default="General Matter",
        comment="Civil Suit, Arbitration, Section 138 NI Act, RERA Complaint, Bail, NCLT",
    )
    summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    adverse_parties: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default="Not specified",
        comment="Full legal names of opposing individuals or corporate entities for conflict checks",
    )
    adverse_counsel: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    conflict_status: Mapped[str] = mapped_column(
        String(32),
        default="CLEARANCE_PENDING",
        nullable=False,
        index=True,
        comment="CLEARANCE_PENDING | CLEARED | CONFLICT_DETECTED",
    )
    stage: Mapped[str] = mapped_column(
        String(32),
        default="INTAKE",
        nullable=False,
        index=True,
        comment="INTAKE | COUNSEL_ASSIGNED | PLEADINGS | HEARING | DISPOSED",
    )
    urgency: Mapped[str] = mapped_column(
        String(32),
        default="standard-30d",
        nullable=False,
        comment="emergency-24h | urgent-48h | standard-30d | exploratory",
    )
    court_forum: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        comment="Supreme Court of India, Bombay High Court, NCLT Mumbai, etc.",
    )
    # ── Case Intake & Triage Attributes ──
    problem_description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Detailed narrative of user's legal issue",
    )
    legal_issue_category: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        comment="Criminal, Family, Property, Consumer, Labour, Corporate, Cheque Bounce, etc.",
    )
    state: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        index=True,
    )
    district: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        index=True,
    )
    relevant_court: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
    )
    incident_date: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
    )
    preferred_language: Mapped[str] = mapped_column(
        String(10),
        default="en",
        server_default=text("'en'"),
        nullable=False,
    )
    supporting_info: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Additional details, witness names, financial values, or background",
    )
    triage_result: Mapped[Optional[dict]] = mapped_column(
        JSONB().with_variant(JSON, "sqlite"),
        nullable=True,
        default=None,
        comment="Stored structured case triage evaluation",
    )
    disposed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    client: Mapped["User"] = relationship(
        "User",
        back_populates="cases_as_client",
        foreign_keys=[client_id],
    )
    lead_advocate: Mapped[Optional["AdvocateProfile"]] = relationship(
        "AdvocateProfile",
        back_populates="cases_as_lead",
        foreign_keys=[lead_advocate_id],
    )
    messages: Mapped[List["CaseMessage"]] = relationship(
        "CaseMessage",
        back_populates="case",
        cascade="all, delete-orphan",
        order_by="CaseMessage.created_at",
    )
    documents: Mapped[List["Document"]] = relationship(
        "Document",
        back_populates="case",
        cascade="all, delete-orphan",
    )
    deadlines: Mapped[List["Deadline"]] = relationship(
        "Deadline",
        back_populates="case",
        cascade="all, delete-orphan",
    )
    appointments: Mapped[List["Appointment"]] = relationship(
        "Appointment",
        back_populates="case",
    )

    __table_args__ = (
        Index("idx_legal_cases_practice_status", "practice_group", "conflict_status"),
    )


class CaseMessage(Base, TimestampMixin):
    """Privileged communication between client, advocate chamber, and platform assistance."""

    __tablename__ = "case_messages"

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
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sender_role: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        comment="CLIENT | ADVOCATE | AI_ASSISTANT | SYSTEM",
    )
    message_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    is_privileged: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Protected by Section 126–129 Bharatiya Sakshya Adhiniyam 2023",
    )
    metadata_json: Mapped[Optional[dict]] = mapped_column(
        JSONB().with_variant(JSON, "sqlite"),
        nullable=True,
        default=dict,
    )

    # Relationships
    case: Mapped["LegalCase"] = relationship(
        "LegalCase",
        back_populates="messages",
    )
    sender: Mapped["User"] = relationship(
        "User",
    )
