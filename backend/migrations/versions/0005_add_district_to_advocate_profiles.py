"""Add district to advocate_profiles.

Revision ID: 0005_advocate_district
Revises: 0004_advocate_verification
Create Date: 2026-11-17 19:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0005_advocate_district"
down_revision: Union[str, None] = "0004_advocate_verification"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "advocate_profiles",
        sa.Column("district", sa.String(length=128), nullable=True),
    )
    op.create_index(
        "ix_advocate_profiles_district",
        "advocate_profiles",
        ["district"],
    )


def downgrade() -> None:
    op.drop_index("ix_advocate_profiles_district", "advocate_profiles")
    op.drop_column("advocate_profiles", "district")
