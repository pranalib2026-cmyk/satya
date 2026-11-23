# NyayaSetu (न्यायसेतु) — Backend Service

Modular Monolith backend API for **NyayaSetu — AI-Powered Legal Advisor and Advocate Matching Platform for India**.

Built on **Python 3.12**, **FastAPI 0.115**, **SQLAlchemy 2.0 (Asyncio)**, and **PostgreSQL 16** with **PostGIS** geospatial indexing and **pgvector** dense semantic embeddings.

---

## 1. Technology Stack

* **Language & Runtime:** Python 3.12
* **Web Framework:** FastAPI 0.115 + Pydantic v2
* **ASGI Web Server:** Uvicorn 0.30+
* **Database Driver:** Psycopg 3 (`psycopg[binary]>=3.2.0`)
* **ORM:** SQLAlchemy 2.0 (`sqlalchemy.ext.asyncio`)
* **Database Engine:** PostgreSQL 16
* **Spatial Extensions:** PostGIS (`geoalchemy2` + `shapely`)
* **Vector Extensions:** pgvector (`pgvector.sqlalchemy`, 768-dimensional dense vectors)
* **Database Migrations:** Alembic 1.13
* **Password Hashing:** Argon2id (`argon2-cffi`)
* **Authentication Tokens:** PyJWT (HS256) with database-backed refresh token rotation
* **Automated Testing:** Pytest 8.2 + `pytest-asyncio` + HTTPX (uses SQLite `:memory:` via `aiosqlite`)

---

## 2. Directory Structure

```text
backend/
├── app/
│   ├── main.py                  # FastAPI application factory, CORS, exception handlers
│   ├── core/                    # Core infrastructure: config, database, security, errors
│   │   ├── config.py            # Pydantic BaseSettings environment loader
│   │   ├── database.py          # SQLAlchemy 2.0 async engine & session management
│   │   ├── security.py          # Argon2id password hashing & PyJWT token utilities
│   │   ├── errors.py            # Centralized exception classes & HTTP error handlers
│   │   ├── logging.py           # Structured JSON application logger
│   │   └── models.py            # Consolidated DeclarativeBase registry for Alembic
│   ├── api/v1/
│   │   ├── health.py            # Health probe & database latency check
│   │   └── router.py            # Central version 1 router assembling domain modules
│   ├── modules/                 # 12 Modular Monolith Domain Packages
│   │   ├── auth/                # Identity, login, registration, token rotation
│   │   ├── users/               # Citizens and advocate profile accounts
│   │   ├── advocates/           # Advocate credentials, bar roll admissions, verification
│   │   ├── cases/               # Matter dossiers (NYA-2026-CS-XXXX), conflict clearance
│   │   ├── triage/              # Case intake categorization & deterministic routing
│   │   ├── matching/            # Multi-factor advocate matching algorithm (BCI Rule 36)
│   │   ├── legal_knowledge/     # Bare Acts, gazettes, judgments & pgvector chunk ingestion
│   │   ├── legal_assistant/     # Grounded statutory RAG & citation validator
│   │   ├── documents/           # Private document vault & short-lived signed tokens
│   │   ├── appointments/        # Consultation booking, slot hold, confirmation
│   │   ├── deadlines/           # Limitation Act 1963 calculation & court hearings
│   │   └── admin/               # Platform oversight, advocate verification, audit logs
│   ├── integrations/            # External service adapters (Gemini, SMS gateways)
│   └── shared/                  # Common schemas & pagination models
├── migrations/                  # Alembic migration revisions (versions/) & env.py
├── scripts/                     # Operational scripts (run_dev.sh, verify_health.py)
├── tests/                       # Pytest automated integration test suites (113 tests)
├── docs/                        # API Contract, Database Schema & Architecture specs
├── requirements.txt             # Pinned production dependencies
├── alembic.ini                  # Alembic configuration
├── pytest.ini                   # Pytest test configuration
├── run.py                       # Uvicorn server launcher
└── .env.example                 # Template environment variables
```

---

## 3. Setup & Installation Guide

### Step 1: Virtual Environment Creation
Ensure Python 3.12 is installed:

```bash
cd backend

# Create virtual environment in the parent directory (or local venv)
python3.12 -m venv ../venv
source ../venv/bin/activate
# On Windows PowerShell: ..\venv\Scripts\Activate.ps1
```

### Step 2: Install Pinned Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
Copy the template configuration file:

```bash
cp .env.example .env
```

Open `.env` in your editor and configure your database and environment settings:
* `DATABASE_URL`: Connection string for PostgreSQL (Psycopg 3 dialect: `postgresql+psycopg://username:password@localhost:5432/nyayasetu`).
* `SECRET_KEY`: A random 32+ character secret string for signing JWT tokens.
* `ENVIRONMENT`: Environment mode (`development`, `production`, or `testing`).
* `AI_PROVIDER`: AI provider strategy (`mock` for offline testing without external API calls, `gemini` for live Google GenAI).
* `GEMINI_API_KEY`: Google Gemini API key (required in production or when `AI_PROVIDER=gemini`).
* `GEMINI_LLM_MODEL`: Grounded LLM model identifier (default: `gemini-2.5-flash`).
* `GEMINI_EMBEDDING_MODEL`: Dense statutory vector embedding model (default: `text-embedding-004`, 768-D).

---

## 4. PostgreSQL Connection & Database Migrations

### Required Extensions
The database requires `uuid-ossp`, `postgis`, and `vector`. They are automatically created by the first Alembic migration:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";
```

### Run Migrations
Apply all schema revisions to your database:

```bash
alembic upgrade head
```

### Generate a New Migration
When modifying or creating SQLAlchemy models in `app/modules/`:

```bash
alembic revision --autogenerate -m "describe_your_model_changes"
alembic upgrade head
```

---

## 5. Running the Development Server

### Command Option A: Launcher Script (Recommended)
```bash
python run.py
```

### Command Option B: Direct Uvicorn CLI
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Command Option C: Shell Runner
```bash
./scripts/run_dev.sh
```

---

## 6. API Documentation & Diagnostic Probes

Once the server is running on `http://localhost:8000`:

* **Interactive Swagger UI:** <http://localhost:8000/docs>
* **Alternative ReDoc UI:** <http://localhost:8000/redoc>
* **OpenAPI Schema (JSON):** <http://localhost:8000/api/v1/openapi.json>
* **System Health Check Probe:** <http://localhost:8000/api/v1/health>

You can also run the automated health probe verification script:
```bash
python scripts/verify_health.py
```

---

## 7. Running Automated Test Suites

All backend tests use an isolated, in-memory SQLite database (`sqlite+aiosqlite`) via SQLAlchemy `.with_variant()` clauses, so no live PostgreSQL connection is needed to run tests:

```bash
# Run all 79 integration tests
pytest -v

# Run tests with output capture disabled
pytest -v -s

# Run a specific domain module test
pytest tests/test_auth.py -v
pytest tests/test_legal_ai_assistant.py -v
pytest tests/test_advocate_matching.py -v
```

---

## 8. Detailed Specifications

* **API Endpoints & Contract:** [`../docs/API.md`](../docs/API.md)
* **Database Schema & Models:** [`../docs/DATABASE.md`](../docs/DATABASE.md)
* **Backend Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
* **Development & Operations:** [`../docs/DEVELOPMENT.md`](../docs/DEVELOPMENT.md)
