# NyayaSetu (न्यायसेतु) — Cloudflare R2 Storage Migration Plan & Security Audit

**Document Purpose:** Production Storage Migration & Ephemeral Data-Loss Remediation Plan  
**Target Architecture:** Python 3.12 · FastAPI 0.115 · SQLAlchemy 2.0 · PostgreSQL 16 · Cloudflare R2 (S3-Compatible API)  
**Audit Date:** November 21, 2026  
**Status:** **AUDIT COMPLETE — PENDING USER APPROVAL**  

---

## 1. Executive Summary & Root Cause Analysis

### The Critical Issue
Uploaded legal documents, case evidence, contracts, and advocate credentials are currently stored directly on the backend's local filesystem at:
```text
backend/storage/vault/{case_id}/{document_id}_{safe_filename}
backend/uploads/advocate_documents/{profile_id}/{doc_type}/{uuid}{ext}
```

### The Production Risk
In modern containerized and cloud platforms (Docker, Kubernetes, AWS ECS, Google Cloud Run, Railway, Fly.io), the container root filesystem is **ephemeral**. When the backend container restarts, crashes, redeploys, or scales horizontally to multiple worker replicas:
1. **Total Document Loss:** All previously uploaded evidence documents on local disk are deleted.
2. **Multi-Replica Split-Brain:** A document uploaded through Replica A cannot be downloaded through Replica B, returning `404 Not Found: Document physical file missing from private storage vault`.
3. **Absolute Host Path Lock-In:** The database column `storage_path` records absolute local filesystem paths (e.g., `/Users/yashodhan/.../storage/vault/...`). If the backend directory structure changes in production (e.g., `/app/storage/vault/` inside Docker), all existing database records break immediately.
4. **Local Disk Exhaustion (DoS):** Unchecked local storage of 25MB evidence uploads can exhaust host disk space, crashing the PostgreSQL database and API server simultaneously.

### The Objective
Migrate production document storage to **Cloudflare R2** using its S3-compatible API. Cloudflare R2 provides durable object storage with **zero bandwidth egress fees** (unlike AWS S3) and a generous free tier (10 GB storage, 1,000,000 Class A operations/month, 10,000,000 Class B operations/month). PostgreSQL will continue to manage metadata, ownership, permissions, and checksum verification. Local filesystem storage will be strictly reserved for offline local development and automated pytest test suites.

---

## 2. Current Storage Architecture Audit

### 2.1 File Storage Map & Current Invariants

```text
NyayaSetu/
├── backend/
│   ├── storage/
│   │   └── vault/                          <-- Case evidence & legal filings (LOCAL DISK)
│   │       └── {case_id}/
│   │           └── {document_id}_{safe_filename}
│   └── uploads/
│       └── advocate_documents/             <-- Advocate Bar IDs & Certificates (LOCAL DISK)
│           └── {profile_id}/
│               └── {verification_type}/
│                   └── {uuid}.pdf
```

### 2.2 Physical File Inventory (Measured on Disk)

An audit of the local filesystem revealed the following existing files:
* **Case Evidence Vault (`backend/storage/vault/`):**
  * **67 files** across **67 case subdirectories** (Total size: ~3.2 KB).
  * *Audit Finding:* All 67 files are test fixtures generated during automated test runs of `test_documents_appointments_deadlines.py` (e.g., `contract.pdf`, `cheque_return_memo.pdf`, `case_a_doc.pdf`). Because tests invoke the live upload service without a teardown cleanup hook, test files accumulate in the local directory.
* **Advocate Credential Documents (`backend/uploads/advocate_documents/`):**
  * **95 files** across **63 advocate profile subdirectories** (Total size: ~16.3 KB).
  * *Audit Finding:* Generated during advocate verification test runs (`test_advocate_verification.py`, `test_advocate_registration_verification.py`).

---

## 3. All Affected Files, Functions, and API Routes

### 3.1 Backend Application (`backend/`)

| File Path | Function / Constant | Current Behavior | Required R2 Target Behavior |
|---|---|---|---|
| [`backend/app/modules/documents/service.py`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/app/modules/documents/service.py) | `VAULT_DIR` | Hardcoded local `Path` to `backend/storage/vault`. | Decouple: used only by `LocalStorageProvider` for dev/test. |
| [`backend/app/modules/documents/service.py`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/app/modules/documents/service.py#L80-L170) | `DocumentService.upload_document` | Synchronous `with open(storage_file_path, "wb") as f:` writes to local disk; saves absolute host path in `Document.storage_path`. | Delegate to `StorageProvider.upload_file()`; in production, stream bytes to Cloudflare R2 bucket; save relative object key (`vault/cases/{case_id}/{doc_id}_{filename}`). |
| [`backend/app/modules/documents/service.py`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/app/modules/documents/service.py#L206-L231) | `DocumentService.generate_download_token` | Signs 15-minute JWT and returns local API URL (`/api/v1/documents/{doc.id}/download?token={token}`). | In production R2 mode: generates an **S3/R2 presigned GET URL** valid for 15 minutes (`generate_presigned_url('get_object', ...)`). |
| [`backend/app/modules/documents/service.py`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/app/modules/documents/service.py#L233-L287) | `DocumentService.get_document_for_download` | Checks `os.path.exists(doc.storage_path)` on local disk; returns `doc` and physical filesystem string. | In R2 mode: validates permissions and returns R2 object key or presigned redirect URL; in local mode, returns local disk path. |
| [`backend/app/modules/documents/router.py`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/app/modules/documents/router.py#L117-L160) | `download_document` (`GET /{id}/download`) | Returns `FileResponse(path=physical_path)` reading from local disk. | In R2 mode: issues an **HTTP 307 Temporary Redirect** to the S3/R2 presigned URL or streams directly; in local mode, returns `FileResponse`. |
| [`backend/app/modules/documents/models.py`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/app/modules/documents/models.py#L16-L80) | `Document` Model | `storage_path: Mapped[str] = mapped_column(Text)`. | Add `storage_backend: Mapped[str]` (`'local'` vs `'r2'`) to track storage tier; standardize `storage_path` as relative storage key. |
| [`backend/app/core/config.py`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/app/core/config.py) | `Settings` | No S3/R2 configuration fields exist. | Add `STORAGE_BACKEND`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT_URL`. |
| [`backend/app/core/config.py`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/app/core/config.py) | `validate_ai_configuration()` | Only validates AI provider. | Add `validate_storage_configuration()` to prevent production startup with unconfigured R2 credentials. |
| [`backend/requirements.txt`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/requirements.txt) | Dependencies | Missing `boto3`. | Pin `boto3>=1.34.0,<2.0.0` and `botocore>=1.34.0,<2.0.0`. |
| [`backend/app/modules/advocates/service.py`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/backend/app/modules/advocates/service.py#L81) | `UPLOAD_DIRECTORY`, `upload_verification_document`, `get_document_file` | Writes to `backend/uploads/advocate_documents/` on local disk. | (Related Finding): Unify advocate credential uploads to use the same `StorageProvider` under key prefix `vault/advocates/`. |

### 3.2 Frontend Client (`frontend/`)

| File Path | Function / Hook | Behavior & Compatibility Assessment |
|---|---|---|
| [`frontend/src/services/dashboard/documents.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/documents.ts#L31-L74) | `storage.upload` | Posts multipart `FormData` to `/api/v1/documents/cases/${caseId}/upload`. **100% compatible:** no frontend change required. |
| [`frontend/src/services/dashboard/documents.ts`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/services/dashboard/documents.ts#L54-L68) | `storage.getSignedUrl` | Fetches `/api/v1/documents/${documentId}/access-token`, reads `res.download_url`. **100% compatible:** backend returns direct R2 presigned URL in `download_url`. |
| [`frontend/src/app/dashboard/vault/page.tsx`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/frontend/src/app/dashboard/vault/page.tsx) | `VaultPage` UI | Consumes `storage.upload` and `signedUrl`. **Zero frontend design modifications required.** |

---

## 4. Current Metadata Schema in PostgreSQL

The current `documents` table definition in PostgreSQL:

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    storage_path TEXT NOT NULL,                     -- CURRENT ISSUE: Contains absolute local path
    checksum_sha256 VARCHAR(64) NOT NULL,           -- SHA-256 integrity hash
    is_confidential BOOLEAN NOT NULL DEFAULT TRUE,
    document_category VARCHAR(64) NOT NULL DEFAULT 'EVIDENCE',
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_documents_case_category ON documents(case_id, document_category);
```

### Schema Limitations Identified:
1. `storage_path` contains `/Users/yashodhan/Documents/Projects/NyayaSetu/backend/storage/vault/...` in existing development databases.
2. The schema lacks an explicit `storage_backend` indicator (`'local'` vs `'r2'`), making it impossible to know from the database alone whether a document is stored locally or in Cloudflare R2 without parsing the string.

---

## 5. Security & Permission Enforcement Analysis

### 5.1 Authentication & Case Permissions
* **Authorization Gate:** `DocumentService._verify_case_permission()` strictly checks:
  * `CITIZEN`: Allowed only if `case.client_id == user.id`. Cross-citizen access returns `403 Forbidden`.
  * `ADVOCATE`: Allowed only if `case.lead_advocate_id == advocate_profile.id`. Non-assigned advocates receive `403 Forbidden`.
  * `ADMIN`: Platform administrators have supervisory access.
* **Download Access Token Security:**
  * Endpoint `GET /documents/{document_id}/access-token` issues a short-lived JWT signed with `settings.SECRET_KEY` (HS256) expiring in **15 minutes (900 seconds)**.
  * Direct unauthenticated access to `GET /documents/{document_id}/download` is rejected with `401 Unauthorized`.
* **Audit Logging:** Every document upload and download is recorded in the `audit_logs` table in PostgreSQL with `actor_id`, `ip_address`, `user_agent`, `file_name`, and `checksum_sha256`.

### 5.2 R2 Presigned URL Security
Moving to Cloudflare R2 preserves and strengthens this security model:
1. **Private Bucket Security:** The Cloudflare R2 bucket is **strictly private**. Public bucket access is disabled.
2. **Short-Lived Presigned URLs:** Download URLs are generated with AWS Signature Version 4 (SigV4) expiring in 15 minutes (900 seconds). After expiry, the URL is cryptographically invalid.
3. **Audit Log Preservation:** When `GET /access-token` is requested, the backend performs permission validation and records `AuditLog(action="DOCUMENT_DOWNLOAD_TOKEN_ISSUED")` before generating the presigned R2 URL.

---

## 6. Recommended Cloudflare R2 Architecture

### 6.1 Provider Abstraction Architecture

To maintain zero external network dependencies for offline development and testing, implement an abstracted storage layer:

```
                      ┌──────────────────────────────┐
                      │     BaseStorageProvider      │
                      │         (Abstract)           │
                      └──────────────┬───────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
  ┌──────────────┴──────────────┐         ┌──────────────┴──────────────┐
  │     LocalStorageProvider    │         │  CloudflareR2StorageProvider│
  │ (Development & Pytest Only) │         │     (Production Storage)    │
  ├─────────────────────────────┤         ├─────────────────────────────┤
  │ • backend/storage/vault/    │         │ • boto3 S3 Client           │
  │ • Local filesystem I/O      │         │ • Endpoint: *.r2.cloudfl... │
  │ • Zero external credentials │         │ • SigV4 Presigned URLs      │
  │ • Instant test execution    │         │ • Zero egress fees ($0/GB)  │
  └─────────────────────────────┘         └─────────────────────────────┘
```

### 6.2 Object Key Hierarchy in R2

All objects stored in R2 will follow a clean, standardized, non-colliding key structure:

```text
r2://nyayasetu-vault-production/
├── cases/
│   └── {case_id}/
│       └── {document_id}_{sanitized_filename}
└── advocates/
    └── {profile_id}/
        └── {verification_type}/
            └── {uuid}.pdf
```

### 6.3 Dual Download Modes (Maximum Client Compatibility)

1. **Direct Presigned URL Mode (Preferred):**
   * Client calls `/api/v1/documents/{document_id}/access-token`.
   * Backend checks permissions, logs audit event, generates R2 Presigned URL (`ExpiresIn=900`), and returns:
     `{"download_url": "https://<account_id>.r2.cloudflarestorage.com/nyayasetu-vault/...&X-Amz-Signature=..."}`.
   * Client downloads directly from Cloudflare's edge network. Zero backend server bandwidth used.
2. **Proxy / Redirect Mode (Backwards Compatibility):**
   * If a client calls `/api/v1/documents/{document_id}/download?token={token}`:
   * In R2 mode: Backend verifies token, then returns an **HTTP 307 Temporary Redirect** to the R2 presigned URL.
   * In local mode: Backend returns `FileResponse` from local disk.

---

## 7. Required Database Changes

To cleanly differentiate legacy local files from Cloudflare R2 objects, create Alembic migration:  
`backend/migrations/versions/0011_document_storage_r2.py`

```python
"""Add storage_backend and storage_key to documents table.

Revision ID: 0011_document_storage_r2
Revises: 0010_legal_document_ingestion_pipeline
"""
from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    # 1. Add storage_backend (default 'local')
    op.add_column(
        "documents",
        sa.Column("storage_backend", sa.String(length=32), nullable=False, server_default="local"),
    )
    op.create_index("ix_documents_storage_backend", "documents", ["storage_backend"])

    # 2. Add relative storage_key for cloud object storage
    op.add_column(
        "documents",
        sa.Column("storage_key", sa.Text(), nullable=True),
    )

def downgrade() -> None:
    op.drop_index("ix_documents_storage_backend", table_name="documents")
    op.drop_column("documents", "storage_key")
    op.drop_column("documents", "storage_backend")
```

---

## 8. Safe Migration Strategy for Existing Documents

### 8.1 Safety Principles
1. **Zero Downtime:** The backend will support reading both `local` and `r2` stored documents concurrently.
2. **Non-Destructive Migration:** Existing files in `backend/storage/vault/` will **never be deleted or overwritten** during the migration script run.
3. **Cryptographic Verification:** Every migrated file's SHA-256 hash in R2 is validated against the recorded `checksum_sha256` in PostgreSQL before updating the database record.

### 8.2 Operational Migration Script: `backend/scripts/migrate_vault_to_r2.py`

The script will operate in three modes:
* `--dry-run`: Inspects database and local disk, printing all planned uploads without touching R2 or modifying PostgreSQL.
* `--verify-only`: Compares hashes between local files, PostgreSQL metadata, and R2 objects.
* `--execute`:
  1. Selects all documents where `storage_backend == 'local'`.
  2. Reads file from local `storage_path`.
  3. Computes local SHA-256 and verifies it matches `doc.checksum_sha256`.
  4. Uploads to Cloudflare R2 bucket at `cases/{case_id}/{doc_id}_{filename}` with `Content-Type` and `Metadata={"sha256": checksum}`.
  5. Updates PostgreSQL record: `storage_backend = 'r2'`, `storage_key = 'cases/...'`.
  6. Commits transaction. Local file remains safely on disk as cold backup.

---

## 9. Required Environment Variables

Add to `backend/.env` (and document in `backend/.env.example`):

```bash
# ==============================================================================
# DOCUMENT STORAGE CONFIGURATION (Cloudflare R2 / S3-Compatible)
# ==============================================================================

# Storage Backend: 'local' for development and testing; 'r2' for production
STORAGE_BACKEND=local

# Cloudflare R2 Credentials (Required when STORAGE_BACKEND=r2)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=nyayasetu-vault
R2_ENDPOINT_URL=https://[YOUR_ACCOUNT_ID].r2.cloudflarestorage.com
R2_PRESIGNED_EXPIRY_SECONDS=900
```

### Production Startup Validation Rule:
In `backend/app/core/config.py`, update `validate_storage_configuration()`:
* If `ENVIRONMENT=production`:
  * `STORAGE_BACKEND` must NOT be `'local'`.
  * `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` must be non-empty strings.
  * If misconfigured, startup raises `RuntimeError` immediately with clear remediation instructions.

---

## 10. Testing, Verification, and Rollback Plan

### 10.1 Automated Test Strategy
* **Offline Unit & Integration Tests:**
  * When running `pytest`, `STORAGE_BACKEND` defaults to `'local'`.
  * Tests run completely offline with zero network calls, zero R2 credentials required, and fast execution.
  * All 165 existing tests continue to pass without regression.
* **Dedicated Storage Tests (`test_storage_r2.py`):**
  * Test `LocalStorageProvider` upload, exists, download, delete.
  * Test `CloudflareR2StorageProvider` using `unittest.mock` (mocking `boto3.client("s3")`) to verify:
    * S3 client initialization with custom endpoint URL.
    * Upload with correct metadata and content type.
    * Presigned URL generation with 900-second expiry.
    * Error handling on S3 network timeout or invalid bucket credentials.
    * Production startup rejection if `STORAGE_BACKEND=local` in production.

### 10.2 Rollback Plan
If Cloudflare R2 encounters an outage or incorrect credentials are supplied:
1. **Instant Rollback via Config:** Switch `STORAGE_BACKEND=local` in environment variables and restart.
2. **Dual-Read Fallback:** The service layer will fall back to reading local files if `storage_backend == 'local'` in the database.
3. **Data Integrity:** Because the migration script does not delete local files, all original files remain intact on disk.

---

## 11. Unverifiable Aspects from Code Audit

The following items cannot be determined solely from inspecting repository code and require user input:
1. **Live Cloudflare Account ID & R2 Bucket Name:** The Cloudflare R2 bucket has not yet been provisioned in the user's Cloudflare dashboard.
2. **Production Hosting Infrastructure:** Whether production backend will run on Docker containers, Kubernetes, Fly.io, or virtual machines (determines how environment variables and persistent volume backups are provisioned).
3. **Existing Production Database State:** The local development database contains only test documents. If an external production PostgreSQL database is active, its document count and total byte size must be queried directly from that database.

---

## 12. Next Steps (Awaiting User Approval)

Upon user approval of this plan, implementation will proceed in the following ordered phases:
1. **Phase 1:** Add `boto3` to `backend/requirements.txt` and install into virtual environment.
2. **Phase 2:** Update `Settings` in `backend/app/core/config.py` with R2 configuration and production startup validator.
3. **Phase 3:** Create storage abstraction in `backend/app/core/storage.py` (`BaseStorageProvider`, `LocalStorageProvider`, `CloudflareR2StorageProvider`).
4. **Phase 4:** Create Alembic migration `0011_document_storage_r2.py` for `storage_backend` and `storage_key`.
5. **Phase 5:** Update `backend/app/modules/documents/service.py` and `router.py` to use `get_storage_provider()`.
6. **Phase 6:** Create operational migration script `backend/scripts/migrate_vault_to_r2.py`.
7. **Phase 7:** Add unit and integration tests in `backend/tests/test_storage_r2.py`.
8. **Phase 8:** Verify full test suite (165+ tests passing).
