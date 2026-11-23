"""Add legal ingestion jobs table and status columns to legal_sources and chunks.

Revision ID: 0010_legal_document_ingestion_pipeline
Revises: 0009_vector_hnsw_index
Create Date: 2026-11-21 13:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0010_legal_document_ingestion_pipeline"
down_revision: Union[str, None] = "0009_vector_hnsw_index"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add verification and ingestion status columns to legal_sources
    op.add_column(
        "legal_sources",
        sa.Column("verification_status", sa.String(length=32), nullable=False, server_default="VERIFIED"),
    )
    op.add_column(
        "legal_sources",
        sa.Column("ingestion_status", sa.String(length=32), nullable=False, server_default="COMPLETED"),
    )
    op.add_column(
        "legal_sources",
        sa.Column("raw_content_path", sa.String(length=512), nullable=True),
    )
    op.create_index("ix_legal_sources_verification_status", "legal_sources", ["verification_status"])
    op.create_index("ix_legal_sources_ingestion_status", "legal_sources", ["ingestion_status"])

    # 2. Add embedding status to legal_chunks
    op.add_column(
        "legal_chunks",
        sa.Column("embedding_status", sa.String(length=32), nullable=False, server_default="COMPLETED"),
    )
    op.create_index("ix_legal_chunks_embedding_status", "legal_chunks", ["embedding_status"])

    # 3. Create legal_ingestion_jobs table
    op.create_table(
        "legal_ingestion_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("legal_sources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_title", sa.String(length=255), nullable=False),
        sa.Column("file_format", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("content_checksum", sa.String(length=64), nullable=True),
        sa.Column("chunks_extracted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("chunks_embedded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("details_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_legal_ingestion_jobs_source_id", "legal_ingestion_jobs", ["source_id"])
    op.create_index("ix_legal_ingestion_jobs_status", "legal_ingestion_jobs", ["status"])
    op.create_index("ix_legal_ingestion_jobs_checksum", "legal_ingestion_jobs", ["content_checksum"])
    op.create_index("ix_legal_ingestion_jobs_source_title", "legal_ingestion_jobs", ["source_title"])


def downgrade() -> None:
    op.drop_table("legal_ingestion_jobs")

    op.drop_index("ix_legal_chunks_embedding_status", table_name="legal_chunks")
    op.drop_column("legal_chunks", "embedding_status")

    op.drop_index("ix_legal_sources_ingestion_status", table_name="legal_sources")
    op.drop_index("ix_legal_sources_verification_status", table_name="legal_sources")
    op.drop_column("legal_sources", "raw_content_path")
    op.drop_column("legal_sources", "ingestion_status")
    op.drop_column("legal_sources", "verification_status")
