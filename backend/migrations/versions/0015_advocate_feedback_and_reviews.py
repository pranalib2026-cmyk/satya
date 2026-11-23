"""Add reviews table for verified advocate feedback and evaluations.

Revision ID: 0015_advocate_feedback_and_reviews
Revises: 0014_conversations_and_direct_messaging
Create Date: 2026-11-22 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0015_advocate_feedback_and_reviews"
down_revision: Union[str, None] = "0014_conversations_and_direct_messaging"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "booking_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("appointments.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "reviewer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "advocate_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("advocate_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), "sqlite"),
            nullable=True,
        ),
        sa.Column("matter_resolution", sa.String(length=32), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="PUBLISHED"),
        sa.Column("moderation_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="chk_review_rating_range"),
        sa.CheckConstraint(
            "status IN ('PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN')",
            name="chk_review_status",
        ),
    )
    op.create_index("ix_reviews_id", "reviews", ["id"])
    op.create_index("ix_reviews_booking_id", "reviews", ["booking_id"], unique=True)
    op.create_index("ix_reviews_reviewer_id", "reviews", ["reviewer_id"])
    op.create_index("ix_reviews_advocate_id", "reviews", ["advocate_id"])
    op.create_index("ix_reviews_rating", "reviews", ["rating"])
    op.create_index("ix_reviews_status", "reviews", ["status"])
    op.create_index("idx_reviews_advocate_status", "reviews", ["advocate_id", "status"])
    op.create_index("idx_reviews_reviewer", "reviews", ["reviewer_id"])


def downgrade() -> None:
    op.drop_index("idx_reviews_reviewer", table_name="reviews")
    op.drop_index("idx_reviews_advocate_status", table_name="reviews")
    op.drop_index("ix_reviews_status", table_name="reviews")
    op.drop_index("ix_reviews_rating", table_name="reviews")
    op.drop_index("ix_reviews_advocate_id", table_name="reviews")
    op.drop_index("ix_reviews_reviewer_id", table_name="reviews")
    op.drop_index("ix_reviews_booking_id", table_name="reviews")
    op.drop_index("ix_reviews_id", table_name="reviews")
    op.drop_table("reviews")
