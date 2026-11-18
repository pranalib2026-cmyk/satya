"""Add case intake fields and triage result to legal_cases.

Revision ID: 0006_case_intake_and_triage
Revises: 0005_advocate_district
Create Date: 2026-11-17 20:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0006_case_intake_and_triage"
down_revision: Union[str, None] = "0005_advocate_district"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new intake columns
    op.add_column("legal_cases", sa.Column("problem_description", sa.Text(), nullable=True))
    op.add_column("legal_cases", sa.Column("legal_issue_category", sa.String(length=64), nullable=True))
    op.add_column("legal_cases", sa.Column("state", sa.String(length=128), nullable=True))
    op.add_column("legal_cases", sa.Column("district", sa.String(length=128), nullable=True))
    op.add_column("legal_cases", sa.Column("relevant_court", sa.String(length=128), nullable=True))
    op.add_column("legal_cases", sa.Column("incident_date", sa.Date(), nullable=True))
    op.add_column("legal_cases", sa.Column("preferred_language", sa.String(length=10), nullable=False, server_default="en"))
    op.add_column("legal_cases", sa.Column("supporting_info", sa.Text(), nullable=True))
    op.add_column("legal_cases", sa.Column("triage_result", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    op.create_index("ix_legal_cases_legal_issue_category", "legal_cases", ["legal_issue_category"])
    op.create_index("ix_legal_cases_state", "legal_cases", ["state"])
    op.create_index("ix_legal_cases_district", "legal_cases", ["district"])

    # Relax legacy non-null columns for intake flexibility
    op.alter_column("legal_cases", "summary", existing_type=sa.Text(), nullable=True)
    op.alter_column("legal_cases", "adverse_parties", existing_type=sa.Text(), nullable=True)
    op.alter_column("legal_cases", "practice_group", existing_type=sa.String(length=64), nullable=True)
    op.alter_column("legal_cases", "matter_type", existing_type=sa.String(length=64), nullable=True)


def downgrade() -> None:
    op.alter_column("legal_cases", "matter_type", existing_type=sa.String(length=64), nullable=False)
    op.alter_column("legal_cases", "practice_group", existing_type=sa.String(length=64), nullable=False)
    op.alter_column("legal_cases", "adverse_parties", existing_type=sa.Text(), nullable=False)
    op.alter_column("legal_cases", "summary", existing_type=sa.Text(), nullable=False)

    op.drop_index("ix_legal_cases_district", "legal_cases")
    op.drop_index("ix_legal_cases_state", "legal_cases")
    op.drop_index("ix_legal_cases_legal_issue_category", "legal_cases")

    op.drop_column("legal_cases", "triage_result")
    op.drop_column("legal_cases", "supporting_info")
    op.drop_column("legal_cases", "preferred_language")
    op.drop_column("legal_cases", "incident_date")
    op.drop_column("legal_cases", "relevant_court")
    op.drop_column("legal_cases", "district")
    op.drop_column("legal_cases", "state")
    op.drop_column("legal_cases", "legal_issue_category")
    op.drop_column("legal_cases", "problem_description")
