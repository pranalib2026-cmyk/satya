"""Document entity model for evidence vault and legal filings."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Index, JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.cases.models import LegalCase
    from app.modules.users.models import User


class Document(Base, TimestampMixin):
    """Secure legal file vault record for contracts, petitions, orders, and case evidence."""

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("legal_cases.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    uploader_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    file_size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        comment="application/pdf, image/jpeg, application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    storage_backend: Mapped[str] = mapped_column(
        String(32),
        default="local",
        nullable=False,
        index=True,
        comment="Storage backend identifier: 'local' or 'r2'",
    )
    storage_key: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        index=True,
        comment="Provider-independent object storage key (e.g. vault/cases/{case_id}/{doc_id}_{filename})",
    )
    storage_path: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Encrypted object storage URI / filesystem path for backward compatibility",
    )
    checksum_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="Cryptographic SHA-256 integrity hash",
    )
    is_confidential: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Privileged under DPDP Act 2023 and legal professional secrecy",
    )
    document_category: Mapped[str] = mapped_column(
        String(64),
        default="EVIDENCE",
        nullable=False,
        index=True,
        comment="PETITION | WRITTEN_STATEMENT | AFFIDAVIT | CONTRACT | EVIDENCE | COURT_ORDER",
    )
    processing_status: Mapped[str] = mapped_column(
        String(32),
        default="uploaded",
        nullable=False,
        index=True,
        comment="uploaded | processing | completed | failed",
    )
    extracted_text: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Extracted raw text from native PDF or OCR engine",
    )
    ocr_confidence: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="OCR confidence score 0.0 to 1.0",
    )
    ocr_engine: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        comment="pdf_embedded | gemini_vision | rapidocr | tesseract",
    )
    processing_error: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Detailed error message if extraction or processing failed",
    )
    processed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when OCR extraction finished",
    )
    metadata_json: Mapped[Optional[dict]] = mapped_column(
        JSONB().with_variant(JSON, "sqlite"),
        nullable=True,
        default=dict,
    )

    # Relationships
    case: Mapped[Optional["LegalCase"]] = relationship(
        "LegalCase",
        back_populates="documents",
    )
    uploader: Mapped["User"] = relationship(
        "User",
    )

    __table_args__ = (
        Index("idx_documents_case_category", "case_id", "document_category"),
    )
