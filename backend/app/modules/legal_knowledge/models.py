"""LegalSource and LegalChunk entity models with pgvector embeddings."""

import uuid
from typing import Any, List, Optional
from datetime import date
from sqlalchemy import Date, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from app.core.config import settings
from app.core.database import Base, TimestampMixin


class LegalSource(Base, TimestampMixin):
    """Parent repository entry for Indian statutes, central codes, and landmark judicial decisions."""

    __tablename__ = "legal_sources"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    source_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="BARE_ACT | COURT_JUDGMENT | GAZETTE_NOTIFICATION | LEGAL_AID_SCHEME",
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="e.g. Bharatiya Nyaya Sanhita 2023, Negotiable Instruments Act 1881",
    )
    short_code: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        comment="BNS, BNSS, BSA, ICA, NI_ACT, RERA, CPA_2019",
    )
    citation: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        comment="Act No. 45 of 2023, (2024) 2 SCC 1",
    )
    jurisdiction: Mapped[str] = mapped_column(
        String(128),
        default="Supreme Court of India / Bharat Central",
        nullable=False,
        index=True,
    )
    court: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        index=True,
        comment="Supreme Court of India, Bombay High Court, Delhi High Court",
    )
    act_or_judgment_identifier: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        index=True,
        comment="e.g., Act No. 26 of 1881, Criminal Appeal No. 1234/2023",
    )
    publication_date: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
    )
    last_verified_date: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
    )
    document_version: Mapped[str] = mapped_column(
        String(32),
        default="1.0",
        nullable=False,
    )
    content_checksum: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        comment="SHA-256 hexadecimal hash of verified source text",
    )
    year: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )
    official_source_url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    verification_status: Mapped[str] = mapped_column(
        String(32),
        default="VERIFIED",
        nullable=False,
        index=True,
        comment="PENDING_VERIFICATION | VERIFIED | REJECTED",
    )
    ingestion_status: Mapped[str] = mapped_column(
        String(32),
        default="COMPLETED",
        nullable=False,
        index=True,
        comment="PENDING | PROCESSING | COMPLETED | FAILED",
    )
    raw_content_path: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        comment="File path to raw ingested document artifact",
    )
    metadata_json: Mapped[Optional[dict]] = mapped_column(
        JSONB().with_variant(JSON, "sqlite"),
        nullable=True,
        default=dict,
    )

    # Relationships
    chunks: Mapped[List["LegalChunk"]] = relationship(
        "LegalChunk",
        back_populates="source",
        cascade="all, delete-orphan",
        order_by="LegalChunk.section_number",
    )
    ingestion_jobs: Mapped[List["LegalIngestionJob"]] = relationship(
        "LegalIngestionJob",
        back_populates="source",
        cascade="all, delete-orphan",
    )


class LegalChunk(Base, TimestampMixin):
    """Statutory section or judgment paragraph vector chunk for semantic similarity retrieval."""

    __tablename__ = "legal_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("legal_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    section_number: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        comment="e.g., Section 27, Section 74, Section 138, Section 420",
    )
    clause_heading: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="e.g., Agreement in restraint of trade, void",
    )
    chunk_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    token_count: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    content_checksum: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        comment="SHA-256 hash of chunk content",
    )
    embedding_status: Mapped[str] = mapped_column(
        String(32),
        default="COMPLETED",
        nullable=False,
        index=True,
        comment="PENDING | COMPLETED | FAILED",
    )
    metadata_json: Mapped[Optional[dict]] = mapped_column(
        JSONB().with_variant(JSON, "sqlite"),
        nullable=True,
        default=dict,
    )

    # pgvector embedding: dimension is read dynamically from settings
    # (Configurable per embedding model provider e.g. 768 for Gemini, 1536 for OpenAI)
    embedding: Mapped[Optional[Any]] = mapped_column(
        Vector(settings.EMBEDDING_VECTOR_DIMENSION).with_variant(JSON, "sqlite"),
        nullable=True,
        comment=f"Dense vector embedding (configured dimension: {settings.EMBEDDING_VECTOR_DIMENSION})",
    )

    # Relationships
    source: Mapped["LegalSource"] = relationship(
        "LegalSource",
        back_populates="chunks",
    )

    __table_args__ = (
        Index("idx_legal_chunks_source_section", "source_id", "section_number"),
        Index(
            "ix_legal_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class LegalIngestionJob(Base, TimestampMixin):
    """Tracks legal document ingestion runs, extraction metrics, and error logs."""

    __tablename__ = "legal_ingestion_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("legal_sources.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    file_format: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        comment="PDF | HTML | TXT | JSON",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="PENDING",
        nullable=False,
        index=True,
        comment="PENDING | PROCESSING | COMPLETED | FAILED | DUPLICATE_SKIPPED",
    )
    content_checksum: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        comment="SHA-256 of raw source payload",
    )
    chunks_extracted: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    chunks_embedded: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    details_json: Mapped[Optional[dict]] = mapped_column(
        JSONB().with_variant(JSON, "sqlite"),
        nullable=True,
        default=dict,
    )

    # Relationships
    source: Mapped[Optional["LegalSource"]] = relationship(
        "LegalSource",
        back_populates="ingestion_jobs",
    )
