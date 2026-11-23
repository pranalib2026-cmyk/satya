"""Add processing_status, extracted_text, ocr_confidence, ocr_engine, processing_error, and processed_at to documents table.

Revision ID: 0013_document_ocr_and_processing_status
Revises: 0012_profile_and_privacy
Create Date: 2026-11-22 17:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0013_document_ocr_and_processing_status"
down_revision: Union[str, None] = "0012_profile_and_privacy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("processing_status", sa.String(length=32), nullable=False, server_default="uploaded"),
    )
    op.add_column(
        "documents",
        sa.Column("extracted_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("ocr_confidence", sa.Float(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("ocr_engine", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("processing_error", sa.Text(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_documents_processing_status", "documents", ["processing_status"])


def downgrade() -> None:
    op.drop_index("ix_documents_processing_status", table_name="documents")
    op.drop_column("documents", "processed_at")
    op.drop_column("documents", "processing_error")
    op.drop_column("documents", "ocr_engine")
    op.drop_column("documents", "ocr_confidence")
    op.drop_column("documents", "extracted_text")
    op.drop_column("documents", "processing_status")
