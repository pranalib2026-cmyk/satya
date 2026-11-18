"""Add metadata and checksum columns to legal_sources and legal_chunks.

Revision ID: 0007_legal_sources_metadata
Revises: 0006_case_intake_and_triage
Create Date: 2026-11-17 20:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0007_legal_sources_metadata"
down_revision: Union[str, None] = "0006_case_intake_and_triage"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new metadata columns to legal_sources
    op.add_column("legal_sources", sa.Column("court", sa.String(length=128), nullable=True))
    op.add_column("legal_sources", sa.Column("act_or_judgment_identifier", sa.String(length=128), nullable=True))
    op.add_column("legal_sources", sa.Column("publication_date", sa.Date(), nullable=True))
    op.add_column("legal_sources", sa.Column("last_verified_date", sa.Date(), nullable=True))
    op.add_column("legal_sources", sa.Column("document_version", sa.String(length=32), nullable=False, server_default="1.0"))
    op.add_column("legal_sources", sa.Column("content_checksum", sa.String(length=64), nullable=True))

    op.create_index("ix_legal_sources_court", "legal_sources", ["court"])
    op.create_index("ix_legal_sources_act_or_judgment_id", "legal_sources", ["act_or_judgment_identifier"])
    op.create_index("ix_legal_sources_jurisdiction", "legal_sources", ["jurisdiction"])

    # Add checksum and metadata to legal_chunks
    op.add_column("legal_chunks", sa.Column("content_checksum", sa.String(length=64), nullable=True))
    op.add_column("legal_chunks", sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column("legal_chunks", "metadata_json")
    op.drop_column("legal_chunks", "content_checksum")

    op.drop_index("ix_legal_sources_jurisdiction", "legal_sources")
    op.drop_index("ix_legal_sources_act_or_judgment_id", "legal_sources")
    op.drop_index("ix_legal_sources_court", "legal_sources")

    op.drop_column("legal_sources", "content_checksum")
    op.drop_column("legal_sources", "document_version")
    op.drop_column("legal_sources", "last_verified_date")
    op.drop_column("legal_sources", "publication_date")
    op.drop_column("legal_sources", "act_or_judgment_identifier")
    op.drop_column("legal_sources", "court")
