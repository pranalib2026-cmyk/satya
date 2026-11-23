# NyayaSetu Database Reference

> Consolidated from: `docs/DATABASE.md`, `docs/DATABASE.md`.

## Canonical Database Baseline

- PostgreSQL 16 with PostGIS and pgvector.
- SQLAlchemy 2.0 async ORM + Alembic migrations.
- Tests may use SQLite/aiosqlite compatibility where configured; production target is PostgreSQL.


---

## Database Specification

# Database Specification & Schema Reference — NyayaSetu (न्यायसेतु)

**Engine:** PostgreSQL 16+ (Local / Managed Supabase)  
**ORM:** SQLAlchemy 2.0 (Asyncio)  
**Driver:** Psycopg 3 (`psycopg[binary]>=3.2.0`, dialect: `postgresql+psycopg://`)  
**Geospatial Engine:** PostGIS (`geoalchemy2`)  
**Vector Engine:** pgvector (`pgvector.sqlalchemy`)  
**Migrations:** Alembic (`backend/alembic.ini`, `backend/migrations/`)  
**Test Engine:** SQLite in-memory (`aiosqlite`)  

---

## 1. Foundational Extensions

PostgreSQL extensions are enabled via forward migration `0001_enable_postgresql_extensions.py`:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";
```

1. **`uuid-ossp`:** Native RFC 4122 v4 Universally Unique Identifiers for primary keys across all tables.
2. **`postgis`:** Spherical spatial calculations over advocate chamber coordinates in WGS84 (`SRID 4326`).
3. **`vector`:** Multi-dimensional vector storage and cosine distance similarity queries for Grounded Legal RAG.

---

## 2. Entity-Relationship Architecture

```mermaid
erDiagram
    users ||--o| advocate_profiles : "has profile (1:1)"
    users ||--o{ refresh_tokens : "active sessions (1:N)"
    users ||--o{ legal_cases : "files as client (1:N)"
    users ||--o{ appointments : "books as client (1:N)"
    users ||--o{ consultation_requests : "submits (1:N)"
    users ||--o{ case_messages : "sends (1:N)"
    users ||--o{ documents : "uploads (1:N)"
    users ||--o{ audit_logs : "triggers as actor (1:N)"

    advocate_profiles ||--o| advocate_verification_applications : "submits (1:1)"
    advocate_profiles ||--o{ advocate_verifications : "credentials (1:N)"
    advocate_profiles ||--o{ legal_cases : "lead counsel (1:N)"
    advocate_profiles ||--o{ appointments : "attends (1:N)"
    advocate_profiles ||--o{ consultation_requests : "targeted by (1:N)"

    legal_cases ||--o{ case_messages : "matter threads (1:N)"
    legal_cases ||--o{ documents : "evidence vault (1:N)"
    legal_cases ||--o{ deadlines : "limitation calendar (1:N)"
    legal_cases ||--o{ appointments : "hearings (1:N)"

    legal_sources ||--o{ legal_chunks : "chunked into sections (1:N)"
```

---

## 3. Database Models & Schema Definitions

All entity models inherit from `app.core.database.Base` and include audit timestamps from `TimestampMixin` (`created_at`, `updated_at`).

### 3.1 `users` Table
Stores core identity and role credentials.
* `id` (`UUID`, PK): Default `uuid.uuid4`.
* `email` (`VARCHAR(255)`, Unique, Indexed): Normalized lowercase email.
* `phone` (`VARCHAR(32)`, Unique, Indexed): E.164 formatted Indian phone number (e.g., `+919876543210`).
* `hashed_password` (`VARCHAR(255)`): Argon2id password hash.
* `full_name` (`VARCHAR(255)`): Citizen or advocate legal name.
* `role` (`VARCHAR(32)`, Indexed): `CITIZEN` | `ADVOCATE` | `ADMIN`.
* `is_active` (`BOOLEAN`): Default `true`.
* `is_verified` (`BOOLEAN`): Default `false` (phone OTP flag).
* `preferred_language` (`VARCHAR(8)`): `en`, `hi`, or `kn`.
* `created_at`, `updated_at` (`TIMESTAMPTZ`).

---

### 3.2 `refresh_tokens` Table
Tracks rotated JWT refresh sessions and prevents token reuse attacks.
* `id` (`UUID`, PK).
* `user_id` (`UUID`, FK `users.id` ON DELETE CASCADE, Indexed).
* `token_hash` (`VARCHAR(64)`, Indexed): SHA-256 fingerprint hash of the raw refresh token.
* `jti` (`VARCHAR(64)`, Unique, Indexed): Cryptographic UUID token identifier.
* `expires_at` (`TIMESTAMPTZ`, Indexed): Expiry timestamp (7 days).
* `revoked` (`BOOLEAN`, Indexed): Default `false`. Set to `true` upon rotation or logout.
* `revoked_at` (`TIMESTAMPTZ`, Nullable).
* `user_agent` (`VARCHAR(255)`, Nullable).
* `ip_address` (`VARCHAR(45)`, Nullable).

---

### 3.3 `advocate_profiles` Table
Stores professional Bar Council credentials, practice domains, and geographic coordinates.
* `id` (`UUID`, PK).
* `user_id` (`UUID`, FK `users.id` ON DELETE CASCADE, Unique, Indexed).
* `bar_council_id` (`VARCHAR(64)`, Unique, Indexed): Enrolment number (e.g., `D/1234/2006`, `KAR/5678/2012`).
* `bar_council_name` (`VARCHAR(128)`): State Bar Council (e.g., `Bar Council of Delhi`).
* `in_practice_years` (`INTEGER`): Active practice experience.
* `primary_practice` (`VARCHAR(64)`, Indexed): Primary statutory domain (e.g., `Trials & Disputes`, `Corporate & M&A`).
* `secondary_practices` (`ARRAY(VARCHAR(64))`): Secondary practice areas.
* `courts_of_practice` (`ARRAY(VARCHAR(128))`): Regular courts (e.g., `Supreme Court of India`, `Delhi High Court`).
* `languages` (`ARRAY(VARCHAR(32))`): Supported spoken/drafting languages.
* `bio` (`TEXT`, Nullable): Professional summary.
* `is_partner` (`BOOLEAN`): Default `false`.
* `hourly_rate_inr` (`NUMERIC(10,2)`, Nullable).
* `fixed_consultation_fee_inr` (`NUMERIC(10,2)`, Nullable).
* **`location` (`GEOGRAPHY(POINT, 4326)`, Nullable):** PostGIS geographic coordinate (WGS84).
* `city` (`VARCHAR(128)`, Indexed).
* `district` (`VARCHAR(128)`, Indexed, Nullable).

---

### 3.4 `advocate_verification_applications` & `advocate_verifications` Tables
Manages formal verification of Bar Council enrolments.
* **`advocate_verification_applications`:**
  * `id` (`UUID`, PK).
  * `advocate_id` (`UUID`, FK `advocate_profiles.id` ON DELETE CASCADE, Unique, Indexed).
  * `status` (`VARCHAR(32)`, Indexed): `PENDING` | `SUBMITTED` | `UNDER_REVIEW` | `NEEDS_MORE_INFO` | `VERIFIED` | `REJECTED`.
  * `bar_council_id` (`VARCHAR(64)`).
  * `enrollment_date` (`DATE`, Nullable).
  * `state_bar_council` (`VARCHAR(128)`).
  * `reviewed_by` (`UUID`, FK `users.id`, Nullable).
  * `reviewed_at` (`TIMESTAMPTZ`, Nullable).
  * `decision_reason` (`TEXT`, Nullable).
* **`advocate_verifications`:**
  * `id` (`UUID`, PK).
  * `advocate_id` (`UUID`, FK `advocate_profiles.id` ON DELETE CASCADE, Indexed).
  * `document_type` (`VARCHAR(64)`): `BAR_COUNCIL_ID` | `ENROLMENT_CERT` | `CERTIFICATE_OF_PRACTICE`.
  * `document_url` (`VARCHAR(512)`): Private storage path.
  * `verified_by_user_id` (`UUID`, FK `users.id`, Nullable).

---

### 3.5 `legal_cases` Table
Central matter docket tracking citizen grievances, milestones, and triage results.
* `id` (`UUID`, PK).
* `case_reference` (`VARCHAR(64)`, Unique, Indexed): Formatted docket (e.g., `NYA-2026-CS-4819`).
* `client_id` (`UUID`, FK `users.id` ON DELETE CASCADE, Indexed).
* `lead_advocate_id` (`UUID`, FK `advocate_profiles.id`, Nullable, Indexed).
* `title` (`VARCHAR(255)`): Matter title.
* `problem_description` (`TEXT`, Nullable): Citizen's factual grievance.
* `legal_issue_category` (`VARCHAR(128)`, Indexed): Domain classification.
* `state` (`VARCHAR(64)`, Nullable).
* `district` (`VARCHAR(64)`, Nullable).
* `relevant_court` (`VARCHAR(128)`, Nullable): Probable forum.
* `incident_date` (`DATE`, Nullable): Cause of action date.
* `preferred_language` (`VARCHAR(8)`): Default `en`.
* `urgency` (`VARCHAR(32)`): Urgency categorization.
* `supporting_info` (`TEXT`, Nullable).
* `adverse_parties` (`TEXT`, Nullable): Adverse entities for conflict clearance.
* `stage` (`VARCHAR(64)`, Indexed): `DRAFT` | `TRIAGED` | `ADVOCATE_MATCHED` | `CONSULTATION_SCHEDULED` | `PROCEEDING_ACTIVE` | `RESOLVED` | `CLOSED`.
* `conflict_status` (`VARCHAR(32)`): `PENDING` | `CLEARED` | `FLAGGED`.
* `triage_result` (`JSONB`, Nullable): Structured JSON output from deterministic triage engine.

---

### 3.6 `case_messages` Table
Privileged communication messages between clients and assigned advocates.
* `id` (`UUID`, PK).
* `case_id` (`UUID`, FK `legal_cases.id` ON DELETE CASCADE, Indexed).
* `sender_id` (`UUID`, FK `users.id`, Indexed).
* `message_body` (`TEXT`).
* `is_confidential` (`BOOLEAN`): Default `true`.
* `read_at` (`TIMESTAMPTZ`, Nullable).

---

### 3.7 `consultation_requests` Table
Litigant consultation inquiries directed to specific empanelled advocates.
* `id` (`UUID`, PK).
* `client_id` (`UUID`, FK `users.id`, Indexed).
* `advocate_id` (`UUID`, FK `advocate_profiles.id`, Indexed).
* `case_id` (`UUID`, FK `legal_cases.id`, Nullable, Indexed).
* `status` (`VARCHAR(32)`, Indexed): `PENDING` | `ACCEPTED` | `REJECTED` | `EXPIRED`.
* `message` (`TEXT`, Nullable).

---

### 3.8 `appointments` Table
Scheduled consultation sessions and hearings.
* `id` (`UUID`, PK).
* `booking_reference` (`VARCHAR(64)`, Unique, Indexed): Reference code (e.g., `NYA-BK-2026-1049`).
* `case_id` (`UUID`, FK `legal_cases.id`, Nullable, Indexed).
* `advocate_id` (`UUID`, FK `advocate_profiles.id` ON DELETE CASCADE, Indexed).
* `client_id` (`UUID`, FK `users.id` ON DELETE CASCADE, Indexed).
* `scheduled_start` (`TIMESTAMPTZ`, Indexed).
* `scheduled_end` (`TIMESTAMPTZ`, Indexed).
* `timezone` (`VARCHAR(64)`): Default `Asia/Kolkata`.
* `status` (`VARCHAR(32)`, Indexed): `PENDING_CONFIRMATION` | `CONFIRMED` | `CANCELLED` | `COMPLETED` | `REJECTED`.
* `mode` (`VARCHAR(32)`): `VIDEO` | `PHONE` | `IN_PERSON`.
* `meeting_link` (`VARCHAR(512)`, Nullable).
* `fee_inr` (`NUMERIC(10,2)`).
* `payment_status` (`VARCHAR(32)`): `PENDING` | `PAID` | `REFUNDED`.
* `client_notes` (`TEXT`, Nullable).
* `rejection_reason` (`TEXT`, Nullable).

---

### 3.9 `legal_sources` & `legal_chunks` Tables (pgvector Knowledge Base)
Statutory repository storing Indian Bare Acts, Gazette notifications, and court judgments.
* **`legal_sources`:**
  * `id` (`UUID`, PK).
  * `source_type` (`VARCHAR(64)`, Indexed): `BARE_ACT` | `COURT_JUDGMENT` | `GAZETTE_NOTIFICATION` | `LEGAL_AID_SCHEME`.
  * `title` (`VARCHAR(255)`, Indexed): E.g., `Negotiable Instruments Act 1881`.
  * `short_code` (`VARCHAR(64)`, Indexed, Nullable): E.g., `NI_ACT`, `CPA_2019`, `RERA`, `BNS`.
  * `citation` (`VARCHAR(255)`, Nullable): E.g., `Act No. 26 of 1881`.
  * `jurisdiction` (`VARCHAR(128)`, Indexed): Default `Supreme Court of India / Bharat Central`.
  * `court` (`VARCHAR(128)`, Nullable).
  * `act_or_judgment_identifier` (`VARCHAR(128)`, Nullable).
  * `publication_date` (`DATE`, Nullable).
  * `last_verified_date` (`DATE`, Nullable).
  * `document_version` (`VARCHAR(32)`): Default `1.0`.
  * `content_checksum` (`VARCHAR(64)`, Nullable): SHA-256 hash of verified source text.
  * `year` (`INTEGER`, Nullable).
  * `official_source_url` (`TEXT`, Nullable): Verified IndiaCode / e-Gazette URL.
  * `metadata_json` (`JSONB`, Nullable).
* **`legal_chunks`:**
  * `id` (`UUID`, PK).
  * `source_id` (`UUID`, FK `legal_sources.id` ON DELETE CASCADE, Indexed).
  * `section_number` (`VARCHAR(64)`, Indexed, Nullable): E.g., `Section 138`.
  * `clause_heading` (`VARCHAR(255)`, Nullable): Section title.
  * `chunk_text` (`TEXT`): Full statutory text of the provision.
  * `token_count` (`INTEGER`, Nullable).
  * `content_checksum` (`VARCHAR(64)`, Nullable): SHA-256 chunk hash.
  * **`embedding` (`VECTOR(768)`, Nullable):** 768-D dense vector embedding.
  * `metadata_json` (`JSONB`, Nullable).
  * *Composite Index:* `idx_legal_chunks_source_section` on `(source_id, section_number)`.

---

### 3.10 `documents` Table
Secure document vault tracking uploaded client evidence and legal filings.
* `id` (`UUID`, PK).
* `case_id` (`UUID`, FK `legal_cases.id` ON DELETE CASCADE, Indexed).
* `uploaded_by` (`UUID`, FK `users.id`, Indexed).
* `file_name` (`VARCHAR(255)`).
* `storage_path` (`VARCHAR(512)`): Private filesystem path outside web root.
* `file_size_bytes` (`INTEGER`).
* `mime_type` (`VARCHAR(128)`): Whitelisted MIME (`application/pdf`, images, docs).
* `sha256_checksum` (`VARCHAR(64)`): Byte stream integrity hash.
* `document_category` (`VARCHAR(64)`, Indexed): `EVIDENCE` | `NOTICE` | `PLEADINGS` | `ORDER`.
* `is_confidential` (`BOOLEAN`): Default `true`.

---

### 3.11 `deadlines` Table
Statutory limitation periods and court appearance dates.
* `id` (`UUID`, PK).
* `case_id` (`UUID`, FK `legal_cases.id` ON DELETE CASCADE, Indexed).
* `title` (`VARCHAR(255)`).
* `deadline_date` (`DATE`, Indexed).
* `deadline_type` (`VARCHAR(64)`, Indexed): `STATUTORY_LIMITATION` | `COURT_HEARING` | `FILING_DUE` | `NOTICE_REPLY`.
* `statutory_basis` (`VARCHAR(255)`, Nullable): E.g., `Section 138 NI Act 30-day notice`.
* `is_advocate_confirmed` (`BOOLEAN`): Default `false`. Requires empanelled counsel sign-off.
* `confirmed_by_advocate_id` (`UUID`, FK `advocate_profiles.id`, Nullable).
* `is_completed` (`BOOLEAN`): Default `false`.
* `completed_at` (`TIMESTAMPTZ`, Nullable).
* `remind_days_before` (`ARRAY(INTEGER)`): E.g., `[7, 3, 1]`.

---

### 3.12 `audit_logs` Table
Immutable security, consent, and query audit trail for DPDP compliance.
* `id` (`UUID`, PK).
* `actor_id` (`UUID`, FK `users.id`, Nullable, Indexed).
* `action` (`VARCHAR(128)`, Indexed): E.g., `USER_LOGIN`, `LEGAL_AI_QUERY_ANSWERED`, `DOCUMENT_UPLOADED`.
* `entity_type` (`VARCHAR(64)`, Indexed).
* `entity_id` (`VARCHAR(64)`, Nullable).
* `ip_address` (`VARCHAR(45)`, Nullable).
* `user_agent` (`VARCHAR(255)`, Nullable).
* `payload_snapshot` (`JSONB`, Nullable).
* `created_at` (`TIMESTAMPTZ`, Indexed).

---

## 4. Alembic Migration Process

### 4.1 Configuration
Defined in `backend/alembic.ini`:
```ini
[alembic]
script_location = migrations
prepend_sys_path = .
version_path_separator = os
```

### 4.2 Migration Execution Commands
Run from the `backend/` directory:

```bash
cd backend
source ../venv/bin/activate

# Apply all pending migrations to PostgreSQL
alembic upgrade head

# Roll back the single most recent migration
alembic downgrade -1

# Generate a new forward migration after editing SQLAlchemy models
alembic revision --autogenerate -m "add_new_feature_column"

# Inspect current database revision status
alembic current
alembic history --verbose
```

> [!CAUTION]
> **No Direct DDL Edits:** Never modify committed migration scripts in `backend/migrations/versions/`. Always create new forward migrations using `alembic revision --autogenerate`.


---

## Backend Database Schema Specification

# Database Schema Specification — PostgreSQL 16 & Supabase

## 1. Architectural Foundation
* **Database Engine:** PostgreSQL 16+ (Supabase / Managed PostgreSQL)
* **ORM:** SQLAlchemy 2.0 (Declarative Mapping)
* **Driver:** `psycopg` (Psycopg 3 with native async and binary extensions)
* **Geospatial Engine:** PostGIS (`geoalchemy2`)
* **Vector Engine:** pgvector (`pgvector.sqlalchemy`)
* **Migrations:** Alembic

---

## 2. PostgreSQL Extensions
The database schema relies on three foundational PostgreSQL extensions enabled via migration `0001_extensions`:
1. `uuid-ossp`: For generating RFC 4122 v4 Universally Unique Identifiers (UUIDs).
2. `postgis`: For spatial indexes and spherical distance queries over advocate chamber coordinates using WGS84 (`SRID 4326`).
3. `vector`: For storing and querying high-dimensional dense vector embeddings for statutory similarity search.

---

## 3. Entity-Relationship Architecture (Mermaid)

```mermaid
erDiagram
    users ||--o| advocate_profiles : "has profile (1:1)"
    users ||--o{ legal_cases : "files as client (1:N)"
    users ||--o{ appointments : "books as client (1:N)"
    users ||--o{ consultation_requests : "submits (1:N)"
    users ||--o{ case_messages : "sends (1:N)"
    users ||--o{ documents : "uploads (1:N)"
    users ||--o{ audit_logs : "triggers as actor (1:N)"

    advocate_profiles ||--o| advocate_verification_applications : "submits application (1:1)"
    advocate_profiles ||--o{ advocate_verifications : "uploads credentials (1:N)"
    advocate_profiles ||--o{ legal_cases : "represents as lead counsel (1:N)"
    advocate_profiles ||--o{ appointments : "attends as advocate (1:N)"
    advocate_profiles ||--o{ consultation_requests : "targeted by (1:N)"

    legal_cases ||--o{ case_messages : "contains discussion (1:N)"
    legal_cases ||--o{ documents : "stores evidence & filings (1:N)"
    legal_cases ||--o{ deadlines : "tracks statutory limitations (1:N)"
    legal_cases ||--o{ appointments : "schedules hearings (1:N)"

    legal_sources ||--o{ legal_chunks : "chunked into sections (1:N)"
```

---

## 4. Entity Descriptions & Schema Definitions

### 1. `users` (Core Identity & Access)
Represents all system actors: citizens seeking legal advice, litigants, empanelled advocates, chamber junior associates, and administrators.
* `id` (`UUID`, PK): Random UUID v4.
* `phone` (`VARCHAR(20)`, Unique, Not Null): 10-digit Indian mobile number (+91).
* `email` (`VARCHAR(255)`, Unique, Nullable): Validated email address.
* `full_name` (`VARCHAR(255)`, Not Null): Legal name of user.
* `role` (`VARCHAR(32)`, Not Null): `LITIGANT` | `ADVOCATE` | `CHAMBER_STAFF` | `ADMIN`.
* `is_verified` (`BOOLEAN`, Default `false`): Verification flag (OTP phone verification or KYC).
* `is_active` (`BOOLEAN`, Default `true`): Account status.
* `preferred_language` (`VARCHAR(10)`, Default `'en'`): Multi-lingual choice (`en`, `hi`, `mr`, `ta`, `te`, `bn`).
* `created_at`, `updated_at`: UTC timestamps.

### 2. `advocate_profiles` (Chamber & Advocate Credentials)
Contains Bar Council enrollment details, years in practice, court admissions, fee structures, and physical chamber coordinates.
* `id` (`UUID`, PK).
* `user_id` (`UUID`, FK -> `users.id`, Unique, Cascade Delete).
* `bar_council_id` (`VARCHAR(64)`, Unique, Not Null): Enrolment ID (e.g., `D/1234/2006`).
* `bar_council_name` (`VARCHAR(128)`, Not Null): e.g., `Bar Council of Delhi`.
* `in_practice_years` (`INTEGER`, Not Null, Constraint `>= 0`).
* `primary_practice` (`VARCHAR(64)`, Not Null): Primary area of practice (e.g., `Trials & Disputes`).
* `secondary_practices` (`ARRAY(VARCHAR(64))`): Additional practice groups.
* `courts_of_practice` (`ARRAY(VARCHAR(128))`): Supreme Court, High Courts, NCLT, RERA, etc.
* `languages` (`ARRAY(VARCHAR(32))`): Languages fluent in court argumentation.
* `bio` (`TEXT`, Nullable): Professional summary and career background.
* `is_partner` (`BOOLEAN`, Default `false`): Named partner designation.
* `hourly_rate_inr` (`NUMERIC(10,2)`, Nullable).
* `fixed_consultation_fee_inr` (`NUMERIC(10,2)`, Nullable): Standard initial consultation fee.
* **`location` (`geography(POINT, 4326)`):** PostGIS geographic coordinate (Latitude, Longitude in WGS84) with spatial GiST index for fast proximity queries ("find counsel within 15 km of District Court").
* `city` (`VARCHAR(128)`, Not Null), `district` (`VARCHAR(128)`, Nullable), `state` (`VARCHAR(128)`, Not Null), `pincode` (`VARCHAR(10)`).
* `platform_verification_status` (`VARCHAR(32)`, Default `'PENDING'`): `PENDING` | `SUBMITTED` | `UNDER_REVIEW` | `NEEDS_MORE_INFORMATION` | `VERIFIED` | `REJECTED`. Only `VERIFIED` advocates appear in client matching results.
* `created_at`, `updated_at`: UTC timestamps.

### 3. `advocate_verification_applications` (Credential Verification Applications)
Captures the formal verification application submitted by an advocate, including Bar Council enrollment details, AIBE, COP, and administrative decision audit attributes.
* `id` (`UUID`, PK).
* `advocate_id` (`UUID`, FK -> `advocate_profiles.id`, Unique, Cascade Delete).
* `enrollment_number` (`VARCHAR(64)`, Not Null): Original enrollment number (e.g., `D/1234/2006`).
* `enrollment_number_normalized` (`VARCHAR(64)`, Unique, Not Null): Normalized uppercase form for cross-council duplicate detection.
* `enrollment_name` (`VARCHAR(255)`, Not Null): Name exactly as printed on the State Bar Council certificate.
* `state_bar_council` (`VARCHAR(128)`, Not Null): Name of the State Bar Council.
* `enrollment_date` (`DATE`, Nullable): Date of enrollment.
* `aibe_status` (`VARCHAR(32)`, Default `'NOT_APPLICABLE'`): `PASSED` | `NOT_APPLICABLE` | `PENDING`.
* `cop_status` (`VARCHAR(32)`, Default `'NOT_APPLICABLE'`): `ACTIVE` | `EXPIRED` | `NOT_APPLICABLE`.
* `contact_phone` (`VARCHAR(20)`), `contact_email` (`VARCHAR(255)`).
* `platform_verification_status` (`VARCHAR(32)`, Default `'PENDING'`): Workflow status.
* `evidence_level` (`VARCHAR(32)`, Nullable): `DOCUMENTS_REVIEWED` | `OFFICIAL_ROLL_MATCHED` | `COUNCIL_CONFIRMED`.
* `verification_method` (`VARCHAR(32)`, Nullable): `AUTOMATIC` | `MANUAL_ADMIN` | `OFFICIAL_API`.
* `source_name` (`VARCHAR(128)`), `source_url` (`VARCHAR(512)`): Official roll or record consulted.
* `decision_reason` (`TEXT`, Nullable): Mandatory reason for approval or rejection.
* `internal_notes` (`TEXT`, Nullable): Private notes for admin reviewers (never exposed to advocates or public).
* `info_request_message` (`TEXT`, Nullable): Clarification message when status is `NEEDS_MORE_INFORMATION`.
* `reviewer_id` (`UUID`, FK -> `users.id`, Set Null): Administrator who made the decision.
* `submitted_at`, `decided_at`: Timestamps for SLA tracking.
* `created_at`, `updated_at`: UTC timestamps.

### 4. `advocate_verifications` (Private Credential Document Records)
Records uploaded credential documents linked to the advocate's verification profile.
* `id` (`UUID`, PK).
* `advocate_id` (`UUID`, FK -> `advocate_profiles.id`, Cascade Delete).
* `verification_type` (`VARCHAR(64)`): `ENROLLMENT_CERTIFICATE` | `BAR_ID_CARD` | `AIBE_CERTIFICATE` | `COP_CERTIFICATE`.
* `storage_key` (`TEXT`, Not Null): Private storage path (never exposed in public profiles or responses).
* `filename` (`VARCHAR(256)`), `content_type` (`VARCHAR(128)`), `size_bytes` (`INTEGER`).
* `status` (`VARCHAR(32)`, Default `'PENDING'`): `PENDING` | `VERIFIED` | `REJECTED`.
* `created_at`, `updated_at`: UTC timestamps.

### 5. `legal_cases` (Matters & Court Dossiers)
Core legal matter registry managing case intake, structured triage results, conflict clearance, assigned counsel, court jurisdiction, and case stage.
* `id` (`UUID`, PK).
* `case_reference` (`VARCHAR(32)`, Unique, Not Null): Formatted identifier (e.g., `NYA-2026-CS-84A2`).
* `client_id` (`UUID`, FK -> `users.id`, Restrict Delete).
* `lead_advocate_id` (`UUID`, FK -> `advocate_profiles.id`, Set Null).
* `title` (`VARCHAR(255)`, Not Null): Matter heading.
* `problem_description` (`TEXT`, Nullable): Detailed narrative of user's legal issue.
* `legal_issue_category` (`VARCHAR(64)`, Indexed): Consumer, Criminal, Family, Property, Cheque Bounce, Labour, etc.
* `state` (`VARCHAR(128)`, Indexed): State of dispute/occurrence.
* `district` (`VARCHAR(128)`, Indexed): District of dispute/occurrence.
* `relevant_court` (`VARCHAR(128)`, Nullable): Specified court or forum.
* `incident_date` (`DATE`, Nullable): Date when cause of action arose.
* `preferred_language` (`VARCHAR(10)`, Default `'en'`).
* `urgency` (`VARCHAR(32)`, Default `'standard-30d'`): `emergency-24h` | `urgent-48h` | `standard-30d` | `exploratory`.
* `supporting_info` (`TEXT`, Nullable): Disclosed collateral evidence, documents, or context.
* `triage_result` (`JSONB`, Nullable): Stored structured case triage evaluation (category, summary of facts, missing info, jurisdiction, urgency level, complexity, suggested next step).
* `practice_group` (`VARCHAR(64)`, Nullable): Domain group.
* `matter_type` (`VARCHAR(64)`, Nullable): Type of suit or proceeding.
* `summary` (`TEXT`, Nullable): Factual background.
* `adverse_parties` (`TEXT`, Nullable): Disclosed opposing parties for conflict search.
* `adverse_counsel` (`VARCHAR(255)`, Nullable): Opposing advocate or law firm.
* `conflict_status` (`VARCHAR(32)`, Default `'CLEARANCE_PENDING'`): `CLEARANCE_PENDING` | `CLEARED` | `CONFLICT_DETECTED`.
* `stage` (`VARCHAR(32)`, Default `'INTAKE'`): `INTAKE` | `COUNSEL_ASSIGNED` | `PLEADINGS` | `HEARING` | `DISPOSED`.
* `court_forum` (`VARCHAR(128)`, Nullable): Specific court or tribunal where filed.
* `disposed_at` (`TIMESTAMPTZ`, Nullable).
* `created_at`, `updated_at`: UTC timestamps.

### 6. `case_messages` (Privileged Counsel Communications)
Encrypted communications exchanged between litigants and advocates.
* `id` (`UUID`, PK).
* `case_id` (`UUID`, FK -> `legal_cases.id`, Cascade Delete).
* `sender_id` (`UUID`, FK -> `users.id`, Restrict Delete).
* `sender_role` (`VARCHAR(32)`): `CLIENT` | `ADVOCATE` | `AI_ASSISTANT` | `SYSTEM`.
* `message_text` (`TEXT`, Not Null).
* `is_privileged` (`BOOLEAN`, Default `true`): Protected under Section 126–129 Bharatiya Sakshya Adhiniyam 2023.
* `metadata_json` (`JSONB`, Nullable): Action items, citation references, or document attachment IDs.
* `created_at`, `updated_at`: UTC timestamps.

### 6. `consultation_requests` (Intake Triage)
Captures preliminary intake from Homepage conflict form, Contact 4-step wizard, or Quick Modal prior to full account onboarding.
* `id` (`UUID`, PK).
* `reference_code` (`VARCHAR(32)`, Unique, Not Null): Public reference (e.g. `NYA-2026-QC-7294`).
* `client_id` (`UUID`, FK -> `users.id`, Nullable): Linked user if signed in.
* `guest_name`, `guest_email`, `guest_phone`, `company_or_city`: Contact metadata for unauthenticated prospects.
* `preferred_practice` (`VARCHAR(64)`): Target practice area.
* `targeted_advocate_id` (`UUID`, FK -> `advocate_profiles.id`, Nullable): Specific partner requested.
* `source_screen` (`VARCHAR(64)`): UI entry point.
* `urgency` (`VARCHAR(32)`), `legal_problem_summary` (`TEXT`), `adverse_party_names` (`TEXT`).
* `status` (`VARCHAR(32)`, Default `'SUBMITTED'`): `SUBMITTED` | `CONFLICT_CHECKING` | `CLEARED` | `CONFLICT_FLAGGED` | `MATCHED` | `REJECTED`.
* `non_confidential_acknowledged` (`BOOLEAN`, Default `true`).
* `triage_notes_json` (`JSONB`): AI preliminary statutory diagnostics and court jurisdiction suggestions.
* `created_at`, `updated_at`: UTC timestamps.

### 7. `appointments` (Consultations & Fixed-Fee Sessions)
Scheduled consultation slots and video conferences with verified advocates. Overlapping bookings for the same advocate are strictly prevented.
* `id` (`UUID`, PK).
* `booking_reference` (`VARCHAR(32)`, Unique, Not Null): e.g. `NYA-BK-2026-9042`.
* `case_id` (`UUID`, FK -> `legal_cases.id`, Nullable, Cascade Delete).
* `advocate_id` (`UUID`, FK -> `advocate_profiles.id`, Restrict Delete).
* `client_id` (`UUID`, FK -> `users.id`, Restrict Delete).
* `scheduled_start`, `scheduled_end` (`TIMESTAMPTZ`, Not Null, Indexed).
* `timezone` (`VARCHAR(64)`, Default `'Asia/Kolkata'`, Not Null).
* `status` (`VARCHAR(32)`, Default `'REQUESTED'`): `REQUESTED` | `SCHEDULED` | `CONFIRMED` | `COMPLETED` | `CANCELLED` | `REJECTED`.
* `mode` (`VARCHAR(32)`, Default `'VIDEO'`): `VIDEO` | `IN_PERSON` | `PHONE`.
* `meeting_link` (`TEXT`, Nullable): Secure consultation room URL.
* `fee_inr` (`NUMERIC(10,2)`, Nullable): Fixed consultation fee.
* `payment_status` (`VARCHAR(32)`, Default `'PENDING'`): `PENDING` | `PAID` | `WAIVED`.
* `payment_order_id` (`VARCHAR(128)`, Nullable): Payment gateway order ID.
* `client_notes` (`TEXT`, Nullable).
* `rejection_reason` (`TEXT`, Nullable).
* `created_at`, `updated_at`: UTC timestamps.

### 8. `legal_sources` & `legal_chunks` (Knowledge Base & Vector Embeddings)
Indian statutory codes (BNS, BNSS, BSA, Contract Act, NI Act, CPA 2019, RERA, NALSA) and Supreme Court precedents indexed for AI semantic search.
* **`legal_sources`**:
  * `id` (`UUID`, PK).
  * `source_type` (`VARCHAR(64)`): `BARE_ACT` | `COURT_JUDGMENT` | `GAZETTE_NOTIFICATION` | `LEGAL_AID_SCHEME`.
  * `title` (`VARCHAR(255)`, Not Null), `short_code` (`VARCHAR(64)`), `citation` (`VARCHAR(255)`).
  * `jurisdiction` (`VARCHAR(128)`, Indexed), `court` (`VARCHAR(128)`, Indexed, Nullable).
  * `act_or_judgment_identifier` (`VARCHAR(128)`, Indexed, Nullable): e.g., `Act No. 26 of 1881`.
  * `publication_date` (`DATE`, Nullable), `last_verified_date` (`DATE`, Nullable).
  * `document_version` (`VARCHAR(32)`, Default `'1.0'`).
  * `content_checksum` (`VARCHAR(64)`, Nullable): SHA-256 hash of verified source text.
  * `year` (`INTEGER`), `official_source_url` (`TEXT`).
  * `metadata_json` (`JSONB`).
* **`legal_chunks`**:
  * `id` (`UUID`, PK).
  * `source_id` (`UUID`, FK -> `legal_sources.id`, Cascade Delete).
  * `section_number` (`VARCHAR(64)`, Nullable): e.g., `Section 138`, `Section 35`.
  * `clause_heading` (`VARCHAR(255)`, Nullable): e.g., `Dishonour of cheque`.
  * `chunk_text` (`TEXT`, Not Null): Plain language and official statutory text.
  * `token_count` (`INTEGER`, Nullable).
  * `content_checksum` (`VARCHAR(64)`, Nullable): SHA-256 hash of chunk content.
  * `metadata_json` (`JSONB`, Nullable).
  * **`embedding` (`VECTOR(settings.EMBEDDING_VECTOR_DIMENSION)`):**
    * Configurable vector dimension defined in environment settings (default `768`, adjustable to `1536` or `3072` per model).
    * Indexed with HNSW or IVFFlat for high-speed cosine similarity.

### 9. `documents` (Evidence Vault & Pleadings)
Secure document storage tracking petitions, affidavits, contracts, and court orders. Physical files reside in a private vault directory (`backend/storage/vault/{case_id}/`) outside the frontend public directory, accessible only through signed, short-lived JWT tokens (15-min expiry) or authenticated sessions with verified case permissions.
* `id` (`UUID`, PK).
* `case_id` (`UUID`, FK -> `legal_cases.id`, Nullable, Cascade Delete).
* `uploader_id` (`UUID`, FK -> `users.id`, Restrict Delete).
* `file_name` (`VARCHAR(255)`), `file_size_bytes` (`BIGINT`), `mime_type` (`VARCHAR(128)`).
* `storage_path` (`TEXT`): Private vault file path.
* `checksum_sha256` (`VARCHAR(64)`): Cryptographic tamper-proofing and integrity verification.
* `is_confidential` (`BOOLEAN`, Default `true`).
* `document_category` (`VARCHAR(64)`): `PETITION` | `AFFIDAVIT` | `CONTRACT` | `EVIDENCE` | `COURT_ORDER`.
* `metadata_json` (`JSONB`, Nullable).
* `created_at`, `updated_at`: UTC timestamps.

### 10. `deadlines` (Limitation Act & Court Dates)
Critical statutory countdowns, limitation periods, and court appearance dates. No unverified automated LLM calculations: statutory limitation tracking is created manually or based on verified legal provisions and subject to independent advocate confirmation.
* `id` (`UUID`, PK).
* `case_id` (`UUID`, FK -> `legal_cases.id`, Cascade Delete).
* `title` (`VARCHAR(255)`, Not Null).
* `description` (`TEXT`, Nullable).
* `deadline_type` (`VARCHAR(64)`, Default `'STATUTORY_LIMITATION'`, Indexed): `STATUTORY_LIMITATION` | `COURT_HEARING` | `FILING_RESPONSE` | `NOTICE_EXPIRY` | `GENERAL`.
* `source_basis` (`VARCHAR(255)`, Nullable): Legal authority or statute rule (e.g., `Limitation Act 1963`, `Order VIII Rule 1 CPC`).
* `statutory_provision` (`VARCHAR(128)`, Nullable): e.g., `Section 138(c) NI Act`.
* `due_date` (`TIMESTAMPTZ`, Not Null, Indexed).
* `priority` (`VARCHAR(32)`, Default `'HIGH'`, Indexed): `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`.
* `is_advocate_confirmed` (`BOOLEAN`, Default `false`, Indexed): Explicit confirmation by a verified advocate.
* `confirmed_by_advocate_id` (`UUID`, FK -> `advocate_profiles.id`, Nullable, Set Null).
* `confirmed_at` (`TIMESTAMPTZ`, Nullable).
* `is_completed` (`BOOLEAN`, Default `false`, Indexed), `completed_at` (`TIMESTAMPTZ`, Nullable).
* `reminders_json` (`JSONB`, Default `{}`): Scheduled alerts (`days_before` list and calculated reminder dates) and notification logs.
* `created_at`, `updated_at`: UTC timestamps.

### 11. `audit_logs` (BCI & DPDP Compliance Ledger)
Immutable audit trail logging every conflict check, case access, and document download.
* `id` (`UUID`, PK).
* `actor_id` (`UUID`, FK -> `users.id`, Nullable, Set Null).
* `action` (`VARCHAR(128)`, Not Null, Indexed).
* `entity_type` (`VARCHAR(64)`, Not Null), `entity_id` (`VARCHAR(64)`, Nullable).
* `ip_address` (`VARCHAR(45)`), `user_agent` (`TEXT`).
* `payload_snapshot` (`JSONB`, Nullable).
* `created_at` (`TIMESTAMPTZ`, Default `NOW()`, Indexed).

---

## 5. Connecting with Supabase (Psycopg 3 Connection Guide)

To connect the NyayaSetu backend to Supabase:

1. Obtain your database password and reference ID from your Supabase dashboard (`Project Settings` -> `Database`).
2. Update your `backend/.env` with the Supabase connection URL using the Psycopg 3 dialect:
```bash
# Direct Connection (Port 5432)
DATABASE_URL=postgresql+psycopg://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Or Transaction Pooler (Port 6543, recommended for serverless / high concurrency)
DATABASE_URL=postgresql+psycopg://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```
3. Set your Supabase publishable key:
```bash
SUPABASE_PUBLISHABLE_KEY=sb_publishable_AghcSMNgQd1JlABKevbIGA_wROA32fu
```
4. Run migrations directly to Supabase:
```bash
cd backend
../venv/bin/alembic upgrade head
```
