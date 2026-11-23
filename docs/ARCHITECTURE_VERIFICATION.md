# NyayaSetu (न्यायसेतु) — Architecture & Stack Verification Report

**Verification Date:** November 20, 2026  
**Status:** Empirical Verification Complete · Zero Assumptions  
**Scope:** Root Documentation vs. Actual Source Code Implementation  

---

## 1. Executive Summary

A critical mismatch exists between the repository's root documentation and the actual backend codebase:

| Dimension | Root Documentation Claim (`AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`) | Actual Source Code Implementation (`backend/`) |
|---|---|---|
| **Language & Runtime** | Node.js 22+, TypeScript | **Python 3.12** |
| **Web Framework** | Fastify 5 (`@fastify/*`, `fastify-type-provider-zod`) | **FastAPI 0.115** |
| **ORM / Data Access** | Drizzle ORM (`drizzle-orm`, `drizzle-kit`) | **SQLAlchemy 2.0** (`sqlalchemy.ext.asyncio`, `DeclarativeBase`) |
| **Primary Database** | SQLite (`better-sqlite3`, local file) | **PostgreSQL 16** (Psycopg 3 dialect: `postgresql+psycopg://`) |
| **Geospatial Engine** | None | **PostGIS** (`geoalchemy2`, `Geography(POINT, 4326)`) |
| **Vector Engine** | None | **pgvector** (`pgvector.sqlalchemy`, 768-D dense vectors) |
| **Database Migrations** | `drizzle-kit generate` / `drizzle-kit migrate` | **Alembic** (`backend/alembic.ini`, `backend/migrations/versions/`) |
| **API Port & Prefix** | `http://localhost:4000`, `/api/v1` | **`http://localhost:8000`**, `/api/v1` |
| **Authentication** | Claimed: *"No authentication yet; all endpoints are public"* | **Fully Implemented:** Argon2id password hashing, JWT Bearer tokens, refresh token rotation, RBAC (`CITIZEN`, `ADVOCATE`, `ADMIN`) |
| **Testing Framework** | Vitest | **Pytest 8.2** (`pytest-asyncio`, `httpx`, in-memory SQLite fallback) |
| **Package Management** | npm (`npm run dev`, `npm run setup`) | pip / virtualenv (`requirements.txt`, `python run.py`, `run_dev.sh`) |

> [!IMPORTANT]
> **Preservation Directive:** The user has explicitly mandated that the **Python FastAPI backend must be retained**. No rewrite, migration, or reversion to Node.js / Fastify will take place.

---

## 2. Configuration & Manifest Inventory

We inspected the repository for all configuration manifests referenced in project documentation:

| Target File | Status in Repo | Verification Finding & True Location |
|---|---|---|
| `backend/` | **Present** | Python 3.12 modular monolith containing `app/`, `migrations/`, `tests/`, `docs/`, `scripts/`. |
| `AGENTS.md` | **Present** | Outdated: References Fastify 5, Drizzle, SQLite, `npm run setup`. |
| `docs/ARCHITECTURE.md` | **Present** | Outdated: Documents Fastify plugins, synchronous SQLite, and zero authentication. |
| `docs/API.md` | **Missing** | File does not exist in `docs/`. Counterpart exists at `backend/docs/API_CONTRACT.md`. |
| `docs/DATABASE.md` | **Missing** | File does not exist in `docs/`. Counterpart exists at `backend/docs/DATABASE_SCHEMA.md`. |
| `README.md` | **Present** | Outdated: References Node 22, Fastify, Drizzle, port 4000. |
| `pyproject.toml` | **Missing** | Not present anywhere in the repo. Python dependencies are managed strictly via `requirements.txt`. |
| `requirements.txt` | **Present** | Located at `backend/requirements.txt` (pins FastAPI, SQLAlchemy 2, Alembic, Psycopg 3, PostGIS, pgvector). |
| `alembic.ini` | **Present** | Located at `backend/alembic.ini`. Explicitly configures `script_location = migrations`. |
| `alembic/` (directory) | **Missing as named** | The Alembic script folder is named `backend/migrations/`, NOT `alembic/`. |
| `Dockerfile` | **Missing** | Not present in root or subdirectories. |
| `docker-compose.yml` | **Missing** | Not present in root or subdirectories. |
| `package.json` | **Present (Frontend only)** | Located at `frontend/package.json`. There is **NO root `package.json`** and **NO `backend/package.json`**. |
| `.env.example` | **Present (Backend only)** | Located at `backend/.env.example`. |

---

## 3. Detailed Verification of the 10 Backend Areas

### 3.1 Backend Application Entry Point
* **Files:** `backend/run.py` and `backend/scripts/run_dev.sh`
* **Implementation:**
  * `backend/run.py` invokes `uvicorn.run()` targeting `"app.main:app"`.
  * Binds to `settings.HOST` (`0.0.0.0`) and `settings.PORT` (`8000`).
  * Hot reload is enabled when `settings.DEBUG` and `settings.is_development` are true.
  * Shell script `backend/scripts/run_dev.sh` activates `../venv` or `venv` and runs `python run.py`.

### 3.2 FastAPI Application Initialization
* **File:** `backend/app/main.py`
* **Implementation:**
  * Created via factory `create_application() -> FastAPI`.
  * **Title & Version:** `NyayaSetu Backend API` (v0.1.0).
  * **Interactive Docs:** Mounted at `/docs` (Swagger UI) and `/redoc` (ReDoc) when debug mode is enabled. OpenAPI specification served at `/api/v1/openapi.json`.
  * **Lifecycle (`lifespan`):** Async context manager initializes structured JSON logging on startup and handles graceful shutdown.
  * **CORS Middleware:** `CORSMiddleware` configured with origins from `settings.CORS_ORIGINS` (defaults to `http://localhost:3000`, `http://localhost:3001`, `http://127.0.0.1:3000`).
  * **Centralized Exception Handlers:** Configured in `backend/app/core/errors.py` via `register_exception_handlers(app)`. Standardizes errors to:
    ```json
    {
      "error": {
        "code": "ERROR_CODE",
        "message": "Human readable message",
        "details": {}
      },
      "request_id": "req-uuid"
    }
    ```
  * **Router Mounting:** Mounts `api_v1_router` under prefix `/api/v1`.

### 3.3 SQLAlchemy Database Configuration
* **File:** `backend/app/core/database.py`
* **Implementation:**
  * Built on **SQLAlchemy 2.0** declarative mapping.
  * `Base = DeclarativeBase` includes custom `to_dict()` and `__repr__()` helpers.
  * `TimestampMixin` provides timezone-aware `created_at` and `updated_at` columns across all entities.
  * Async engine initialized via:
    ```python
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DB_ECHO,
        pool_size=settings.DB_POOL_SIZE,        # default 10
        max_overflow=settings.DB_MAX_OVERFLOW,  # default 20
        pool_timeout=settings.DB_POOL_TIMEOUT,  # default 30
        pool_pre_ping=True,
    )
    ```
  * Session factory: `AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)`.
  * Dependency injection: `async def get_db() -> AsyncGenerator[AsyncSession, None]` yields an isolated session with auto-commit on success and rollback on `SQLAlchemyError` or generic exceptions.
  * Standalone context manager `get_db_context()` provided for scripts and background jobs.

### 3.4 PostgreSQL Connection Configuration
* **Files:** `backend/app/core/config.py` and `backend/requirements.txt`
* **Implementation:**
  * Supported drivers: `psycopg[binary]>=3.2.0` (Psycopg 3) and `asyncpg>=0.30.0`.
  * Engine dialect: strictly normalized to `postgresql+psycopg://` via Pydantic validator (`assemble_database_url`).
  * Default development connection string: `postgresql+psycopg://postgres:postgres@localhost:5432/nyayasetu` (compatible with local Postgres or Supabase pooled connection).
  * Synchronous migration connection: `settings.sync_database_url` derived for Alembic DDL operations.
  * SQLite fallback: `TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"` configured for fast in-memory testing (`backend/tests/conftest.py`).

### 3.5 PostGIS and pgvector Extensions
* **Migration:** `backend/migrations/versions/0001_enable_postgresql_extensions.py`
  * DDL executes:
    * `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
    * `CREATE EXTENSION IF NOT EXISTS "postgis";`
    * `CREATE EXTENSION IF NOT EXISTS "vector";`
* **PostGIS Geospatial Implementation:**
  * Dependency: `geoalchemy2>=0.15.0` and `shapely>=2.0.0`.
  * Model: `backend/app/modules/advocates/models.py`:
    `location: Mapped[Optional[Any]] = mapped_column(Geography(geometry_type="POINT", srid=4326, spatial_index=False).with_variant(String, "sqlite"))`
  * Purpose: Stores latitude and longitude of advocate chambers in WGS84 coordinates for proximity-based matching.
* **pgvector Dense Vector Implementation:**
  * Dependency: `pgvector>=0.3.0`.
  * Model: `backend/app/modules/legal_knowledge/models.py`:
    `embedding: Mapped[Optional[Any]] = mapped_column(Vector(settings.EMBEDDING_VECTOR_DIMENSION).with_variant(JSON, "sqlite"))`
  * Purpose: Stores 768-dimensional dense vector embeddings of statutory Bare Act sections and judicial precedents.

### 3.6 Database Models
* **Registry File:** `backend/app/core/models.py`
* **14 Verified Entities Across Modules:**
  1. `users` (`User`): Core identity, email, phone, hashed password, role (`CITIZEN`, `ADVOCATE`, `ADMIN`), language preference.
  2. `refresh_tokens` (`RefreshToken`): JWT session revocation, SHA-256 token hash, client IP, user agent.
  3. `advocate_profiles` (`AdvocateProfile`): Bar Council ID, State Bar name, years of practice, primary/secondary practice areas, practice courts, PostGIS location point, fees, partner status.
  4. `advocate_verifications` (`AdvocateVerification`): Credential document inspection logs.
  5. `advocate_verification_applications` (`AdvocateVerificationApplication`): Formal verification state machine (`PENDING` $\rightarrow$ `SUBMITTED` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `VERIFIED` / `REJECTED`).
  6. `legal_cases` (`LegalCase`): Case files with reference code `NYA-2026-CS-XXXX`, client link, lead advocate link, procedural stage, forum, triage results.
  7. `case_messages` (`CaseMessage`): Privileged matter-specific discussion messages.
  8. `consultation_requests` (`ConsultationRequest`): Intake inquiry submissions.
  9. `appointments` (`Appointment`): Scheduled sessions with reference `NYA-BK-2026-XXXX`, start/end timestamps, mode (`video`, `phone`, `in-person`), fee, payment status.
  10. `legal_sources` (`LegalSource`): Bare Acts, court judgments, official URLs, and SHA-256 checksums.
  11. `legal_chunks` (`LegalChunk`): Granular statutory sections with token counts and pgvector embeddings.
  12. `documents` (`Document`): Private vault files with SHA-256 hashes, storage paths, MIME validation, and confidentiality flags.
  13. `deadlines` (`Deadline`): Limitation Act deadlines with statutory basis, date math, and advocate confirmation status.
  14. `audit_logs` (`AuditLog`): Immutable compliance log for DPDP consent, authentication events, and AI queries.

### 3.7 Alembic Migration Configuration
* **Configuration:** `backend/alembic.ini`
  * Configures `script_location = migrations` and `prepend_sys_path = .`.
* **Runner:** `backend/migrations/env.py`
  * Targets `app.core.models.Base.metadata`.
  * Runs migrations using the synchronous Psycopg 3 engine with `NullPool`.
* **Applied Migration History (8 Revisions in `backend/migrations/versions/`):**
  1. `0001_enable_postgresql_extensions.py`: Enables `uuid-ossp`, `postgis`, `vector`.
  2. `0002_create_core_tables.py`: Creates 12 foundational domain tables.
  3. `0003_add_auth_and_refresh_tokens.py`: Creates `refresh_tokens` table.
  4. `0004_advocate_verification.py`: Creates `advocate_verification_applications` table.
  5. `0005_add_district_to_advocate_profiles.py`: Adds `district` column to advocate profiles.
  6. `0006_case_intake_and_triage.py`: Adds intake tracking and structured triage columns to `legal_cases`.
  7. `0007_legal_sources_metadata.py`: Adds metadata, checksums, and gazette identifiers to `legal_sources`.
  8. `0008_documents_appointments_deadlines.py`: Adds composite indexes and constraints for vault, bookings, and deadlines.

### 3.8 API Routers and Endpoints
* **Assembly File:** `backend/app/api/v1/router.py`
* **14 Mounted Feature Routers Under `/api/v1`:**
  * **System Diagnostic:** `GET /health` (database connectivity probe, latency, version).
  * **Authentication (`/auth`):**
    * `POST /register` — Citizen registration.
    * `POST /register/advocate` — Advocate registration with Bar enrollment.
    * `POST /login` — Password authentication issuing JWT access + refresh tokens.
    * `POST /refresh` — Refresh token rotation.
    * `POST /logout` — Invalidation of active session.
    * `GET /me` — Current profile retrieval.
    * `GET /citizen-only`, `GET /advocate-only`, `GET /admin-only` — RBAC test gates.
  * **Advocates (`/advocates`):** Directory search, profile by ID, verification application submission and status.
  * **Cases (`/cases`):** Create case dossier, paginated list of my cases, case detail, update case, trigger triage.
  * **Triage (`/triage`):** Deterministic 4-path intake assessment (`/assess`).
  * **Matching (`/matching`):** BCI Rule 36 compliant multi-factor advocate matching (`/advocates`, `/cases/{id}/advocates`).
  * **Legal Knowledge (`/legal/sources`):** List Bare Acts, view statutory chunks, seed curated corpus.
  * **Legal Assistant (`/legal/ask` & `/legal-assistant/ask`):** Grounded question answering with statutory citations.
  * **Documents (`/documents`):** Multipart file upload to case, document metadata, authorized 15-minute download token generator, secure streaming download.
  * **Appointments (`/appointments`):** Schedule consultation, list bookings, accept, reject, cancel.
  * **Deadlines (`/deadlines`):** Create deadline, list case deadlines, advocate review confirmation, mark completed.
  * **Admin (`/admin`):** Platform statistics, user account toggling, pending advocate verification review, approve/reject advocate, audit log inspector.

### 3.9 Authentication Implementation
* **Files:** `backend/app/core/security.py`, `backend/app/modules/auth/service.py`, `backend/app/modules/auth/dependencies.py`
* **Implementation:**
  * **Password Hashing:** Uses **Argon2id** via `argon2-cffi` (`time_cost=3`, `memory_cost=64MiB`, `parallelism=4`, `salt_len=16`).
  * **Access Tokens:** Signed JWTs using `pyjwt` with `HS256`, 60-minute expiry (`ACCESS_TOKEN_EXPIRE_MINUTES`).
  * **Refresh Tokens:** Cryptographically unique `jti` identifier, 7-day expiry, stored in `refresh_tokens` table with SHA-256 fingerprint hash. Immediate revocation on rotation or reuse.
  * **RBAC Dependencies:** `get_current_active_user`, `require_roles("CITIZEN")`, `require_roles("ADVOCATE")`, `require_roles("ADMIN")`.
  * **Implementation Distinction:** Email/password credentials, token creation, refresh rotation, and RBAC protection are 100% implemented and tested (11 integration tests in `backend/tests/test_auth.py`). SMS OTP delivery/verification is NOT yet implemented in the backend (the frontend `/login` page simulates OTP and falls back to email/password).

### 3.10 Existing Backend Startup and Setup Commands
* **Verified Commands (from `backend/README.md` and `backend/scripts/run_dev.sh`):**
  ```bash
  # 1. Environment & Dependencies
  cd backend
  python3.12 -m venv ../venv
  source ../venv/bin/activate
  pip install -r requirements.txt
  cp .env.example .env

  # 2. Database Migrations
  alembic upgrade head

  # 3. Start Development Server (Port 8000)
  python run.py
  # OR: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  # OR: ./scripts/run_dev.sh

  # 4. Verify Health & OpenAPI Docs
  python scripts/verify_health.py
  # Swagger UI: http://localhost:8000/docs
  # Health probe: http://localhost:8000/api/v1/health

  # 5. Run Integration Test Suite
  pytest -v
  ```

---

## 4. Documentation Mismatch Matrix

| Document | Current Inaccurate Content | Required Correction |
|---|---|---|
| `AGENTS.md` (lines 8–17, 30–62, 89–100) | States backend is Fastify 5 + Drizzle + SQLite. Commands listed: `npm run setup`, `npm run dev`, `npm run db:migrate`. Rules specify "NodeNext ESM", "FastifyPluginAsyncZod". | Rewrite to specify Python 3.12, FastAPI 0.115, SQLAlchemy 2.0, PostgreSQL/PostGIS/pgvector, Alembic, and `pytest`. Remove all Node/npm backend commands. |
| `README.md` (lines 32–36, 44, 59–85) | Claims backend is Node 22+, Fastify 5, Drizzle, SQLite on port 4000. Commands: `npm run setup`, `npm run dev`. | Update backend description and quick start guide to Python 3.12, FastAPI, PostgreSQL, port 8000, `pip install`, `alembic upgrade head`, and `python run.py`. |
| `docs/ARCHITECTURE.md` (lines 22–32, 84–165) | Describes Fastify instance, synchronous SQLite, `@fastify/*` plugins, and explicitly states *"No authentication yet; all endpoints are public"*. | Replace Section 3 with the actual Modular Monolith FastAPI architecture, SQLAlchemy 2 async engine, PostgreSQL/PostGIS/pgvector, and JWT authentication. |
| `docs/API.md` (missing) | File referenced throughout `AGENTS.md` and `README.md` but does not exist in `docs/`. | Either create `docs/API.md` or symlink/synchronize with `backend/docs/API_CONTRACT.md`. |
| `docs/DATABASE.md` (missing) | File referenced throughout `AGENTS.md` and `README.md` but does not exist in `docs/`. | Either create `docs/DATABASE.md` or symlink/synchronize with `backend/docs/DATABASE_SCHEMA.md`. |
| `frontend/next.config.ts` | Next.js rewrites proxy `/api/v1/:path*` to `BACKEND_API_URL`. Default should point to port 8000 (FastAPI), not port 4000 (Fastify). | Verified: `next.config.ts` already correctly defaults to `http://localhost:8000/api/v1/:path*`. |

---

## 5. Summary of Findings

1. **The Python FastAPI backend is the genuine, living implementation** of NyayaSetu's server layer, complete with 12 domain packages, 14 SQLAlchemy models, 8 Alembic migrations, and 79 passing integration tests.
2. **The Fastify/Drizzle/SQLite documentation is entirely legacy scaffolding** from an earlier project template and does not correspond to any actual backend source files.
3. **No rewrite to Node.js is required or desired.** The appropriate action is to update the repository root documentation (`AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, and `docs/DATABASE.md`) to reflect the Python FastAPI reality.
