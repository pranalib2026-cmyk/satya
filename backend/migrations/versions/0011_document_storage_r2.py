"""Add storage_backend and storage_key columns to documents table for Cloudflare R2 migration.

Revision ID: 0011_document_storage_r2
Revises: 0010_legal_document_ingestion_pipeline
Create Date: 2026-11-21 21:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0011_document_storage_r2"
down_revision: Union[str, None] = "0010_legal_document_ingestion_pipeline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add storage_backend column with server default 'local' for backward compatibility
    op.add_column(
        "documents",
        sa.Column("storage_backend", sa.String(length=32), nullable=False, server_default="local"),
    )
    # 2. Add storage_key column for provider-independent object storage key
    op.add_column(
        "documents",
        sa.Column("storage_key", sa.Text(), nullable=True),
    )

    # 3. Create indexes for fast lookup and filtering by storage backend and object key
    op.create_index("ix_documents_storage_backend", "documents", ["storage_backend"])
    op.create_index("ix_documents_storage_key", "documents", ["storage_key"])


def downgrade() -> None:
    op.drop_index("ix_documents_storage_key", table_name="documents")
    op.drop_index("ix_documents_storage_backend", table_name="documents")
    op.drop_column("documents", "storage_key")
    op.drop_column("documents", "storage_backend")
