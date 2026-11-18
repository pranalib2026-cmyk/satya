"""Enable PostgreSQL extensions: uuid-ossp, postgis, and vector.

Revision ID: 0001_extensions
Revises: 
Create Date: 2026-11-17 15:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0001_extensions"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable UUID generator
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    # 2. Enable PostGIS geospatial engine
    op.execute('CREATE EXTENSION IF NOT EXISTS "postgis";')
    # 3. Enable pgvector dense vector similarity engine
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector";')


def downgrade() -> None:
    op.execute('DROP EXTENSION IF EXISTS "vector";')
    op.execute('DROP EXTENSION IF EXISTS "postgis";')
    op.execute('DROP EXTENSION IF EXISTS "uuid-ossp";')
