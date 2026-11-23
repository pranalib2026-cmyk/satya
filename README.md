# NyayaSetu (न्यायसेतु)

**Legal Help Should Be Clear. Justice Should Be Accessible.**

NyayaSetu is an India-focused legal technology platform bridging citizens and verified advocates, established in 2026. The platform combines an editorial-grade client application with a resilient Python FastAPI modular monolith, providing deterministic legal triage, geospatial advocate matching under Bar Council of India (BCI) Rule 36, secure evidence vaults, statutory limitation tracking, and grounded retrieval-augmented generation (RAG) over verified Indian Bare Acts.

> [!IMPORTANT]
> **Mandatory Statutory Disclosure:** NyayaSetu provides an AI-assisted preliminary legal assessment and advocate-discovery platform. It is **not** a law firm and does not provide legal advice under the Advocates Act, 1961. Submitting an intake request does **not** create an advocate-client relationship. Advocates listed on the platform do not solicit work or advertise fee schedules, in compliance with Rule 36, Chapter II, Part VI of the Bar Council of India Rules.

---

## 1. System Architecture & Repository Map

This repository is structured as a two-tier monorepo with independent frontend and backend workspaces. There is **no root `package.json`**. Commands must be run from `frontend/` or `backend/`.

```text
NyayaSetu/
├── frontend/                   Next.js 16 (React 19) Editorial Client Application (:3000)
│   ├── src/app/                App Router routes, layouts, and workspaces
│   ├── src/components/         Editorial UI primitives, layout, and 3D Lady Justice Canvas
│   ├── src/services/dashboard/ Strongly typed API integration clients
│   ├── src/lib/                AuthContext, unified API client, design tokens
│   ├── src/types/              TypeScript domain definitions
│   └── scripts/predev.js       Port 3000 lifecycle hygiene
├── backend/                    Python 3.12 FastAPI Modular Monolith API (:8000)
│   ├── app/                    FastAPI factory, core config, 12 domain packages
│   ├── migrations/             Alembic database migration revisions & env.py
│   ├── scripts/                Operational scripts (run_dev.sh, verify_health.py)
│   ├── tests/                  Pytest async integration test suites
│   ├── docs/                   API Contract and Database Schema specifications
│   ├── requirements.txt        Pinned Python production dependencies
│   ├── alembic.ini             Alembic configuration
│   └── run.py                  Uvicorn development server launcher
├── docs/                       Architecture, API contract, database schema, roadmaps
└── .gitignore                  Git tracking rules
```

| Application | Technology Stack | Local URL | Primary Responsibility |
|---|---|---|---|
| **`frontend/`** | Next.js 16.4.5, React 19.3, TypeScript 5, Tailwind CSS 4, Three.js | <http://localhost:3000> | Citizen matter intake, dashboard dockets, evidence vault UI, advocate discovery |
| **`backend/`** | Python 3.12, FastAPI 0.115, SQLAlchemy 2.0, PostgreSQL 16, PostGIS, pgvector | <http://localhost:8000> | Authentication, case management, deterministic triage, geospatial matching, RAG |

---

## 2. Prerequisites

Ensure the following runtimes and database engines are installed before setting up the project:

1. **Node.js:** `v22.0.0` or newer (tested on Node v24).
2. **npm:** `v10.0.0` or newer.
3. **Python:** `3.12` or newer (Python 3.12 recommended).
4. **PostgreSQL:** Version 16 or newer with extensions:
   * `postgis` (for geospatial coordinate calculations)
   * `vector` (for pgvector semantic embeddings)
   * *(Optional: A free [Supabase](https://supabase.com) project includes both PostGIS and pgvector out of the box).*

---

## 3. Quick Start Guide

### Step 1: Set Up & Launch the Backend (`backend/`)

Open a terminal and navigate to `backend/`:

```bash
cd backend

# 1. Create and activate a Python 3.12 virtual environment
python3.12 -m venv ../venv
source ../venv/bin/activate
# Windows PowerShell: ..\venv\Scripts\Activate.ps1

# 2. Install pinned dependencies
pip install -r requirements.txt

# 3. Configure environment variables
cp .env.example .env
# Edit .env to supply your PostgreSQL DATABASE_URL if not using localhost default

# 4. Run database migrations
alembic upgrade head

# 5. Launch development server (Port 8000)
python run.py
# Or directly via Uvicorn:
# uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Backend Verification Endpoints
* **API Health Check:** <http://localhost:8000/api/v1/health>
* **Interactive OpenAPI Swagger Docs:** <http://localhost:8000/docs>
* **Alternative ReDoc UI:** <http://localhost:8000/redoc>
* **OpenAPI JSON Contract:** <http://localhost:8000/api/v1/openapi.json>

---

### Step 2: Set Up & Launch the Frontend (`frontend/`)

Open a second terminal and navigate to `frontend/`:

```bash
cd frontend

# 1. Install Node dependencies
npm install

# 2. Launch Next.js development server (Port 3000)
npm run dev
```

* Next.js automatically proxies API calls: all requests made to `http://localhost:3000/api/v1/:path*` are rewritten to `http://localhost:8000/api/v1/:path*` via `next.config.ts`.
* Visit the application in your browser at: <http://localhost:3000>

---

## 4. Database Setup & Migrations

### PostgreSQL Extensions
NyayaSetu requires `uuid-ossp`, `postgis`, and `vector`. Migration `0001_enable_postgresql_extensions.py` automatically enables them on your database:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";
```

### Alembic Migration Commands
Run all migration commands from inside `backend/`:

```bash
cd backend
source ../venv/bin/activate

# Apply all pending forward migrations
alembic upgrade head

# Roll back the most recent migration
alembic downgrade -1

# Generate a new migration after editing SQLAlchemy models in app/modules/
alembic revision --autogenerate -m "describe_your_change"

# Check migration history
alembic history --verbose
```

---

## 5. Testing & Code Quality

Before committing changes, execute the verification checks for both applications:

### Backend Tests
```bash
cd backend
source ../venv/bin/activate

# Run full integration test suite (79 async tests)
pytest -v

# Run live health check verification script
python scripts/verify_health.py
```
*(Backend tests use an in-memory SQLite database via `aiosqlite`, requiring no external PostgreSQL service).*

### Frontend Quality Checks
```bash
cd frontend

# Run ESLint check
npm run lint

# Run production Webpack build verification
npm run build:webpack

# Run functional service tests
node scripts/test-services.mjs
```

---

## 6. Troubleshooting Common Issues

### 1. Port 3000 or Port 8000 Already in Use
* **Port 3000:** The frontend script `npm run dev` automatically clears stale Next.js lockfiles and frees port 3000 via `scripts/predev.js`.
* **Port 8000:** If Uvicorn fails with `Address already in use`, identify and terminate the process:
  ```bash
  lsof -ti:8000 | xargs kill -9
  ```

### 2. Missing `postgis` or `pgvector` Extension in PostgreSQL
* If `alembic upgrade head` fails on `0001_extensions` with `type "geography" does not exist` or `type "vector" does not exist`:
  * Ensure PostGIS and pgvector packages are installed on your PostgreSQL server (e.g., `brew install postgis pgvector` on macOS, or `apt-get install postgresql-16-postgis-3 postgresql-16-pgvector` on Ubuntu).
  * Alternatively, connect to a free [Supabase](https://supabase.com) PostgreSQL instance where both extensions are pre-installed.

### 3. Frontend Cannot Connect to Backend
* Ensure the backend is running on `http://localhost:8000`.
* Check `frontend/next.config.ts`: the rewrite rule proxies `/api/v1/:path*` to `http://localhost:8000/api/v1/:path*`.
* Verify that your browser can open <http://localhost:8000/api/v1/health>.

---

## 7. Documentation Directory

* **System Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
* **API Specification & Endpoints:** [`docs/API.md`](docs/API.md)
* **Database Models & Alembic Schema:** [`docs/DATABASE.md`](docs/DATABASE.md)
* **Developer Guidelines & Code Rules:** [`AGENTS.md`](AGENTS.md)
* **Development & Operations:** [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)
* **Delivery History/Audits:** [`docs/DELIVERY_RECORD.md`](docs/DELIVERY_RECORD.md)
