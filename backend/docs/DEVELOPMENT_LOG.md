# Development Log — NyayaSetu Backend

## [Stage 9: Document Management, Appointments, and Statutory Deadlines] - 2026-11-17

### 1. Goals Completed
* **A. Document Management (Private Vault & Evidence Security):**
  * Built `DocumentService` and registered `/api/v1/documents`.
  * **Private Vault Storage:** Uploaded case files are written to a secured directory tree at `backend/storage/vault/{case_id}/{document_id}_{filename}`, strictly outside any public frontend or static directory.
  * **Integrity & Validation:** Calculated SHA-256 cryptographic hashes on the byte stream during upload; validated extensions against allowed list (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.doc`, `.docx`) and MIME types; enforced a 25MB maximum file size limit.
  * **Case Ownership & Access Control:** Citizens and advocates can only view, upload, or download documents for cases they own or are assigned to (unauthorized access returns `403 Forbidden`).
  * **Short-Lived Download Tokens:** Implemented `GET /api/v1/documents/{document_id}/access-token` generating 15-minute (900s) signed JWT tokens. Streaming via `GET /api/v1/documents/{document_id}/download?token=...` serves files securely with `Content-Disposition: attachment`. Public unauthenticated access is strictly rejected (`401 Unauthorized`).
* **B. Appointments & Consultations:**
  * Built `AppointmentService` and registered `/api/v1/appointments`.
  * **Citizen Consultation Booking:** Citizens can request consultation slots with verified advocates. Each appointment is assigned a human-readable booking reference (e.g. `NYA-BK-2026-XXXX`).
  * **Conflict Prevention:** Before booking, the service queries existing appointments for the advocate in `REQUESTED`, `CONFIRMED`, or `SCHEDULED` status. If an overlap is detected (`scheduled_start < existing.end AND scheduled_end > existing.start`), the system rejects the booking with `409 Conflict`.
  * **Consultation Lifecycle:** Advocates can accept requests (`CONFIRMED` with meeting room URL) or reject with a mandatory explanation (`REJECTED` with `rejection_reason`).
  * **Role-Based Listing & Inspection:** Citizens view their own bookings; advocates view their chamber schedule; administrators have comprehensive visibility across all appointments.
* **C. Statutory Deadlines & Limitation Period Management:**
  * Built `DeadlineService` and registered `/api/v1/deadlines`.
  * **Case Limitation Tracking:** Citizens, advocates, or admins can create statutory limitation periods, court hearing dates, notice expiries, or filing compliance deadlines tied to a legal case.
  * **No Unverified LLM Calculations:** In strict compliance with guidelines, statutory limitation deadlines are NOT automatically computed by an LLM. Deadlines are created manually or based on verified legal provisions (e.g., Section 138(c) Negotiable Instruments Act 1881, Order VIII Rule 1 CPC).
  * **Advocate Statutory Review & Confirmation:** Created `PATCH /api/v1/deadlines/{id}/confirm` allowing only verified legal advocates or admins to review, validate, and confirm statutory limitation periods (`is_advocate_confirmed: true`). Citizens attempting to self-confirm receive `403 Forbidden`.
  * **Automated Alert Schedules & Completion Tracking:** Configurable reminder intervals (`reminder_days_before: [7, 3, 1]`) recorded in `reminders_json`; users can mark deadlines as completed (`PATCH /api/v1/deadlines/{id}/complete`).
  * **Auditing:** Every creation, confirmation, and completion event is written to `AuditLog`.
* **Alembic Migration:**
  * Created `backend/migrations/versions/0008_documents_appointments_deadlines.py` updating `appointments` (timezone, client_notes, rejection_reason) and `deadlines` (deadline_type, source_basis, is_advocate_confirmed, confirmed_by_advocate_id, confirmed_at, reminders_json).
* **Testing & Verification:**
  * Added `backend/tests/test_documents_appointments_deadlines.py` containing 10 comprehensive tests.
  * Total test suite: **79/79 tests passing in 5.57s**.

---

## [Stage 8: Legal AI Assistant using Retrieval-Augmented Generation (RAG)] - 2026-11-17

### 1. Goals Completed
* **Curated Statutory Knowledge Base (No Scraping / No Fabricated Data):**
  * Seeded authentic, official Indian Bare Acts:
    - *The Negotiable Instruments Act, 1881* (Sections 138, 139, 141)
    - *The Consumer Protection Act, 2019* (Sections 2(7), 35, 47)
    - *The Legal Services Authorities Act, 1987* (Sections 12, 19)
    - *The Real Estate (Regulation and Development) Act, 2016* (Section 18)
    - *The Bharatiya Nagarik Suraksha Sanhita, 2023* (Sections 173, 479)
  * Stored source metadata: `title`, `source_type`, `official_source_url`, `jurisdiction`, `court`, `act_or_judgment_identifier`, `publication_date`, `last_verified_date`, `document_version`, and SHA-256 `content_checksum`.
* **Pluggable Provider Architecture:**
  * Created `BaseEmbeddingProvider` abstraction with `GeminiEmbeddingProvider` and fast offline `DeterministicMockEmbeddingProvider` (768-D unit normalized vectors).
  * Created `BaseLLMProvider` abstraction with `GeminiLLMProvider` and strictly grounded `DeterministicGroundedLLMProvider`.
* **Hybrid Vector & Keyword Retrieval (`LegalRetrievalEngine`):**
  * Dense vector cosine similarity combined with statutory section and keyword matching.
  * Metadata filtering by jurisdiction (`Union of India`, states, tribunals) and minimum relevance threshold ($\ge 0.45$).
  * Multilingual keyword transliteration support mapping Hindi (`चेक बाउंस`) and Kannada (`ಗ್ರಾಹಕರ ರಕ್ಷಣಾ`) to statutory concepts.
* **Strict Safety & Post-Generation Citation Validation (`CitationValidator`):**
  * Strictly verifies every cited section, Act, or judgment against actual retrieved source chunks.
  * Prunes or flags any attempted hallucinations (`unverified_citations_detected`).
  * If retrieved sources are insufficient, explicitly returns that no supporting verified Indian legal sources were found without speculating.
  * Embeds statutory disclaimer: informational guidance only, not guaranteed legal advice.
  * Recommends empanelled advocate consultation when individualized advice is required.
  * User case documents are strictly isolated from public legal knowledge base tables.
* **Endpoints Implemented:**
  * `POST /api/v1/legal/ask`: Grounded legal question answering with verified citations and actionable next steps.
  * `POST /api/v1/legal/admin/sources`: Admin source registration.
  * `POST /api/v1/legal/admin/sources/{id}/chunks`: Admin chunk ingestion with embedding and SHA-256 hashing.
  * `POST /api/v1/legal/admin/seed`: Admin endpoint to seed curated Indian Bare Acts.
  * `GET /api/v1/legal/admin/sources`: Lists curated sources and chunk counts.
  * `GET /api/v1/legal/status`: Diagnostic health check.
* **Alembic Migration:**
  * Created `0007_legal_sources_metadata.py` adding `court`, `act_or_judgment_identifier`, `publication_date`, `last_verified_date`, `document_version`, `content_checksum` to `legal_sources` and `content_checksum`, `metadata_json` to `legal_chunks`.
* **Testing & Verification:**
  * Implemented `tests/test_legal_ai_assistant.py` with 9 comprehensive tests covering retrieval, citation validation, hallucination pruning, missing sources safe fallback, multi-language detection, admin access control (`403` for citizens, `401` for unauth), and audit logging.
  * Total test suite: **69/69 tests passing in 4.38s**.

---

## [Stage 7: Advocate Matching Engine & Private Consultation Requests] - 2026-11-17

### 1. Goals Completed
* **Multi-Factor Objective Matching Engine (`AdvocateMatchingEngine`):**
  * Built an objective matching system evaluating platform-verified advocates against case requirements.
  * **Hard Filters:**
    1. *Verification Status:* Candidate must be strictly `VERIFIED` (`platform_verification_status == "VERIFIED"`). Pending, under review, and rejected advocates are unconditionally excluded.
    2. *Practice Area Relevance:* Practice area must align with the case domain category.
    3. *Court Jurisdiction Compatibility:* Advocate's state, district, or admitted courts must match the case forum.
    4. *Budget Filter:* Optional `max_budget_inr` filters out fees exceeding client's budget.
    5. *Distance Filter:* Optional `max_distance_km` filters candidates beyond the geodesic threshold.
  * **Configurable Scoring Factors (Sum to 100%):**
    - Practice Area Relevance: **35%** (`MATCHING_WEIGHT_PRACTICE = 0.35`)
    - Court Jurisdiction Compatibility: **25%** (`MATCHING_WEIGHT_JURISDICTION = 0.25`)
    - Language Compatibility: **20%** (`MATCHING_WEIGHT_LANGUAGE = 0.20`)
    - Geographic Proximity: **10%** (`MATCHING_WEIGHT_PROXIMITY = 0.10`)
    - Availability: **10%** (`MATCHING_WEIGHT_AVAILABILITY = 0.10`)
* **Strict BCI Rule 36 Compliance (No Advertising / No Paid Placement):**
  * Zero paid promotion or sponsored placement.
  * Zero subjective popularity rankings, public star ratings, or fabricated reviews.
  * No claims such as "India's best lawyer" or guaranteed outcome representations.
  * Preferred consultation budget acts solely as a ceiling filter and **never influences or boosts matching rank**.
  * Dynamic, objective `match_explanation` synthesized for every matched advocate detailing their verified standing, Bar Council enrollment, practice alignment, court forums, languages, and distance.
* **Geodesic & PostGIS Proximity:**
  * Implemented distance calculation via Haversine / PostGIS WGS84 coordinates.
  * Standard reference coordinate mappings for all major Indian state capitals and judicial centers.
* **Private Consultation Request Workflow:**
  * Created endpoint `POST /api/v1/matching/consultation-requests` to book private 1-on-1 consultations with verified advocates.
  * Generates unique reference code `NYA-2026-CR-XXXX` and records an immutable cryptographic audit in `AuditLog`.
  * Rejects consultation requests targeting unverified advocates (`400 Bad Request`).
  * Role-based visibility on `GET /api/v1/matching/consultation-requests` (Citizens view their requests, Advocates view requests targeted to their chamber).
* **Case Ownership Security:**
  * Enforced client ownership on `GET /api/v1/matching/cases/{case_id}/advocates`. Unauthorized users receive `403 Forbidden`.
* **Testing & Verification:**
  * Built `backend/tests/test_advocate_matching.py` with 10 comprehensive tests covering hard filters, factor weights, budget constraints without paid boost, distance filters, match explanations, ownership checks, and consultation workflows.
  * Total test suite: **60/60 tests passing in 4.15s**.

---

## [Stage 6: Case Intake and Case Triage Module] - 2026-11-17

### 1. Goals Completed
* **Case Intake Dossier Foundation:**
  * Enabled authenticated citizens to submit legal grievances with comprehensive intake parameters: `title`, `problem_description`, `legal_issue_category`, `state`, `district`, `relevant_court`, `incident_date`, `preferred_language`, `urgency`, `supporting_info`, and `adverse_parties`.
  * Generated human-readable public reference codes adhering to standard format: `NYA-2026-CS-XXXX`.
* **Deterministic Legal Triage Engine (`DeterministicTriageEngine`):**
  * Modular rules engine implementing Indian jurisprudence (CPC, CrPC/BNSS, NI Act, Consumer Protection Act 2019, NALSA Act 1987).
  * Evaluates:
    1. **Identified Issue Category:** Normalized domain categorization with keyword extraction fallback.
    2. **Summary of Facts:** Structured, objective synthesis of client problem, timeline, territory, and disclosed details.
    3. **Missing Information:** Category-specific evidentiary gap detection (e.g., bank return memo and 15-day demand notice for Sec 138 NI Act, invoices for Consumer, title deeds for Property, FIR/station for Criminal).
    4. **Possible Jurisdiction:** Maps proper Indian judicial forum (e.g., DCDRC, JMFC / Metropolitan Magistrate, Sessions Court, Civil Court Senior Division, Family Court, NCLT, High Court).
    5. **Urgency Level:** `EMERGENCY_24H` | `URGENT_48H` | `STANDARD_30D` | `EXPLORATORY` (with critical keyword escalation for arrest, custody, eviction, and demolition).
    6. **Complexity Indicator:** `LOW` | `MEDIUM` | `HIGH`.
    7. **Suggested Next-Step:**
       - `SELF_HELP`: Low-complexity consumer e-Daakhil, RTI, or cyber crime portal complaints.
       - `FREE_LEGAL_AID`: Section 12 Legal Services Authorities Act, 1987 (indigent, BPL, domestic violence survivors, women, children).
       - `ADVOCATE_CONSULTATION`: Contested civil suits, commercial disputes, Sec 138 NI Act, property litigation.
       - `URGENT_ASSISTANCE`: Imminent arrest, police detention, interim stay against demolition or auction.
    8. **Advocate Assistance & Legal Aid Flags:** `advocate_assistance_appropriate` (bool) and `show_free_legal_aid` (bool).
* **Strict Ownership Isolation & Security:**
  * Strict client ownership invariant: Every case belongs to its authenticated citizen (`client_id == current_user.id`).
  * Citizen B is forbidden (`403 Forbidden`) from viewing, updating, or triaging Citizen A's cases.
  * `GET /api/v1/cases` isolates listings strictly to the authenticated user's cases.
  * Audit trails recorded in `AuditLog` for all case intake, updates, and triage evaluations.
* **Endpoints Implemented:**
  * `POST /api/v1/cases`: Submit legal grievance, create dossier, and execute initial auto-triage (201 Created).
  * `GET /api/v1/cases`: List authenticated user's cases with pagination (`page`, `limit`).
  * `GET /api/v1/cases/{case_id}`: Retrieve case details by ID (enforces client ownership).
  * `PATCH /api/v1/cases/{case_id}`: Update case details (enforces ownership and citizen stage guardrails).
  * `POST /api/v1/cases/{case_id}/triage`: Re-evaluate triage engine on existing case dossier.
  * `POST /api/v1/triage/assess`: Instant preliminary triage preview without creating a database record.
* **Database & Alembic Migration:**
  * Created migration `0006_case_intake_and_triage.py` adding intake columns (`problem_description`, `legal_issue_category`, `state`, `district`, `relevant_court`, `incident_date`, `preferred_language`, `supporting_info`, `triage_result`) and relaxing non-null constraints on legacy columns.
* **Testing & Verification:**
  * Built `backend/tests/test_case_intake_triage.py` covering all 10 scenarios: case intake, validation errors, ownership isolation (Citizen B blocked with 403), partial updates, triage pathways (`SELF_HELP`, `FREE_LEGAL_AID`, `URGENT_ASSISTANCE`, `ADVOCATE_CONSULTATION`), and unauthenticated rejections.
  * Total test suite: **50/50 tests passing in 3.21s**.

---

## [Stage 5: Advocate Registration and Verification Module] - 2026-11-17

### 1. Goals Completed
* **No Automatic Verification:** Enforced the strict regulatory invariant that registered advocates are **never automatically verified**; applications start in `PENDING` status.
* **Full Advocate Profile Support:**
  * Added `district` column to `advocate_profiles` via migration `0005_add_district_to_advocate_profiles.py`.
  * Support for full legal name, email, phone, Bar Council ID, State Bar Council, practice areas, courts/jurisdictions, languages, years of experience, city, district, state, and geographic location coordinates (`latitude`, `longitude`).
* **Verification Status Lifecycle:**
  * Supported workflow transitions: `PENDING` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `VERIFIED` / `REJECTED`.
  * Only advocates with `platform_verification_status == "VERIFIED"` are eligible to enter matching results (`/matching/advocates`).
* **Endpoints Implemented:**
  * `POST /api/v1/advocates/apply`: Submits full advocate profile; creates account if unauthenticated; initializes status as `PENDING`.
  * `GET /api/v1/advocates/me`: Returns the advocate's complete profile, verification status, and uploaded documents.
  * `GET /api/v1/admin/advocates/pending`: Lists pending/under review applications for administrative review.
  * `GET /api/v1/admin/advocates/{id}`: Detailed view of advocate profile, location coordinates, uploaded documents, and verification state.
  * `PATCH /api/v1/admin/advocates/{id}/verification`: Admin reviews and updates status (`UNDER_REVIEW`, `VERIFIED`, `REJECTED`) with decision reason and evidence level.
* **Security & Regulatory Invariants:**
  * Enforced admin-only access (`require_roles("ADMIN")`) on all administrative verification routes.
  * Prevented administrator self-approval (an admin who also holds an advocate profile cannot verify their own application).
  * Automatically generated immutable audit records in `AuditLog` for all verification decisions.
  * Zero public advocate ratings or promotional rankings implemented, maintaining BCI Rule 36 compliance.
* **Alembic Migration:**
  * Created `migrations/versions/0005_add_district_to_advocate_profiles.py` adding `district` column to `advocate_profiles`.
* **Testing & Verification:**
  * Implemented 10 comprehensive tests in `tests/test_advocate_registration_verification.py`.
  * Full test suite: **40/40 tests passing in 2.51s**.

---

## [Stage 4: Advocate Credential Verification System] - 2026-11-17

### 1. Goals Completed
* **No Fake Databases or Web Scraping:** Designed an extensible, provider-independent verification architecture (`VerificationProvider` ABC) with `AutomaticFormatValidator` (format regex + normalization) and `ManualAdminVerifier` (administrative roll review), designed to support future official Bar Council APIs.
* **Council-Specific Format Validation & Deduplication:**
  * Supported state-specific Bar Council patterns (Delhi `D/1234/2006`, Maharashtra `MAH/5678/2012`, UP `UP/1234/2020`, etc.).
  * Stored original enrollment numbers and normalized versions (`normalize_enrollment_number`) for strict deduplication across state prefixes.
* **Private Document Management:**
  * Support for secure uploads of Enrollment Certificates, Bar ID cards, AIBE, and COP certificates.
  * Stored privately under `backend/uploads/advocate_documents/` with private storage keys.
  * Zero public document URLs. Enforced strict RBAC: admins can inspect documents, advocates can download only their own documents, citizens and other advocates receive 403 Forbidden.
* **Verification Workflow Lifecycle:**
  * Statuses: `PENDING`, `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_MORE_INFORMATION`, `VERIFIED`, `REJECTED`.
  * Evidence Levels: `DOCUMENTS_REVIEWED`, `OFFICIAL_ROLL_MATCHED`, `COUNCIL_CONFIRMED`.
  * Recorded verification method, source name, source URL, reviewer ID, timestamp, decision reason, and private internal notes.
* **Matching Engine Integration:**
  * Only advocates with `platform_verification_status == "VERIFIED"` and active account appear in `/api/v1/matching/advocates`. Pending, submitted, or rejected advocates are strictly excluded.
* **Security & Regulatory Invariants:**
  * Prevented admin self-approval: admins cannot approve their own advocate applications.
  * Internal review notes are kept private to administrators and never returned to advocates or citizens.
  * Every verification action (submission, document upload, decision, info request) writes an immutable record to `AuditLog`.
* **Alembic Migration:**
  * Created `migrations/versions/0004_advocate_verification.py` adding `platform_verification_status` to `advocate_profiles`, creating `advocate_verification_applications`, and updating `advocate_verifications`.
* **Testing & Verification:**
  * Created `tests/test_advocate_verification.py` with 10 comprehensive tests covering all required scenarios: registration, duplicate enrollment, invalid format, unauthorized document access, self-approval prevention, citizen role restriction, admin approval, admin rejection, missing COP/AIBE info request, and matching exclusion.
  * Full test suite: **30/30 tests passing in 1.92s**.

---

## [Stage 3: Authentication and Authorization Module] - 2026-11-17

### 1. Goals Completed
* **Password Hashing:** Integrated **Argon2id** via `argon2-cffi` (`time_cost=3`, `memory_cost=65536`, `parallelism=4`, salt length=16, hash length=32) following OWASP specifications.
* **Token Management & Security:**
  * JWT access tokens (short-lived, 60 minutes) signed with `HS256`.
  * Revocable refresh tokens (7 days) with cryptographically secure random `jti` and SHA-256 fingerprint storage in `refresh_tokens` table.
  * Refresh token rotation: every refresh issues a new access/refresh token pair and invalidates the previous refresh token.
  * OWASP Refresh Token Reuse Detection: if an already-revoked refresh token is re-submitted, all active tokens for that user are immediately revoked as a security breach mitigation.
* **Role-Based Access Control (RBAC):**
  * Account Roles: `CITIZEN`, `ADVOCATE`, `ADMIN`.
  * Backend role enforcement: `ADMIN` role is blocked from self-registration across all public endpoints.
  * Request-level role tampering protection: user roles are strictly determined and assigned by backend logic, not client payloads.
  * FastAPI route dependency `require_roles(*roles)` with `HTTP_403_FORBIDDEN` protection.
* **Endpoints Implemented:**
  * `POST /api/v1/auth/register`: Public registration for citizens and advocates.
  * `POST /api/v1/auth/register/advocate`: Specialized advocate onboarding requiring Bar Council enrollment details.
  * `POST /api/v1/auth/login`: Email and password authentication issuing JWT tokens.
  * `POST /api/v1/auth/refresh`: Refresh token rotation and reissue.
  * `POST /api/v1/auth/logout`: Revokes active refresh token sessions.
  * `GET /api/v1/auth/me`: Current authenticated user profile (password hash omitted).
* **Database & Migrations:**
  * Created `migrations/versions/0003_add_auth_and_refresh_tokens.py` adding `password_hash` column to `users` and creating `refresh_tokens` table with foreign key to `users.id` (cascade delete).
* **Testing & Verification:**
  * 11 comprehensive automated tests in `tests/test_auth.py` covering citizen registration, advocate registration, duplicate checks, forbidden admin role self-assignment, password verification, incorrect credentials, non-existent users, unauthorized access, authorized access, role-based restrictions, refresh token rotation, and reuse revocation.
  * Full backend test suite: **20/20 tests passing in 0.69s**.
* **Documentation Updated:**
  * Updated `docs/API_CONTRACT.md` with complete endpoint specifications, JSON payload schemas, status codes, and error formats.

---

## [Stage 2: PostgreSQL Database Foundation & Data Models] - 2026-11-17

### 1. Goals Completed
* **Database Driver:** Transitioned to **SQLAlchemy 2** with native **Psycopg 3** (`psycopg[binary]>=3.2.0`).
* **Extensions Architecture:** Configured PostGIS (`geoalchemy2`) and dense vector embeddings (`pgvector`).
* **Centralized Database Session:**
  * Created `AsyncSessionLocal` using `create_async_engine(settings.DATABASE_URL)`.
  * Implemented `get_db()` route dependency with automatic commit, rollback on error, and session cleanup.
  * Implemented `get_db_context()` async context manager for scripts and migrations.
  * Implemented non-blocking database health checker `check_db_health()` diagnosing connectivity, latency, and extension presence.
* **Declarative Base Model:**
  * Defined `Base(DeclarativeBase)` with `to_dict()` and `__repr__()`.
  * Defined `TimestampMixin` providing `created_at` and `updated_at` with time-zone awareness and database server defaults.
* **12 Domain Entities Modeled:**
  1. `User`: Core identity, roles (`LITIGANT`, `ADVOCATE`, `ADMIN`), language preference.
  2. `AdvocateProfile`: Bar Council credentials, practice domains, fee structures, and **PostGIS geography point** (`location`) for distance-based discovery.
  3. `AdvocateVerification`: Bar Council ID card and COP audit records.
  4. `LegalCase`: Case dossiers, dispute metadata, urgency, and conflict clearance state.
  5. `CaseMessage`: Privileged communications under Section 126–129 BSA 2023.
  6. `ConsultationRequest`: Intake triage records from homepage forms and modals.
  7. `Appointment`: Fixed-fee consultation bookings with video conference links.
  8. `LegalSource`: Central statutory acts (BNS, BNSS, BSA, Contract Act, NI Act, RERA).
  9. `LegalChunk`: Statutory clauses and sections with **configurable vector dimension** (`settings.EMBEDDING_VECTOR_DIMENSION`).
  10. `Document`: Evidence vault and filings with SHA-256 cryptographic verification.
  11. `Deadline`: Court dates and limitation periods with priority levels.
  12. `AuditLog`: Immutable compliance and access trail.
* **Alembic Migrations:**
  * `0001_enable_postgresql_extensions.py`: Enables `uuid-ossp`, `postgis`, and `vector`.
  * `0002_create_core_tables.py`: DDL for all 12 tables, indexes, spatial GiST indexes, foreign keys, and constraints.
* **Supabase Integration:**
  * Registered user's publishable key `sb_publishable_AghcSMNgQd1JlABKevbIGA_wROA32fu` in configuration.
  * Documented direct connection and transaction pooler formats.
* **Testing & Verification:**
  * Built `tests/test_database.py` testing table registry, geography and vector definitions, SQL compilation for PostgreSQL dialect, and health probe resilience.
  * All 9 tests passing. Verified offline Alembic SQL generation (`alembic upgrade head --sql`).

---

## [Stage 1: Modular Monolith Foundation Setup] - 2026-11-17
* Initialized backend modular monolith workspace under `/backend`.
* Configured Python 3.12 environment with FastAPI, Pydantic v2, and Alembic.
* Centralized environment settings (`app/core/config.py`) reading `.env` with type validation and dynamic CORS origin parsing.
* Built structured JSON logging system (`app/core/logging.py`).
* Implemented centralized exception handling hierarchy (`app/core/errors.py`).
* Initialized versioned API routing under `/api/v1` with system diagnostic health check (`GET /api/v1/health`).
* Created 12 modular monolith domain packages.
