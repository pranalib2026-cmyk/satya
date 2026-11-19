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

