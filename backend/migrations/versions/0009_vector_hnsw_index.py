"""Add pgvector HNSW cosine distance index on legal_chunks.embedding.

Revision ID: 0009_vector_hnsw_index
Revises: 0008_documents_appointments_deadlines
Create Date: 2026-11-21 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0009_vector_hnsw_index"
down_revision: Union[str, None] = "0008_documents_appointments_deadlines"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create HNSW index for accelerated cosine similarity search (<=>) on legal_chunks.embedding
    op.create_index(
        "ix_legal_chunks_embedding_hnsw",
        "legal_chunks",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_legal_chunks_embedding_hnsw", table_name="legal_chunks")
