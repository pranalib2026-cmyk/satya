# NyayaSetu (न्यायसेतु) — Backend Service

Modular Monolith backend for **NyayaSetu — AI-Powered Legal Advisor and Advocate Matching Platform for India**.

## Technology Stack
- **Runtime:** Python 3.12
- **Framework:** FastAPI
- **Data Validation:** Pydantic v2
- **ORM:** SQLAlchemy 2.0 (Asyncio)
- **Database:** PostgreSQL 16
- **Migrations:** Alembic
- **Testing:** Pytest + HTTPX

## Directory Structure
```
backend/
├── app/
│   ├── main.py              # Application lifecycle & factory
│   ├── core/                # Settings, DB engine, errors, logging
│   ├── api/v1/              # Versioned API routes & health check
│   ├── modules/             # 12 Modular Monolith domain packages
│   ├── integrations/        # External services (AI, payments, SMS)
│   └── shared/              # Reusable schemas & response wrappers
├── migrations/              # Database migration versions
├── scripts/                 # Operational bash scripts
├── tests/                   # Pytest automated test suites
├── docs/                    # Architecture, API contract, and DB specifications
├── requirements.txt         # Pinned production dependencies
├── .env.example             # Template environment variables
├── .gitignore               # Ignored local files, keys, and environments
└── README.md
```

## Quick Start Guide

### 1. Virtual Environment Setup
Ensure Python 3.12 is used:
```bash
python3.12 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
python run.py
# or
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Verify Health & OpenAPI Docs
- **Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
- **Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 5. Run Automated Tests
```bash
pytest -v
```
