# NyayaSetu Architecture

> Consolidated from: `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE.md`, `docs/adr/0001-backend-stack.md`.

## Current Architecture Baseline

NyayaSetu is an India-focused legal technology platform with two independent applications:

- **Frontend (`frontend/`)**: Next.js 16.4.5 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Framer Motion, Three.js.
- **Backend (`backend/`)**: Python 3.12, FastAPI 0.115, Pydantic v2, SQLAlchemy 2.0 async, PostgreSQL 16 with PostGIS and pgvector, Alembic, Argon2id/PyJWT auth.

> [!IMPORTANT]
> The Python FastAPI backend in `backend/` is the sole authoritative backend. Do not introduce a second backend framework or duplicate ORM layer. Historical docs may reference earlier Node/Fastify/SQLite experiments; those are superseded where they conflict with current code.


---

## System Architecture (Canonical)

# Architecture Specification — NyayaSetu (न्यायसेतु)

**Document Status:** Production Architecture Baseline  
**Verified Implementation:** Next.js 16 Client + Python 3.12 FastAPI Modular Monolith + PostgreSQL 16 (PostGIS & pgvector)  

---

## 1. System Overview & Context

NyayaSetu is architected as an India-centric legal intelligence and advocate discovery platform. The system is partitioned into two independent applications operating in concert:
1. **Frontend (`frontend/`):** A public web application built on Next.js 16 (App Router) and React 19, offering legal marketing, citizen matter intake, case dossier tracking, document management, and verified advocate matching.
2. **Backend (`backend/`):** A high-performance Python 3.12 Modular Monolith built with FastAPI 0.115, SQLAlchemy 2.0 (Asyncio), and PostgreSQL 16. It handles authentication, role-based authorization, case management, deterministic legal triage, geospatial advocate discovery (PostGIS), evidence document vault, statutory limitation tracking, and grounded retrieval-augmented generation (pgvector).

```mermaid
flowchart TD
    subgraph ClientLayer["Client & User Layer"]
        CitizenBrowser["Citizen / Litigant Browser"]
        AdvocateBrowser["Advocate Chamber Browser"]
        AdminBrowser["Platform Admin Browser"]
    end

    subgraph FrontendApp["Frontend (Next.js 16 + React 19 on :3000)"]
        PagesRouter["App Router Pages (/dashboard, /practices, /login)"]
        UIPrimitives["Editorial Components & Three.js Canvas"]
        ServiceClient["Services Layer (src/services/dashboard/)"]
        AuthCtx["AuthContext (JWT Session Storage)"]
        NextProxy["Next.js API Rewrite Proxy (/api/v1/* -> :8000)"]
    end

    subgraph BackendAPI["Backend Modular Monolith (FastAPI 0.115 on :8000)"]
        APIRouter["API Router (/api/v1)"]
        Security["Security Layer (Argon2id + PyJWT + RBAC)"]
        
        subgraph DomainModules["Domain Modules (backend/app/modules/)"]
            M_Auth["Auth & Tokens"]
            M_Cases["Cases & Dossiers"]
            M_Triage["Intake & Triage"]
            M_Advocates["Advocates & Verification"]
            M_Matching["Advocate Matching"]
            M_Knowledge["Legal Knowledge Corpus"]
            M_RAG["Legal AI Assistant (RAG)"]
            M_Docs["Document Vault"]
            M_Appts["Appointments & Booking"]
            M_Deadlines["Statutory Deadlines"]
            M_Admin["Admin Governance"]
        end

        SQLAlchemyEngine["SQLAlchemy 2.0 Async Engine (Psycopg 3)"]
    end

    subgraph DataStore["Data & Persistence Layer"]
        PostgresDB[("PostgreSQL 16 Database")]
        PostGIS["PostGIS Spatial Engine (Advocate Chamber Coordinates)"]
        PGVector["pgvector Dense Embeddings (768-D Bare Act Chunks)"]
        VaultStorage["Private Document Vault Storage (storage/vault/)"]
    end

    subgraph ExternalIntegrations["External Services & Integrations"]
        GeminiAPI["Google Gemini API (Generative AI & Embeddings)"]
        IndiaCode["Official IndiaCode & e-Gazette Sources"]
    end

    CitizenBrowser --> PagesRouter
    AdvocateBrowser --> PagesRouter
    AdminBrowser --> PagesRouter

    PagesRouter --> ServiceClient
    ServiceClient --> AuthCtx
    ServiceClient --> NextProxy
    NextProxy --> APIRouter

    APIRouter --> Security
    Security --> DomainModules

    M_Knowledge --> PGVector
    M_Advocates --> PostGIS
    M_Docs --> VaultStorage
    M_RAG --> GeminiAPI
    M_Knowledge -.-> IndiaCode

    DomainModules --> SQLAlchemyEngine
    SQLAlchemyEngine --> PostgresDB
    PostgresDB --- PostGIS
    PostgresDB --- PGVector
```

---

## 2. Frontend Architecture (`frontend/`)

The frontend delivers an authoritative, calm editorial visual language anchored by the homepage design standard.

### 2.1 Core Technologies
* **Framework:** Next.js 16.4.5 (App Router)
* **UI Library:** React 19.3.0
* **Language:** TypeScript 5
* **Styling:** Tailwind CSS 4 with custom editorial design tokens:
  * Warm ivory page base: `#f4efe6`
  * Card paper surface: `#fffaf2`
  * Deep espresso typography: `#2a1c12`
  * Antique bronze accents: `#9a6a35`
  * Sharp rectangular borders: `rounded-[2px]`
* **3D Visuals:** Three.js with `@react-three/fiber` and `@react-three/drei` (Lady Justice sculpture in hero).
* **Icons:** `lucide-react`
* **API Proxy:** Configured in `frontend/next.config.ts`, transparently rewriting `/api/v1/:path*` to `http://localhost:8000/api/v1/:path*`.

### 2.2 Client Layering
1. **Pages & Layouts (`src/app/`):** Next.js App Router structure with public marketing (`/`, `/practices`, `/matters`, `/insights`, `/firm`, `/contact`), authentication (`/login`), and unified dashboard workspaces (`/dashboard/*`).
2. **Components (`src/components/`):** Atomic UI primitives (`Button`, `Card`, `Badge`, `Modal`), layout navigation (`Navbar`, `Footer`, `Sidebar`), and 3D scenes.
3. **Services (`src/services/dashboard/`):** Strongly typed domain clients communicating with backend endpoints:
   * `cases.ts` $\rightarrow$ `POST /api/v1/cases`, `GET /api/v1/cases`
   * `intake.ts` & `triage.ts` $\rightarrow$ `POST /api/v1/triage/assess`
   * `chat.ts` $\rightarrow$ `POST /api/v1/legal/ask`
   * `advocates.ts` $\rightarrow$ `GET /api/v1/matching/advocates`
   * `bookings.ts` $\rightarrow$ `POST /api/v1/appointments`
   * `documents.ts` $\rightarrow$ `POST /api/v1/documents/cases/{id}/upload`
   * `deadlines.ts` $\rightarrow$ `GET /api/v1/deadlines`
4. **State & Authentication (`src/lib/auth-context.tsx`):** React Context managing JWT access tokens, active user role (`CITIZEN`, `ADVOCATE`, `ADMIN`), language selection (`en`, `hi`, `kn`), and session persistence in `localStorage`.

---

## 3. Backend Architecture (`backend/`)

The backend is built as a **Modular Monolith** in Python 3.12 with FastAPI. A modular monolith optimizes developer velocity while maintaining strict domain cohesion and clean architectural separation.

### 3.1 Structural Map
```text
backend/
├── app/
│   ├── main.py                  # ASGI factory, CORS, exception handlers, lifecycle
│   ├── core/                    # Foundational infrastructure
│   │   ├── config.py            # Pydantic BaseSettings (env configuration)
│   │   ├── database.py          # SQLAlchemy 2.0 async engine & session management
│   │   ├── security.py          # Argon2id password hasher & PyJWT manager
│   │   ├── errors.py            # Centralized exception hierarchy
│   │   ├── logging.py           # Structured JSON logger
│   │   └── models.py            # Consolidated DeclarativeBase model registry
│   ├── api/v1/
│   │   ├── health.py            # Diagnostic health & readiness probes
│   │   └── router.py            # Central router mounting all 14 domain routers
│   ├── modules/                 # 12 Autonomous Domain Packages
│   │   ├── auth/                # Identity, login, registration, token rotation
│   │   ├── users/               # User profiles and status management
│   │   ├── advocates/           # Advocate profiles, bar roll credentials, verification
│   │   ├── cases/               # Case dockets (NYA-2026-CS-XXXX), milestones, stages
│   │   ├── triage/              # Case intake categorization & deterministic routing
│   │   ├── matching/            # Multi-factor advocate matching algorithm
│   │   ├── legal_knowledge/     # Bare Acts, gazettes, judgments & chunk ingestion
│   │   ├── legal_assistant/     # Grounded statutory RAG & citation validator
│   │   ├── documents/           # Private document vault & short-lived signed tokens
│   │   ├── appointments/        # Consultation slot hold, booking, confirmation
│   │   ├── deadlines/           # Limitation Act 1963 calculation & court hearings
│   │   └── admin/               # Platform oversight, advocate verification, audits
│   ├── integrations/            # External SDK adapters (Gemini, SMS gateways)
│   └── shared/                  # Reusable pagination and envelope schemas
├── migrations/                  # Alembic migration environment and version revisions
├── scripts/                     # Operational scripts (run_dev.sh, verify_health.py)
├── tests/                       # Pytest test suites (79 passing tests)
├── requirements.txt             # Pinned production dependencies
└── run.py                       # Uvicorn entry point
```

### 3.2 Request Lifecycle & Layered Responsibilities
1. **Network Ingress:** Uvicorn ASGI server receives HTTP request on port 8000.
2. **CORS & Logging:** Request ID is injected; execution time and client metadata are tracked in JSON format.
3. **Routing & Authentication:** Route handler validates parameters using Pydantic v2 schemas and enforces role guards:
   ```python
   current_user: User = Depends(get_current_active_user)
   # Or role-specific:
   dependencies=[Depends(require_roles("ADVOCATE"))]
   ```
4. **Service Execution:** Handler delegates execution to a domain Service class (`CaseService`, `AuthService`, `DocumentService`, `MatchingService`).
5. **Database Interaction:** Service utilizes an injected asynchronous `AsyncSession` (`get_db()`). Automatic commit occurs upon function exit; any unhandled exception triggers an automatic rollback.
6. **Error Normalization:** Centralized exception handlers catch `AppException`, `RequestValidationError`, or `SQLAlchemyError` and format the response into a standard error envelope.

---

## 4. Persistence & Database Architecture

### 4.1 Database Engine & Configuration
* **Primary Database:** PostgreSQL 16 (local instance or managed Supabase).
* **Async Engine:** SQLAlchemy 2.0 initialized with Psycopg 3 (`postgresql+psycopg://`):
  * `pool_size = 10`
  * `max_overflow = 20`
  * `pool_timeout = 30`
  * `pool_pre_ping = True` (detects disconnected sockets before issuing queries)
* **Test Database:** SQLite in-memory engine via `aiosqlite` (`sqlite+aiosqlite:///./test.db`) utilizing SQLAlchemy's `.with_variant()` constructs to ensure tests run rapidly in any environment without external PostgreSQL dependencies.

### 4.2 PostGIS Geospatial Engine
* **Extension:** `postgis` enabled in revision `0001_extensions`.
* **Model:** `AdvocateProfile.location` mapped as:
  ```python
  location: Mapped[Optional[Any]] = mapped_column(
      Geography(geometry_type="POINT", srid=4326, spatial_index=False)
      .with_variant(String, "sqlite"),
      nullable=True,
      comment="Latitude and Longitude point in WGS84 (SRID 4326)"
  )
  ```
* **Functionality:** Calculates spherical distance between a litigant's district/city and advocate chambers, contributing a 25% weight in the matching algorithm.

### 4.3 pgvector Dense Embeddings
* **Extension:** `vector` enabled in revision `0001_extensions`.
* **Model:** `LegalChunk.embedding` mapped as:
  ```python
  embedding: Mapped[Optional[Any]] = mapped_column(
      Vector(settings.EMBEDDING_VECTOR_DIMENSION)
      .with_variant(JSON, "sqlite"),
      nullable=True,
      comment="Dense vector embedding (configured dimension: 768)"
  )
  ```
* **Functionality:** Stores 768-dimensional normalized embeddings for semantic similarity search over Bare Act sections and judgments.

### 4.4 Alembic Migration Architecture
* Configuration defined in `backend/alembic.ini` (`script_location = migrations`).
* Environment runner in `backend/migrations/env.py` binds to `settings.sync_database_url`.
* 8 sequential migration revisions present in `backend/migrations/versions/`:
  1. `0001_extensions` — Enables `uuid-ossp`, `postgis`, `vector`.
  2. `0002_core_tables` — Creates 12 foundational domain tables.
  3. `0003_auth` — Creates `refresh_tokens` session table.
  4. `0004_advocate_verification` — Creates `advocate_verification_applications` table.
  5. `0005_district` — Adds `district` to `advocate_profiles`.
  6. `0006_case_intake` — Adds intake triage tracking to `legal_cases`.
  7. `0007_sources_metadata` — Adds gazette metadata to `legal_sources`.
  8. `0008_documents_appointments_deadlines` — Adds indexes for vault and limitation deadlines.

---

## 5. Authentication & Authorization Security

### 5.1 Password Hashing (Argon2id)
All credentials are encrypted using **Argon2id** via `argon2-cffi` configured with OWASP parameters:
* Time cost: 3 iterations
* Memory cost: 65,536 KiB (64 MiB)
* Parallelism: 4 lanes
* Hash length: 32 bytes
* Salt length: 16 bytes

### 5.2 JWT Session Management
* **Access Tokens:** Signed via `pyjwt` with algorithm `HS256`. Carries claims: `sub` (User UUID), `role` (`CITIZEN` | `ADVOCATE` | `ADMIN`), `iat`, `exp` (60 minutes), and `iss` (`NyayaSetu Backend API`).
* **Refresh Tokens:** Issued with a unique cryptographic `jti` UUID and a 7-day expiry. Stored in the `refresh_tokens` database table as a SHA-256 fingerprint hash (`hash_token`). Tokens are rotated upon each refresh; reuse invalidates all sessions for that token family.

### 5.3 Role-Based Access Control (RBAC)
FastAPI dependency injectors enforce strict role isolation:
* `require_roles("CITIZEN")`: Restricts case filing and personal evidence upload.
* `require_roles("ADVOCATE")`: Restricts hearing acceptance, professional credential management, and matter progression.
* `require_roles("ADMIN")`: Restricts advocate verification approvals, platform statistics, and immutable audit logs. Self-assignment of the `ADMIN` role is blocked at the schema boundary.

---

## 6. Document Vault & Private Storage Architecture

Client evidence documents, tenancy contracts, dishonoured cheque memos, and court summonses are subject to strict privacy controls:
1. **Physical Storage:** Stored on disk under private path `backend/storage/vault/` (outside any publicly accessible web root).
2. **Access Control:** No public URLs or static file servers exist. Downloading requires:
   * A valid Bearer JWT of the verified case owner or assigned counsel, OR
   * A short-lived, signed download token (15-minute expiry) issued by `GET /api/v1/documents/{id}/access-token`.
3. **Integrity Validation:** Every file undergoes SHA-256 byte stream hashing upon upload and MIME type verification against an explicit whitelist (`application/pdf`, `image/jpeg`, `image/png`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`).

---

## 7. Retrieval-Augmented Generation (RAG) Architecture

The Legal AI Assistant (`POST /api/v1/legal/ask`) enforces strict statutory grounding against verified Indian Bare Acts:

```mermaid
sequenceDiagram
    autonumber
    actor Litigant as Citizen / Litigant
    participant API as FastAPI Assistant (/legal/ask)
    participant DB as PostgreSQL (pgvector)
    participant LLM as Grounded LLM Provider
    participant Validator as Citation Validator

    Litigant->>API: Query: "Cheque bounced 20 days ago, what to do?"
    API->>API: Detect Language (English / Hindi / Kannada)
    API->>DB: Dense Vector + Keyword Retrieval (LegalChunks)
    DB-->>API: Top-K Statutory Chunks (Sec 138 & 142 NI Act)
    API->>LLM: Synthesize Grounded Narrative (Strict Context Only)
    LLM-->>API: Candidate Answer with Claimed References
    API->>Validator: Validate Citations Against Retrieved Chunks
    Note over Validator: Prune ungrounded citations & hallucinated acts
    Validator-->>API: Verified Citations + SHA-256 Checksums
    API-->>Litigant: Grounded Answer + Official Gazette URLs + Non-Advice Disclaimer
```

1. **Language Detection:** Detects Devanagari (`hi`), Kannada (`kn`), or English (`en`).
2. **Hybrid Retrieval:** Executes cosine similarity queries using pgvector against `LegalChunk` embeddings paired with statutory keyword filters.
3. **Grounded Synthesis:** Providers synthesize answers strictly within the boundaries of retrieved context. If sources are insufficient, the engine explicitly declines to provide ungrounded advice.
4. **Citation Validation:** `CitationValidator` cross-references every claimed act, section, and case against the retrieved context, stripping ungrounded statements and attaching official e-Gazette/IndiaCode URLs and content checksums.

---

## 8. Summary of Active Ports & Environments

| Component | Default Port | Internal Route / URL | Production Target |
|---|---|---|---|
| **Frontend** | `3000` | `http://localhost:3000` | Vercel / Edge CDN |
| **Backend API** | `8000` | `http://localhost:8000` | Docker / AWS ECS / Render |
| **API Documentation** | `8000` | `http://localhost:8000/docs` | Disabled in production |
| **Health Probe** | `8000` | `http://localhost:8000/api/v1/health` | Container Orchestrator Probes |
| **Database** | `5432` | `postgresql+psycopg://...:5432/nyayasetu` | Managed PostgreSQL 16 (Supabase / RDS) |


---

## Architecture Verification Report

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
| `docs/API.md` | **Missing** | File does not exist in `docs/`. Counterpart exists at `docs/API.md`. |
| `docs/DATABASE.md` | **Missing** | File does not exist in `docs/`. Counterpart exists at `docs/DATABASE.md`. |
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
| `docs/API.md` (missing) | File referenced throughout `AGENTS.md` and `README.md` but does not exist in `docs/`. | Either create `docs/API.md` or symlink/synchronize with `docs/API.md`. |
| `docs/DATABASE.md` (missing) | File referenced throughout `AGENTS.md` and `README.md` but does not exist in `docs/`. | Either create `docs/DATABASE.md` or symlink/synchronize with `docs/DATABASE.md`. |
| `frontend/next.config.ts` | Next.js rewrites proxy `/api/v1/:path*` to `BACKEND_API_URL`. Default should point to port 8000 (FastAPI), not port 4000 (Fastify). | Verified: `next.config.ts` already correctly defaults to `http://localhost:8000/api/v1/:path*`. |

---

## 5. Summary of Findings

1. **The Python FastAPI backend is the genuine, living implementation** of NyayaSetu's server layer, complete with 12 domain packages, 14 SQLAlchemy models, 8 Alembic migrations, and 79 passing integration tests.
2. **The Fastify/Drizzle/SQLite documentation is entirely legacy scaffolding** from an earlier project template and does not correspond to any actual backend source files.
3. **No rewrite to Node.js is required or desired.** The appropriate action is to update the repository root documentation (`AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, and `docs/DATABASE.md`) to reflect the Python FastAPI reality.


---

## Project Architecture Audit

# NyayaSetu (न्यायसेतु) — Project Architecture Audit

**Date of Audit:** November 19, 2026  
**Auditor:** Senior Principal Systems Architect & Legal Technology Specialist  
**Repository State:** Dual-stack legal platform (Next.js 16 Frontend + FastAPI/PostgreSQL Backend)  
**Status:** Audit Complete · Zero Code Modifications (Phase 1)

---

## 1. Executive Summary

NyayaSetu is an Indian legal platform bridging citizens, MSMEs, and verified advocates across District Courts, High Courts, and the Supreme Court of India. The project consists of two distinct components:

1. **Frontend (`frontend/`):** A Next.js 16.4.5 (App Router, React 19.3, Tailwind CSS 4) web application. It features a public-facing editorial marketing site, a dual-role authentication screen, and a 20-route authenticated client portal (`/dashboard/*`). Currently, the frontend operates entirely on client-side static arrays (`src/data/`) and browser-local mock service layers (`src/services/dashboard/`), with no live API calls to the backend.
2. **Backend (`backend/`):** A modular monolith built on Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 (async), Alembic, and PostgreSQL with PostGIS (`geoalchemy2`) and pgvector (`pgvector.sqlalchemy`). It features 12 core database entities, 8 migrations, 79 passing automated tests, Argon2id/JWT authentication, a private encrypted document vault, an objective advocate matching engine, and a Retrieval-Augmented Generation (RAG) assistant grounded in curated Indian Bare Acts.

### Key Finding on Visual Architecture
The application currently exhibits a **visual split**:
- **The Homepage (`/`) and marketing pages:** Implement a bespoke, dignified, editorial design system inspired by classical legal publishing—warm paper tones (`#f4efe6`, `#f3ece1`, `#fffaf2`), deep espresso roast typography (`#2a1c12`), muted umber accents (`#5b4a3b`), antique bronze highlights (`#9a6a35`), crisp square borders (`rounded-none` / `rounded-[2px]`), serif display typography (`Gambetta`), and stamp badges.
- **The Login screen (`/login`) and Dashboard portal (`/dashboard/*`):** Diverge into a generic modern SaaS aesthetic with rounded pill containers (`rounded-2xl`, `rounded-xl`), sans-serif display typography (forced via `dashboard.css`), soft pastel colored chips, and mobile-first container styling that clashes with the homepage's authoritative judicial aesthetic.

---

## 2. Frontend Architecture

### 2.1 Technology Stack & Dependencies
* **Framework:** Next.js 16.4.5 (App Router, Server Components + Client Boundary islands)
* **Runtime:** Node.js (NodeNext) / React 19.3.0
* **Language:** TypeScript 5
* **Styling:** Tailwind CSS 4 (`@import "tailwindcss";` in `src/app/globals.css`)
* **Motion & Animation:** Framer Motion 14
* **3D Visuals:** Three.js via `@react-three/fiber` (v9) and `@react-three/drei` (v10) hosting the Lady Justice GLB canvas (`src/components/3d/lady-justice-canvas.tsx`)
* **Icons:** `lucide-react`
* **Utilities:** `clsx`, `tailwind-merge` in `src/lib/utils.ts`

### 2.2 Directory Layout
```text
frontend/
├── public/
│   └── models/lady-justice/       # Lady Justice 3D asset & PBR textures
├── src/
│   ├── app/                       # App Router routes & layouts
│   │   ├── layout.tsx             # Root layout with fonts, metadata, Navbar/Footer
│   │   ├── globals.css            # Root design tokens & typography scale
│   │   ├── page.tsx               # Homepage (Design Reference)
│   │   ├── login/page.tsx         # Login & 3-step citizen onboarding
│   │   ├── dashboard/             # Authenticated legal portal
│   │   │   ├── layout.tsx         # Portal shell (Sidebar, Topbar, Language switcher)
│   │   │   ├── dashboard.css      # Scoped CSS overrides for .dashboard-scope
│   │   │   └── [subroutes]/       # 20 feature subpages
│   │   ├── practices/             # Practice areas directory
│   │   ├── people/                # Advocates directory
│   │   ├── matters/               # Representative matters ledger
│   │   ├── insights/              # Legal guides and articles
│   │   ├── firm/                  # Firm background, timeline & pro bono
│   │   ├── contact/               # Conflict check intake form
│   │   ├── privacy/ & disclaimer/ # Legal compliance disclosures
│   │   └── not-found.tsx          # Custom 404
│   ├── components/
│   │   ├── 3d/                    # Three.js canvas & WebGL loaders
│   │   ├── layout/                # Container, Section, Navbar, Footer, BackToTop
│   │   ├── sections/              # Homepage marketing section blocks
│   │   ├── ui/                    # Editorial UI primitives (Button, Card, Badge, Input, etc.)
│   │   └── dashboard/             # Dashboard-specific UI primitives (Button, Card, Badge, Modal, etc.)
│   ├── data/                      # Static mock data arrays (practices, lawyers, matters, faqs)
│   ├── lib/                       # Utilities, auth-context, dashboard-ui-context, time helpers
│   ├── services/dashboard/        # Mock service adapters (auth, chat, intake, triage, bookings, etc.)
│   └── types/                     # Shared TypeScript interfaces & types
```

### 2.3 State Management & Client Services
The frontend does **not** make HTTP requests to the backend. It uses React Context and mock service abstractions:
1. `AuthContext` (`src/lib/auth-context.tsx`): Stores authenticated state (`demoUser`), active role (`citizen` or `advocate`), selected language (`en`, `hi`, `mr`, `ta`, `te`, `bn`), and onboarding completion in browser `localStorage`.
2. `DashboardUIContext` (`src/lib/dashboard-ui-context.tsx`): Manages toast notifications and accessibility toggles.
3. `services/dashboard/*`: 10 mock service modules (`auth.ts`, `chat.ts`, `intake.ts`, `triage.ts`, `advocates.ts`, `deadlines.ts`, `documents.ts`, `bookings.ts`, `messages.ts`, `consent.ts`). They simulate asynchronous network latency with `setTimeout` and operate on in-memory mock data.

---

## 3. Backend Architecture

### 3.1 Technology Stack & Engine
* **Runtime:** Python 3.12
* **Framework:** FastAPI 0.115.14
* **Schema Validation & Settings:** Pydantic v2 & Pydantic-Settings
* **ORM:** SQLAlchemy 2.0.58 (Strict Async Mode using `async_sessionmaker`)
* **Driver:** `psycopg` (Psycopg 3 with native async connection pooling)
* **Migrations:** Alembic 1.14.x
* **Extensions:**
  - `postgis` / `geoalchemy2` (Spatial indexing for advocate chamber locations)
  - `vector` / `pgvector` (Dense semantic embeddings for legal statutes)
  - `uuid-ossp` (Native RFC 4122 UUID generation)
* **Security:** `argon2-cffi` (Argon2id password hashing), `PyJWT` (HMAC-SHA256 tokens)
* **Testing:** Pytest 8.4.2 + `pytest-asyncio` + `httpx` (79 automated tests passing against in-memory SQLite with full PostgreSQL static SQL generation)

### 3.2 Directory Structure
```text
backend/
├── alembic.ini                    # Migration engine configuration
├── app/
│   ├── main.py                    # Application factory, CORS, exception handlers, lifecycle
│   ├── core/
│   │   ├── config.py              # Centralized Pydantic BaseSettings
│   │   ├── database.py            # Async engine, sessionmaker, Base model, health probe
│   │   ├── errors.py              # Unified AppException hierarchy & HTTP formatters
│   │   ├── logging.py             # Structured logging configuration
│   │   ├── models.py              # Consolidated ORM registry for Base.metadata
│   │   └── security.py            # Argon2 hashing & JWT encoding/decoding
│   ├── api/v1/
│   │   ├── health.py              # Health check with database latency diagnostic
│   │   └── router.py              # Central v1 router mounting all 12 domain routers
│   ├── modules/
│   │   ├── auth/                  # Register, Login, Refresh, Logout, /me
│   │   ├── users/                 # User entity & profile management
│   │   ├── advocates/             # Bar Council profile & verification state machine
│   │   ├── cases/                 # Case intake, dossier, and case messages
│   │   ├── triage/                # Rule-based case triage engine
│   │   ├── matching/              # PostGIS multi-factor advocate matching engine
│   │   ├── legal_knowledge/       # Curated Bare Acts & chunks storage
│   │   ├── legal_assistant/       # RAG retrieval, Gemini/Mock LLM, Citation validator
│   │   ├── documents/             # Private vault storage, SHA-256 integrity, 15-min JWT tokens
│   │   ├── appointments/          # Consultation booking & overlapping conflict prevention
│   │   ├── deadlines/             # Statutory limitation tracking & advocate confirmation
│   │   └── admin/                 # Verification queue & audit log ledger
│   └── shared/                    # Shared pagination and response schemas
├── migrations/
│   ├── env.py                     # Alembic async environment
│   └── versions/                  # 8 sequential migration scripts (0001 to 0008)
├── storage/vault/                 # Private document repository outside web root
├── tests/                         # Pytest integration test suite
└── docs/                          # API contract, schema, and development logs
```

---

## 4. Database Models & Schema Specification

The backend data model comprises **12 core entities** mapped declaratively via SQLAlchemy 2:

```mermaid
erDiagram
    users ||--o| advocate_profiles : "1:1 profile"
    users ||--o{ auth_refresh_tokens : "1:N active sessions"
    users ||--o{ legal_cases : "1:N client cases"
    users ||--o{ appointments : "1:N client bookings"
    users ||--o{ consultation_requests : "1:N requests"
    users ||--o{ documents : "1:N uploaded files"
    users ||--o{ audit_logs : "1:N actor events"

    advocate_profiles ||--o| advocate_verification_applications : "1:1 application"
    advocate_profiles ||--o{ advocate_verifications : "1:N documents"
    advocate_profiles ||--o{ legal_cases : "1:N lead counsel"
    advocate_profiles ||--o{ appointments : "1:N chamber bookings"
    advocate_profiles ||--o{ deadlines : "1:N confirmed deadlines"

    legal_cases ||--o{ case_messages : "1:N case discussions"
    legal_cases ||--o{ documents : "1:N evidence & filings"
    legal_cases ||--o{ deadlines : "1:N limitation countdowns"
    legal_cases ||--o{ appointments : "1:N hearings / consultations"

    legal_sources ||--o{ legal_chunks : "1:N statutory chunks"
```

### Model Summary Table

| Model Name | Table Name | Primary Key | Key Fields & Constraints | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **User** | `users` | `UUIDv4` | `email` (UQ), `phone` (UQ), `password_hash`, `role` (`CITIZEN`, `ADVOCATE`, `ADMIN`), `preferred_language` | Core identity & RBAC authorization |
| **RefreshToken** | `auth_refresh_tokens` | `UUIDv4` | `user_id` (FK), `token_hash` (UQ), `is_revoked`, `expires_at` | Refresh token rotation and revocation |
| **AdvocateProfile** | `advocate_profiles` | `UUIDv4` | `user_id` (FK, UQ), `bar_council_id` (UQ), `platform_verification_status`, `location` (`Geography(Point, 4326)`), `fixed_consultation_fee_inr` | Verified legal practitioner directory & PostGIS matching |
| **AdvocateVerificationApplication** | `advocate_verification_applications` | `UUIDv4` | `advocate_id` (FK, UQ), `enrollment_number`, `state_bar_council`, `platform_verification_status`, `decision_reason` | State Bar Council credential verification workflow |
| **AdvocateVerification** | `advocate_verifications` | `UUIDv4` | `advocate_id` (FK), `application_id` (FK), `verification_type` (Enum: `ENROLLMENT_CERTIFICATE`, `BAR_ID_CARD`, etc.), `file_path`, `checksum_sha256` | Uploaded advocate credential documents |
| **LegalCase** | `legal_cases` | `UUIDv4` | `case_reference` (UQ), `client_id` (FK), `lead_advocate_id` (FK), `legal_issue_category`, `urgency`, `triage_result` (JSONB) | Client case files and matter tracking |
| **CaseMessage** | `case_messages` | `UUIDv4` | `case_id` (FK), `sender_id` (FK), `message_body`, `is_internal_note` | Privileged case communications |
| **ConsultationRequest** | `consultation_requests` | `UUIDv4` | `case_id` (FK), `client_id` (FK), `advocate_id` (FK), `status` (`PENDING`, `ACCEPTED`, `DECLINED`) | Pre-appointment outreach request |
| **Appointment** | `appointments` | `UUIDv4` | `booking_reference` (UQ), `case_id` (FK), `advocate_id` (FK), `client_id` (FK), `scheduled_start`, `scheduled_end`, `status`, `timezone` | Calendar booking with conflict prevention |
| **LegalSource** | `legal_sources` | `UUIDv4` | `title`, `source_type` (`BARE_ACT`, `COURT_JUDGMENT`), `act_or_judgment_identifier`, `content_checksum` | Official, tamper-proof legal sources |
| **LegalChunk** | `legal_chunks` | `UUIDv4` | `source_id` (FK), `section_number`, `chunk_text`, `embedding` (`Vector(768)`), `content_checksum` | Granular sections with dense vector embeddings |
| **Document** | `documents` | `UUIDv4` | `case_id` (FK), `uploader_id` (FK), `file_name`, `storage_path`, `checksum_sha256`, `is_confidential` | Case files stored in private vault |
| **Deadline** | `deadlines` | `UUIDv4` | `case_id` (FK), `due_date`, `deadline_type`, `is_advocate_confirmed`, `confirmed_by_advocate_id` (FK), `reminders_json` | Statutory limitation & court deadline tracking |
| **AuditLog** | `audit_logs` | `UUIDv4` | `actor_id` (FK), `action`, `entity_type`, `entity_id`, `ip_address`, `payload_snapshot` (JSONB) | DPDP Act 2023 & BCI compliance trail |

---

## 5. API Endpoint Inventory

The FastAPI backend exposes 45 versioned endpoints under `/api/v1/`:

| Module | Method | Path | Auth / Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Health** | `GET` | `/api/v1/health` | Public | System & database health probe |
| **Auth** | `POST` | `/api/v1/auth/register` | Public | Citizen registration |
| **Auth** | `POST` | `/api/v1/auth/register/advocate` | Public | Advocate registration |
| **Auth** | `POST` | `/api/v1/auth/login` | Public | Email/password login with JWT generation |
| **Auth** | `POST` | `/api/v1/auth/refresh` | Public | Refresh token rotation |
| **Auth** | `POST` | `/api/v1/auth/logout` | Authenticated | Token revocation |
| **Auth** | `GET` | `/api/v1/auth/me` | Authenticated | Current user profile |
| **Advocates** | `POST` | `/api/v1/advocates/apply` | Advocate | Submit bar credential application |
| **Advocates** | `GET` | `/api/v1/advocates/me` | Advocate | Advocate's own profile |
| **Advocates** | `POST` | `/api/v1/advocates/me/verification` | Advocate | Submit verification details |
| **Advocates** | `GET` | `/api/v1/advocates/me/verification` | Advocate | Application status & requirements |
| **Advocates** | `POST` | `/api/v1/advocates/me/verification/documents` | Advocate | Upload certificate / Bar ID |
| **Advocates** | `GET` | `/api/v1/advocates/me/verification/documents/{id}/download` | Advocate | Download uploaded certificate |
| **Admin** | `GET` | `/api/v1/admin/advocates/pending` | Admin | Pending advocate applications |
| **Admin** | `GET` | `/api/v1/admin/advocates/{id}` | Admin | Advocate application dossier |
| **Admin** | `PATCH` | `/api/v1/admin/advocates/{id}/verification` | Admin | Legacy status update |
| **Admin** | `GET` | `/api/v1/admin/advocate-verifications` | Admin | Filterable verification queue |
| **Admin** | `GET` | `/api/v1/admin/advocate-verifications/{id}` | Admin | Detailed verification application |
| **Admin** | `POST` | `/api/v1/admin/advocate-verifications/{id}/decision` | Admin | Approve / Reject verification |
| **Admin** | `POST` | `/api/v1/admin/advocate-verifications/{id}/request-info` | Admin | Request additional certificates (AIBE/COP) |
| **Admin** | `GET` | `/api/v1/admin/advocate-verifications/documents/{id}/download` | Admin | Admin document inspection |
| **Cases** | `POST` | `/api/v1/cases` | Authenticated | Submit case intake matter |
| **Cases** | `GET` | `/api/v1/cases` | Authenticated | List user cases / advocate matters |
| **Cases** | `GET` | `/api/v1/cases/{case_id}` | Authenticated | Get case file |
| **Cases** | `PATCH` | `/api/v1/cases/{case_id}` | Authenticated | Update case matter |
| **Cases** | `POST` | `/api/v1/cases/{case_id}/triage` | Authenticated | Run triage on existing case |
| **Triage** | `POST` | `/api/v1/triage/assess` | Public / Auth | Deterministic preliminary triage assessment |
| **Matching** | `GET` | `/api/v1/matching/cases/{case_id}/advocates` | Case Owner / Admin | Match verified advocates to case |
| **Matching** | `POST` | `/api/v1/matching/consultation-requests` | Citizen | Create consultation outreach |
| **Matching** | `GET` | `/api/v1/matching/consultation-requests` | Authenticated | List consultation requests |
| **Matching** | `GET` | `/api/v1/matching/advocates` | Public / Auth | Search verified advocates with PostGIS filter |
| **Legal AI** | `POST` | `/api/v1/legal/ask` | Public / Auth | RAG legal question answering with citations |
| **Legal AI** | `POST` | `/api/v1/legal/admin/sources` | Admin | Register legal source |
| **Legal AI** | `POST` | `/api/v1/legal/admin/sources/{id}/chunks` | Admin | Ingest and embed legal chunk |
| **Legal AI** | `POST` | `/api/v1/legal/admin/seed` | Admin | Seed curated Bare Acts dataset |
| **Legal AI** | `GET` | `/api/v1/legal/admin/sources` | Admin | List legal sources & chunk counts |
| **Documents** | `POST` | `/api/v1/documents/cases/{case_id}/upload` | Case Owner / Admin | Upload document to private vault |
| **Documents** | `GET` | `/api/v1/documents/cases/{case_id}` | Case Owner / Admin | List documents in case vault |
| **Documents** | `GET` | `/api/v1/documents/{document_id}` | Case Owner / Admin | Document metadata & checksum |
| **Documents** | `GET` | `/api/v1/documents/{document_id}/access-token` | Case Owner / Admin | Issue 15-minute signed download JWT |
| **Documents** | `GET` | `/api/v1/documents/{document_id}/download` | Token / Auth | Secure binary download streaming |
| **Appointments** | `POST` | `/api/v1/appointments` | Citizen / Admin | Book consultation with conflict check |
| **Appointments** | `GET` | `/api/v1/appointments` | Authenticated | List appointments (role-scoped) |
| **Appointments** | `GET` | `/api/v1/appointments/{id}` | Authenticated | Get appointment details |
| **Appointments** | `PATCH` | `/api/v1/appointments/{id}/status` | Advocate / Admin | Confirm or reject consultation |
| **Deadlines** | `POST` | `/api/v1/deadlines` | Case Owner / Admin | Register statutory deadline |
| **Deadlines** | `GET` | `/api/v1/deadlines` | Authenticated | List user deadlines |
| **Deadlines** | `GET` | `/api/v1/deadlines/cases/{case_id}` | Case Owner / Admin | List deadlines for a case |
| **Deadlines** | `GET` | `/api/v1/deadlines/{id}` | Case Owner / Admin | Get deadline record |
| **Deadlines** | `PATCH` | `/api/v1/deadlines/{id}/confirm` | Advocate / Admin | Advocate limitation review & confirmation |
| **Deadlines** | `PATCH` | `/api/v1/deadlines/{id}/complete` | Case Owner / Admin | Mark deadline completed |

---

## 6. Authentication and Role Permissions

NyayaSetu implements a three-tier role hierarchy:
1. `CITIZEN`: Can file cases, run preliminary triage, view matched verified advocates, upload case evidence to their private vault, request consultations, and track deadlines.
2. `ADVOCATE`: Can apply for platform verification, upload bar credentials, view assigned cases, accept/reject consultations, review and confirm statutory limitation periods, and access client documents shared under consent.
3. `ADMIN`: System supervisor. Can inspect the advocate verification queue, approve/reject credentials with audit reasons, request supplemental evidence (AIBE/COP), inspect compliance audit logs, and seed statutory Bare Acts.

### Security Guarantees
- Passwords hashed with `Argon2id` (memory cost 65536 KiB, time cost 3 iterations).
- Access tokens expire in 30 minutes; refresh tokens expire in 7 days and are rotated on every use.
- The `ADMIN` role cannot be self-assigned during registration; any attempt returns `403 Forbidden`.
- Documents in `backend/storage/vault/` cannot be accessed via static public URLs; downloads require either an active bearer token or a 15-minute temporary JWT download token.

---

## 7. Existing Working Functionality Assessment

| Subsystem | Backend Implementation | Frontend Implementation | Integration Status |
| :--- | :--- | :--- | :--- |
| **User Authentication** | Fully functional (Argon2id + JWT + refresh rotation) | Simulated (Phone OTP with hardcoded `123456`, localStorage) | **Disconnected** |
| **Advocate Verification** | Fully functional (4-stage admin review workflow + docs) | Hardcoded static advocate list (`lawyers.ts`, `dashboard-mock-data.ts`) | **Disconnected** |
| **Case Intake & Triage** | Fully functional (`/api/v1/cases`, `/api/v1/triage/assess`) | Client-side questionnaire & local rule evaluator | **Disconnected** |
| **Advocate Matching** | Fully functional (5-factor engine + PostGIS coordinates) | Client-side sorting over 4 static mock advocates | **Disconnected** |
| **Legal AI Assistant** | Fully functional (RAG + Bare Acts + Citation Validator) | Client-side simulation with static canned responses | **Disconnected** |
| **Document Vault** | Fully functional (Private vault + SHA-256 + 15m JWT) | Client-side file table with mock links | **Disconnected** |
| **Consultation Booking** | Fully functional (Conflict detection + lifecycle) | Client-side slot selector & mock checkout | **Disconnected** |
| **Limitation Deadlines** | Fully functional (Advocate confirmation + audit logs) | Client-side list & calendar view | **Disconnected** |
| **Audit Logs** | Fully functional (`audit_logs` table) | Displayed on profile page from local mock array | **Disconnected** |
| **3D Lady Justice Hero** | N/A (Frontend Only) | Fully functional (Three.js canvas + GLB loader) | **Working on Frontend** |
| **Legal Notice Generator** | N/A (Frontend Only) | Fully functional (In-browser HTML print preview) | **Working on Frontend** |


---

## Backend Architecture (Module Notes)

# Architecture Documentation — NyayaSetu Backend

## 1. Architectural Style
NyayaSetu uses a **Modular Monolith** architecture.

A modular monolith strikes the optimal balance between high velocity development and rigorous architectural boundary separation. All code resides within a single deployable unit while strictly segregating domain logic into cohesive, loosely coupled domain modules.

```
backend/
├── app/
│   ├── main.py                  # Application entry point, ASGI lifecycle & middleware
│   ├── core/                    # Cross-cutting foundational infrastructure
│   │   ├── config.py            # Centralized Pydantic Settings
│   │   ├── database.py          # SQLAlchemy 2 async engine & session management
│   │   ├── errors.py            # Centralized exception hierarchy & handlers
│   │   └── logging.py           # Structured JSON logging
│   ├── api/
│   │   └── v1/
│   │       ├── health.py        # System health & diagnostic endpoint
│   │       └── router.py        # Central versioned router assembling all modules
│   ├── modules/                 # Modular Domain Packages
│   │   ├── auth/                # Identity, OTP verification & JWT sessions
│   │   ├── users/               # Citizens, litigants & advocate profiles
│   │   ├── advocates/           # Chamber roster, bar enrolment & admissions
│   │   ├── cases/               # Legal dossiers, conflict clearance & status
│   │   ├── triage/              # Case intake categorization & jurisdiction parsing
│   │   ├── matching/            # Advocate-to-litigant matching algorithm
│   │   ├── legal_knowledge/     # Statutes, precedents, articles & FAQ repositories
│   │   ├── legal_assistant/     # AI clause redlining & preliminary legal assessment
│   │   ├── documents/           # Secure document uploads, OCR & vault
│   │   ├── appointments/        # Fixed-fee consultations & calendar slots
│   │   ├── deadlines/           # Statutory limitation tracking & court calendars
│   │   └── admin/               # Internal operations, conflict review & audits
│   ├── integrations/            # Third-party SDKs (Gemini, Razorpay, SMS OTP)
│   └── shared/                  # Common schemas, pagination models & base types
├── migrations/                  # Alembic database migrations
├── scripts/                     # Operational & dev shell scripts
├── tests/                       # Automated pytest test suites
└── docs/                        # Architectural specifications & contracts
```

## 2. Core Architectural Principles
1. **Module Autonomy:** Each domain module inside `app/modules/` maintains its own router, schemas, models, and service layer. Cross-module calls should happen via explicit service interfaces rather than raw database joins across boundaries.
2. **Asynchronous I/O First:** Native async/await throughout FastAPI endpoints and SQLAlchemy 2 using `asyncpg`.
3. **Strict Schema Contracts:** Pydantic v2 validates all inbound network payloads and shapes every outbound JSON response.
4. **Resilient Observability:** Centralized JSON logging structured with request paths, error codes, and execution context.
5. **BCI & DPDP Compliance:** Architected to adhere strictly to Bar Council of India (BCI) Rule 36 non-solicitation rules and the Digital Personal Data Protection Act 2023 (DPDP).

## 3. Advocate Credential Verification Subsystem

### Provider-Independent Verification Architecture
The system does **NOT** assume the existence of a centralized nationwide Bar Council API, nor does it scrape State Bar Council websites. Instead, it adopts a multi-tier provider abstraction:

```
[ Advocate Application ]
          │
          ▼
[ Verification Engine Interface ]
   ├─ AutomaticFormatValidator: State-specific regex format check & normalization
   ├─ ManualAdminVerifier: Admin cross-references official rolls/archives
   └─ (Future) OfficialAPIVerifier: Pluggable when official council APIs launch
          │
          ▼
[ Admin Review & Decision Workflow ]
   ├─ Status Lifecycle: PENDING -> SUBMITTED -> UNDER_REVIEW -> NEEDS_MORE_INFO -> VERIFIED / REJECTED
   ├─ Evidence Levels: DOCUMENTS_REVIEWED | OFFICIAL_ROLL_MATCHED | COUNCIL_CONFIRMED
   └─ Immutable Audit Log: actor_id, timestamp, official source consulted, decision reason
```

### Document Storage & Access Security
1. **Private Storage:** Uploaded enrollment certificates, Bar IDs, AIBE, and COP certificates are stored under private paths (`backend/uploads/advocate_documents/<advocate_id>/<type>/<uuid>.<ext>`).
2. **Zero Public URLs:** No static document endpoints or public URLs exist. Documents are never included in public advocate profiles.
3. **Strict Ownership & RBAC:**
   - Admins can inspect documents during review.
   - Advocates can download only their own documents.
   - Citizens and unauthorized advocates are strictly blocked (HTTP 403 Forbidden).

### Matching Engine Eligibility
- Only advocates whose `platform_verification_status == "VERIFIED"` and whose account is active (`is_active == True`) are returned in advocate search and matching queries (`/api/v1/matching/advocates`).
- Phone OTP verification (`is_verified` at user account level) is never confused with professional credential verification (`platform_verification_status` at advocate profile level).



---

## ADR 0001 - Backend Stack (Historical/Superseded Record)

# ADR 0001 — Backend stack: Fastify + Drizzle + SQLite (Superseded)

> [!NOTE]
> **Status:** Superseded by Python 3.12 + FastAPI 0.115 + SQLAlchemy 2.0 + PostgreSQL 16. This document is preserved for historical decision context only. See [`../ARCHITECTURE.md`](../ARCHITECTURE.md) for the active production architecture.

- **Status:** Superseded
- **Date:** 2026-11-17 (Superseded 2026-11-20)
- **Deciders:** NyayaSetu engineering
- **Superseded By:** Python FastAPI Modular Monolith

## Context

NyayaSetu needs an API for public content, legal intake, and newsletter
subscriptions. The frontend is a Next.js 16 application with static data. The
team is small, the immediate environment has no Docker or PostgreSQL, and the
first goal is a working, well-typed backend that a new contributor can run in
minutes.

Requirements:

- Strong TypeScript support and runtime validation.
- Fast local startup with no external services.
- Typed database access and migrations.
- OpenAPI documentation for frontend integration.
- Basic production security middleware.
- A clear path to PostgreSQL later.
- Low operational overhead while the product is being validated.

## Decision

Use:

| Concern | Choice |
| --- | --- |
| Runtime | Node.js 22+ |
| Framework | Fastify 5 |
| Language | TypeScript, NodeNext ESM |
| Validation / serialization | Zod 4 + `fastify-type-provider-zod` |
| ORM | Drizzle ORM |
| Local database | SQLite via `better-sqlite3` |
| Logging | Pino (+ `pino-pretty` in development) |
| API docs | `@fastify/swagger` + `@fastify/swagger-ui` |
| Security | `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit` |
| Tests | Vitest + Fastify `inject()` + in-memory SQLite |
| Lint / build | ESLint 9 + `typescript-eslint`, `tsc` |

The backend is a modular monolith organized by feature:

```text
src/modules/<feature>/
├── <feature>.routes.ts
├── <feature>.service.ts
└── <feature>.schema.ts
```

Routes are thin; services own queries and business rules; Drizzle owns
persistence. The database client is injected into Fastify and accessed through
`request.server.db`.

## Why these choices

### Fastify 5

- Mature plugin model and schema-first routing.
- Excellent performance for a small JSON API.
- `inject()` makes integration tests fast and port-free.
- First-class support for the Zod type provider.
- Less framework surface area than NestJS for a small team.

### Zod 4 + type provider

- One schema validates requests and drives OpenAPI.
- Runtime validation is mandatory at the public boundary.
- Transforms handle normalization such as legacy urgency aliases and pagination
  coercion.
- No separate DTO layer is needed at this scale.

### Drizzle ORM

- SQL-like, typed queries without a heavy runtime.
- Explicit schema in TypeScript and generated SQL migrations.
- Easy to inspect and review.
- Supports SQLite now and PostgreSQL with a driver/schema conversion.

### SQLite for local and early environments

- Zero external services; the repo runs with `npm install` and `npm run setup`.
- Synchronous driver keeps the code simple.
- In-memory databases make tests deterministic.
- WAL mode, foreign keys, and a busy timeout are sufficient for low-write local
  use.

### Vitest

- Fast, TypeScript-native, works well with ESM.
- `app.inject()` gives route-level integration coverage without network flakiness.

## Consequences

### Positive

- A new developer can run the API without Docker.
- Strong typing end-to-end, from Zod request to Drizzle row.
- Swagger stays close to the implementation.
- Tests run in seconds and do not require a database server.
- The module pattern is easy to extend.

### Negative / risks

- `better-sqlite3` is a native module; installation needs a prebuilt binary or a
  C++ toolchain.
- SQLite allows a single writer and is unsuitable for serverless or multi-instance
  deployments without a shared database.
- Synchronous queries block the event loop; heavy writes or long reports would
  degrade latency.
- JSON columns are stored as text; filtering with `LIKE` is pragmatic, not
  scalable.
- There are no enforced foreign keys between content tables.
- Fastify's lower abstraction means the team owns more conventions than with
  NestJS.
- Zod response serialization is currently only applied where response schemas
  exist; adding them is a follow-up.

### Mitigations

- Document PostgreSQL migration steps in [`../DATABASE.md`](../DATABASE.md).
- Keep `DATABASE_URL` as the only database switch.
- Set `NODE_ENV=production`, disable Swagger, and restrict CORS in production.
- Add response schemas and normalize relationships before scale.
- Add CI and dependency scanning.
- Do not log request bodies containing intake PII.

## Alternatives considered

| Alternative | Why not now |
| --- | --- |
| PostgreSQL from day one | No local PostgreSQL/Docker in the initial environment; adds setup friction before product validation |
| Prisma | Strong tooling, but a heavier runtime and less SQL-like control; Drizzle fits the small, explicit schema better |
| NestJS | More structure than needed for a small modular monolith; higher learning and boilerplate cost |
| Express | Fewer built-in schemas, validation, and OpenAPI integration; more glue code |
| Python (FastAPI) | Viable, but the team and frontend are TypeScript-first; one language reduces context switching |
| tRPC | Excellent for a tightly coupled TS monorepo, but this repo has independent apps and a public API that benefits from OpenAPI and plain HTTP |
| Serverless functions + hosted DB | Premature; increases vendor coupling and cold-start/complexity before the product is validated |

## Follow-up decisions

1. When and how to migrate to PostgreSQL (trigger: multi-instance deploy, write
   contention, or reporting needs).
2. Authentication and admin authorization model.
3. Notification provider and outbox design.
4. AI assessment provider, safety policy, and data retention.
5. Whether to move to a package workspace once shared types are needed.

## References

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- [`../DATABASE.md`](../DATABASE.md)
- [`../API.md`](../API.md)
- [`../ROADMAP.md`](../ROADMAP.md)
