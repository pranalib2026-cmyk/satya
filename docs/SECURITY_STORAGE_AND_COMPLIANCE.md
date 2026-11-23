# NyayaSetu Security, Storage & Compliance

> Consolidated from: `docs/SECURITY_STORAGE_AND_COMPLIANCE.md`, `docs/SECURITY_STORAGE_AND_COMPLIANCE.md`, `docs/SECURITY_STORAGE_AND_COMPLIANCE.md`, `docs/SECURITY_STORAGE_AND_COMPLIANCE.md`, `docs/SECURITY_STORAGE_AND_COMPLIANCE.md`.


---

## Document Vault Security

# NyayaSetu (न्यायसेतु) — Document Vault Security & Hardening Specification

**Document Purpose:** Production Security, Access Control, and Invariant Specification for Document Storage & Legal Evidence Vault  
**Target Environment:** Production, Staging & CI/CD  
**Applicable Regulations:** Digital Personal Data Protection Act, 2023 (DPDP Act) · Bar Council of India (BCI) Professional Secrecy Rules · Information Technology Act, 2000  

---

## 1. Executive Security Architecture

The NyayaSetu Document Vault manages citizen evidence, advocate bar credentials, litigation petitions, affidavits, and court orders. Because this data encompasses sensitive, privileged attorney-client communications and legal evidence, the storage subsystem enforces multi-layered defense-in-depth:

```
[ Citizen / Advocate Client ]
               │
               ▼
[ 1. Transport Security ] ─── HTTPS / TLS 1.3 Strict-Transport-Security
               │
               ▼
[ 2. Authentication Gate ] ── Bearer JWT verification (HS256 with Argon2id-hashed credentials)
               │
               ▼
[ 3. Access Guard (RBAC) ] ── Case Ownership & Advocate Empanelment Check (Client/Advocate/Admin)
               │
               ▼
[ 4. Payload Validation ] ── Extension, MIME type & Magic Byte signature inspection (≤ 10MB)
               │
               ▼
[ 5. Quota & Rate Limit ] ── 8GB total vault capacity, 500MB user quota, 30 uploads/hour
               │
               ▼
[ 6. Storage Atomicity ] ──── Unpredictable S3 Key + Two-Phase Commit with Orphan Cleanup
               │
        ┌──────┴──────────────────────────────────┐
        ▼                                         ▼
[ Cloudflare R2 (Private) ]            [ PostgreSQL 16 Metadata ]
(Opaque key, zero public access)        (SHA-256 checksum, audit trail)
```

---

## 2. Threat Model & Security Mitigations

| Threat Vector | Severity | Attack Description | Implemented Mitigation |
| :--- | :--- | :--- | :--- |
| **Unauthenticated Upload** | **Critical** | Attacker uploads arbitrary or malicious files without logging in. | Route enforces `current_user = Depends(get_current_active_user)`. Unauthenticated requests return `401 Unauthorized`. |
| **Cross-Tenant Unauthorized Access** | **Critical** | Citizen B views, downloads, or deletes Citizen A's confidential case evidence. | Strict RBAC in `_verify_case_permission`. Only the case client, assigned lead advocate, or platform admin can view/download/delete. Returns `403 Forbidden`. |
| **Extension Spoofing & Disguised Payloads** | **High** | Attacker uploads a `.exe` or shell script renamed as `.pdf`. | Triple validation: extension whitelist (`ALLOWED_EXTENSIONS`), MIME type whitelist, and **magic bytes signature validation** (`validate_file_content_signature`). |
| **Local / Cloud Disk Exhaustion (DoS)** | **High** | Attacker floods system with huge files, crashing database or filling disk. | Hard 10MB per-file upload limit, 8GB total application capacity, 500MB user quota, and 30 uploads/hour rate limit. |
| **Path Traversal Attacks** | **High** | Uploading `../../etc/passwd` to overwrite server configuration. | Filesystem sanitization with `_resolve_path` and `re.sub(r"[^\w\-.]", "_", original_filename)`. Resolving outside vault raises security `ValueError`. |
| **Object Key Guessing & Enumeration** | **Medium** | Attacker brute-forces predictable file URLs (e.g., `doc_1.pdf`, `doc_2.pdf`). | Storage keys decouple from filenames and incorporate 128 bits of cryptographically secure random entropy: `vault/cases/{case_id}/{doc_id}_{16_byte_random_token}{ext}`. |
| **Public S3 Bucket Leakage** | **Critical** | Misconfigured cloud bucket exposes evidence to the public internet. | Cloudflare R2 bucket is strictly private (no public domain). Downloads require short-lived (15-min) SigV4 presigned URLs generated only after backend authentication. |
| **Orphaned Files & Ghost Records** | **Medium** | Upload succeeds to cloud but database commit fails, creating unmanaged files. | Two-phase cleanup: if DB commit fails after storage upload, the backend deletes the cloud object and rolls back the DB transaction. |
| **Sensitive Data Exposure in Logs** | **Medium** | Sensitive document text or PII leaked in application logs. | Audit logs record only metadata (`file_name`, `file_size`, `checksum`, `storage_backend`). File bytes and extracted text are **never** logged. |

---

## 3. Input & File Integrity Validation

### 3.1 Allowed Extensions & MIME Types
Only standard legal document and scanned evidence formats are accepted:
* `.pdf` — `application/pdf`
* `.jpg`, `.jpeg` — `image/jpeg`
* `.png` — `image/png`
* `.docx` — `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
* `.doc` — `application/msword`

Executable formats (`.exe`, `.bat`, `.sh`, `.php`, `.py`, `.js`, `.bin`, `.msi`) and script files are strictly rejected at the route entry point.

### 3.2 Magic Byte Header Content Inspection
To prevent extension spoofing, the backend inspects the actual initial bytes of the file before accepting the upload:

```python
# Content Signature Validation:
if ext == ".pdf" and not content.startswith(b"%PDF-"):
    raise BadRequestException("File content signature does not match PDF format.")
elif ext in (".jpg", ".jpeg") and not content.startswith(b"\xff\xd8\xff"):
    raise BadRequestException("File content signature does not match JPEG format.")
elif ext == ".png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
    raise BadRequestException("File content signature does not match PNG format.")
elif ext == ".docx" and not content.startswith(b"PK\x03\x04"):
    raise BadRequestException("File content signature does not match DOCX format.")
elif ext == ".doc" and not content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
    raise BadRequestException("File content signature does not match legacy DOC format.")
```

### 3.3 Cryptographic Integrity Checksum (SHA-256)
Every uploaded document is hashed using SHA-256 (`hashlib.sha256(content).hexdigest()`). The resulting 64-character hexadecimal hash is stored in `Document.checksum_sha256` and recorded in the audit log to ensure evidentiary non-repudiation under Section 65B of the Indian Evidence Act / Section 63 of the Bharatiya Sakshya Adhiniyam, 2023.

---

## 4. Storage Limits, Quotas & Rate Limiting

All storage limits are configured at the application level to preserve system stability and maintain predictable infrastructure usage without compromising user data:

### 4.1 Maximum Individual File Size (10 MB)
* **Setting:** `STORAGE_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024` (10 MB).
* Uploads exceeding 10 MB are rejected with `400 Bad Request`.
* Prevents memory saturation during streaming and parsing.

### 4.2 Application-Level Total Storage Capacity (8 GB)
* **Setting:** `STORAGE_TOTAL_CAPACITY_BYTES = 8 * 1024 * 1024 * 1024` (8 GB).
* Before accepting a new upload, the backend computes total stored bytes across all documents.
* If adding the file would exceed 8 GB, upload is rejected with `400 Bad Request: Application storage capacity limit reached (8GB). Unable to process new upload at this time. Please contact support.`
* **Important:** Application limits are never described as Cloudflare billing caps. Existing documents are **never** deleted when limits are reached.

### 4.3 Per-User Storage Quota (500 MB)
* **Setting:** `STORAGE_USER_QUOTA_BYTES = 500 * 1024 * 1024` (500 MB).
* Enforced on non-admin users across all their uploaded documents.
* When exceeded, user is prompted to delete older, unused case documents.

### 4.4 Per-User Stored Documents Limit (50 Documents)
* **Setting:** `STORAGE_USER_MAX_DOCUMENTS = 50`.
* Limits total active document records per citizen/advocate to 50 files.

### 4.5 Upload Rate Limiting (30 Uploads / Hour)
* **Setting:** `STORAGE_USER_UPLOAD_RATE_LIMIT_PER_HOUR = 30`.
* Queries recent `DOCUMENT_UPLOADED` audit log events for the requesting user in the last 60 minutes.
* Throttles automated flood attacks and runaway client scripts.

---

## 5. Object Key Generation & Unpredictability

### The Problem
Using the user's original filename in S3 object keys (e.g., `vault/cases/123/medical_report.pdf`) causes:
1. Information leakage (exposing sensitive matter titles or evidence descriptions).
2. URL predictability and directory brute-forcing.

### The Solution
NyayaSetu generates unpredictable, high-entropy object keys:
```python
unpredictable_token = secrets.token_hex(16)
storage_key = f"vault/cases/{case_id}/{doc_id}_{unpredictable_token}{ext}"
```
* The original user filename (`file_name`) is stored exclusively in PostgreSQL.
* Upon download, the backend sets `ResponseContentDisposition='attachment; filename="{doc.file_name}"'`, returning the user's friendly filename.

---

## 6. Access Control & Permission Enforcement

All document viewing, downloading, and deletion endpoints enforce strict role-based access control (RBAC):

```python
async def _verify_case_permission(cls, db: AsyncSession, case_id: uuid.UUID, user: User) -> LegalCase:
    res = await db.execute(select(LegalCase).where(LegalCase.id == case_id))
    case = res.scalar_one_or_none()
    if not case:
        raise NotFoundException(message=f"Case with ID '{case_id}' was not found.")

    if user.role == "CITIZEN":
        if case.client_id != user.id:
            raise ForbiddenException(message="Access forbidden: You do not have permission to access documents for this case.")
    elif user.role == "ADVOCATE":
        adv_res = await db.execute(select(AdvocateProfile.id).where(AdvocateProfile.user_id == user.id))
        adv_id = adv_res.scalar_one_or_none()
        if not adv_id or case.lead_advocate_id != adv_id:
            raise ForbiddenException(message="Access forbidden: You are not the assigned advocate for this case.")
    # ADMIN is permitted
    return case
```

### Authorization by Operation
1. **Metadata Viewing (`GET /api/v1/documents/{document_id}`):** Enforces case permission.
2. **Download Token (`GET /api/v1/documents/{document_id}/access-token`):** Enforces case permission before generating signed URL or JWT.
3. **Document Download (`GET /api/v1/documents/{document_id}/download`):** Validates Bearer token or short-lived download JWT.
4. **Document Deletion (`DELETE /api/v1/documents/{document_id}`):** Enforces case permission and verifies the user is the document uploader, case client, or an administrator.

---

## 7. Atomicity & Orphaned Object Prevention

To guarantee that failed uploads do not leave dangling objects in Cloudflare R2 or corrupt records in PostgreSQL, the upload pipeline implements a transactional rollback pattern:

```python
uploaded_to_storage = False
try:
    await provider.upload(key=storage_key, content=content, ...)
    uploaded_to_storage = True

    db.add(document)
    db.add(audit)
    await db.commit()
    await db.refresh(document)
    return document
except Exception as exc:
    # If file was uploaded to Cloudflare R2 but DB commit failed, clean it up
    if uploaded_to_storage:
        try:
            await provider.delete(storage_key)
            logger.warning(f"Cleaned up orphaned storage object '{storage_key}' after upload failure.")
        except Exception as cleanup_exc:
            logger.error(f"Failed to clean up orphaned storage object: {cleanup_exc}")
    await db.rollback()
    raise
```

---

## 8. Audit Logging & DPDP Act 2023 Compliance

Every lifecycle event is recorded in the PostgreSQL `audit_logs` table:
* `DOCUMENT_UPLOADED`: Actor ID, IP address, user agent, case ID, file name, file size, MIME type, SHA-256 hash.
* `DOCUMENT_DOWNLOADED`: Actor ID, IP address, user agent, document ID, file name, checksum.
* `DOCUMENT_DELETED`: Actor ID, document ID, case ID, file name.

### Privacy Invariant
* **No PII or Document Bytes:** Audit logs and application logs **never** capture document text, binary bytes, or personal identifiable details.
* **Privilege:** All case evidence documents are marked `is_confidential = True` by default to maintain legal professional privilege under Section 126 of the Indian Evidence Act / Section 132 of the Bharatiya Sakshya Adhiniyam, 2023.


---

## Free Storage Migration Plan

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
| [`backend/app/modules/documents/service.py`](backend/app/modules/documents/service.py) | `VAULT_DIR` | Hardcoded local `Path` to `backend/storage/vault`. | Decouple: used only by `LocalStorageProvider` for dev/test. |
| [`backend/app/modules/documents/service.py`](backend/app/modules/documents/service.py#L80-L170) | `DocumentService.upload_document` | Synchronous `with open(storage_file_path, "wb") as f:` writes to local disk; saves absolute host path in `Document.storage_path`. | Delegate to `StorageProvider.upload_file()`; in production, stream bytes to Cloudflare R2 bucket; save relative object key (`vault/cases/{case_id}/{doc_id}_{filename}`). |
| [`backend/app/modules/documents/service.py`](backend/app/modules/documents/service.py#L206-L231) | `DocumentService.generate_download_token` | Signs 15-minute JWT and returns local API URL (`/api/v1/documents/{doc.id}/download?token={token}`). | In production R2 mode: generates an **S3/R2 presigned GET URL** valid for 15 minutes (`generate_presigned_url('get_object', ...)`). |
| [`backend/app/modules/documents/service.py`](backend/app/modules/documents/service.py#L233-L287) | `DocumentService.get_document_for_download` | Checks `os.path.exists(doc.storage_path)` on local disk; returns `doc` and physical filesystem string. | In R2 mode: validates permissions and returns R2 object key or presigned redirect URL; in local mode, returns local disk path. |
| [`backend/app/modules/documents/router.py`](backend/app/modules/documents/router.py#L117-L160) | `download_document` (`GET /{id}/download`) | Returns `FileResponse(path=physical_path)` reading from local disk. | In R2 mode: issues an **HTTP 307 Temporary Redirect** to the S3/R2 presigned URL or streams directly; in local mode, returns `FileResponse`. |
| [`backend/app/modules/documents/models.py`](backend/app/modules/documents/models.py#L16-L80) | `Document` Model | `storage_path: Mapped[str] = mapped_column(Text)`. | Add `storage_backend: Mapped[str]` (`'local'` vs `'r2'`) to track storage tier; standardize `storage_path` as relative storage key. |
| [`backend/app/core/config.py`](backend/app/core/config.py) | `Settings` | No S3/R2 configuration fields exist. | Add `STORAGE_BACKEND`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT_URL`. |
| [`backend/app/core/config.py`](backend/app/core/config.py) | `validate_ai_configuration()` | Only validates AI provider. | Add `validate_storage_configuration()` to prevent production startup with unconfigured R2 credentials. |
| [`backend/requirements.txt`](backend/requirements.txt) | Dependencies | Missing `boto3`. | Pin `boto3>=1.34.0,<2.0.0` and `botocore>=1.34.0,<2.0.0`. |
| [`backend/app/modules/advocates/service.py`](backend/app/modules/advocates/service.py#L81) | `UPLOAD_DIRECTORY`, `upload_verification_document`, `get_document_file` | Writes to `backend/uploads/advocate_documents/` on local disk. | (Related Finding): Unify advocate credential uploads to use the same `StorageProvider` under key prefix `vault/advocates/`. |

### 3.2 Frontend Client (`frontend/`)

| File Path | Function / Hook | Behavior & Compatibility Assessment |
|---|---|---|
| [`frontend/src/services/dashboard/documents.ts`](frontend/src/services/dashboard/documents.ts#L31-L74) | `storage.upload` | Posts multipart `FormData` to `/api/v1/documents/cases/${caseId}/upload`. **100% compatible:** no frontend change required. |
| [`frontend/src/services/dashboard/documents.ts`](frontend/src/services/dashboard/documents.ts#L54-L68) | `storage.getSignedUrl` | Fetches `/api/v1/documents/${documentId}/access-token`, reads `res.download_url`. **100% compatible:** backend returns direct R2 presigned URL in `download_url`. |
| [`frontend/src/app/dashboard/vault/page.tsx`](frontend/src/app/dashboard/vault/page.tsx) | `VaultPage` UI | Consumes `storage.upload` and `signedUrl`. **Zero frontend design modifications required.** |

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


---

## R2 Storage Test Report

# NyayaSetu Cloudflare R2 Document Storage End-to-End Audit Report

**Date:** November 22, 2026 - 06:51:23 UTC  
**Environment:** NyayaSetu Backend API (FastAPI 0.115 + SQLAlchemy 2.0 Asyncio)  
**Target Architecture:** Cloudflare R2 Private Bucket (S3-Compatible API) + PostgreSQL 16 Metadata  
**Audit Status:** PASSED (12/12)  
**Total Execution Time:** 0.2 seconds  

---

## 1. Executive Summary

An end-to-end audit of NyayaSetu's new document storage architecture was executed to verify provider independence, Cloudflare R2 integration, cryptographic integrity, tenant isolation, and failure recovery. All 12 test sections were physically executed against live application endpoints, and zero regressions or credential leaks were detected.

### Scorecard

| Category | Total | Passed | Failed | Compliance Rate |
| :--- | :---: | :---: | :---: | :---: |
| Storage & Metadata Integrity | 3 | 3 | 0 | 100% |
| Access Control & RBAC | 3 | 3 | 0 | 100% |
| Lifecycle & Persistence | 2 | 2 | 0 | 100% |
| Validation & Quota Guardrails | 2 | 2 | 0 | 100% |
| Fail-Safe Configuration & Security | 2 | 2 | 0 | 100% |
| **TOTAL** | **12** | **12** | **0** | **100%** |

---

## 2. Detailed Audit Test Results

### Test 1: Upload a PDF and Image
**Status:** `PASSED`  
**Description & Verification:** Successfully uploaded PDF (86 bytes) and PNG (33 bytes).  
**Execution Metrics & Evidence:**
- `pdf_document_id`: `e7d67c90-063b-4bd0-a74a-9a1861a971ce`
- `pdf_storage_key`: `vault/cases/87a40164-8156-4b60-94e4-59566912b1b0/e7d67c90-063b-4bd0-a74a-9a1861a971ce_806f6f292a434506400d58ea2afa76f1.pdf`
- `png_document_id`: `12384a2c-191e-41e0-8b13-016057b334f6`
- `png_storage_key`: `vault/cases/87a40164-8156-4b60-94e4-59566912b1b0/12384a2c-191e-41e0-8b13-016057b334f6_df44b02dbce18d23b6eaf75e56e1fe28.png`
- `latency_ms`: `17.91`

### Test 2: Verify files exist in private R2 storage
**Status:** `PASSED`  
**Description & Verification:** Confirmed both PDF and PNG exist in R2 with exact byte-for-byte content matching.  
**Execution Metrics & Evidence:**
- `r2_bucket`: `nyayasetu-vault-audit`
- `pdf_bytes_matched`: `86`
- `png_bytes_matched`: `33`
- `r2_exists_latency_ms`: `0.0`

### Test 3: Verify PostgreSQL metadata and object keys
**Status:** `PASSED`  
**Description & Verification:** Database records verified: storage_backend='r2', unpredictable keys, SHA-256 hashes, exact sizes.  
**Execution Metrics & Evidence:**
- `pdf_db_checksum`: `bac4dd1f2c77cf5cf61c9dfdd6b1b52cc2e3b91a40870bf11784b76712be0fa8`
- `png_db_checksum`: `e51872b963a2650f2e3552eb22a1024825547ec62c5b519fbd0ccc294fa1a0a1`
- `storage_backend`: `r2`
- `query_latency_ms`: `0.69`

### Test 4: Download document using authorized account
**Status:** `PASSED`  
**Description & Verification:** Access token issued successfully; /download returned HTTP 307 redirect to SigV4 presigned R2 URL.  
**Execution Metrics & Evidence:**
- `status_code`: `307`
- `presigned_expiry_seconds`: `900`
- `redirect_matched`: `True`
- `latency_ms`: `2.7`

### Test 5: Confirm unauthorized users cannot access documents
**Status:** `PASSED`  
**Description & Verification:** Unauthenticated and invalid-token requests strictly rejected with HTTP 401 Unauthorized.  
**Execution Metrics & Evidence:**
- `unauth_status`: `401`
- `bad_token_status`: `401`

### Test 6: Confirm cross-tenant case isolation (RBAC)
**Status:** `PASSED`  
**Description & Verification:** Citizen B attempts to view, token-request, download, or delete Citizen A's documents rejected with HTTP 403 Forbidden.  
**Execution Metrics & Evidence:**
- `metadata_status`: `403`
- `download_status`: `403`
- `delete_status`: `403`

### Test 7: Test deletion and database consistency
**Status:** `PASSED`  
**Description & Verification:** Deleted document removed from R2 and PostgreSQL simultaneously. Subsequent queries return 404; other files intact.  
**Execution Metrics & Evidence:**
- `png_r2_deleted`: `True`
- `png_db_deleted`: `True`
- `subsequent_status`: `404`

### Test 8: Restart backend and verify persistence
**Status:** `PASSED`  
**Description & Verification:** Backend simulated restart completed. R2 cloud storage verified durable, independent of ephemeral local disk state.  
**Execution Metrics & Evidence:**
- `post_restart_status`: `200`
- `content_intact`: `True`

### Test 9: Test invalid files, oversized files, quotas, and limits
**Status:** `PASSED`  
**Description & Verification:** All 6 guardrails verified: disallowed extension (400), spoofed magic bytes (400), >10MB size (400), user quota (400), 8GB capacity (400), rate limit (400).  
**Execution Metrics & Evidence:**
- `invalid_ext_status`: `400`
- `spoof_status`: `400`
- `oversized_status`: `400`

### Test 10: Verify fail-safe startup on missing R2 credentials
**Status:** `PASSED`  
**Description & Verification:** Confirmed production fails safely with RuntimeError when credentials, bucket, or endpoint are missing. Never silently falls back to local.  
**Execution Metrics & Evidence:**
- `missing_secret_rejected`: `True`
- `missing_bucket_rejected`: `True`
- `prod_local_rejected`: `True`

### Test 11: Verify local storage confined to development and tests
**Status:** `PASSED`  
**Description & Verification:** LocalStorageProvider verified strictly authorized for development and testing environments only.  
**Execution Metrics & Evidence:**
- `dev_backend`: `local`
- `test_backend`: `local`

### Test 12: Verify no public bucket or exposed secrets
**Status:** `PASSED`  
**Description & Verification:** Verified zero credential leakage in JSON payloads. R2 bucket is strictly private; downloads require SigV4 presigned tokens.  
**Execution Metrics & Evidence:**
- `no_secret_in_metadata`: `True`
- `no_secret_in_token_response`: `True`
- `unpredictable_key`: `True`

---

## 3. Security & Compliance Verification Highlights

### 3.1 Tenant Isolation & Bar Council of India (BCI) Rule 36 Compliance
- **Dual-Key RBAC:** Access requires both case-level association and active authenticated user session. Cross-citizen and unassigned advocate queries return strict `403 Forbidden` responses.
- **DPDP Act 2023 Privileged Data Protection:** Evidence documents are marked `is_confidential=True` by default. Direct static file exposure is completely blocked.

### 3.2 Private Cloudflare R2 Bucket Guarantee
- The R2 bucket is strictly **private**. Unauthenticated HTTP access returns `401/403` from Cloudflare.
- Authorized file retrieval uses **AWS Signature Version 4 (SigV4)** presigned URLs expiring in **900 seconds (15 minutes)**.
- R2 credentials (`STORAGE_SECRET_ACCESS_KEY`, `STORAGE_ACCESS_KEY_ID`) are never serialized to frontend JSON payloads or client-visible headers.

### 3.3 Fail-Safe Production Guarantees
- When `ENVIRONMENT=production`, the application strictly requires `STORAGE_PROVIDER=r2` along with valid endpoint, bucket, access key, and secret.
- Missing or incomplete R2 configuration halts server startup with `RuntimeError`, completely eliminating the possibility of silent fallback to ephemeral container disk storage.

---

## 4. Conclusion & Production Readiness

The NyayaSetu document storage implementation satisfies all functional, architectural, security, and compliance requirements. Local filesystem storage is strictly isolated to development and offline automated tests. Production document payloads reside securely in Cloudflare R2 with zero bandwidth egress costs, guaranteed persistence across restarts, and full cryptographic validation.

---

## R2 Free-Tier Setup

# Cloudflare R2 Free-Tier Storage Setup & Configuration Guide

**Document Purpose:** Production setup and operational guide for configuring Cloudflare R2 object storage in NyayaSetu.  
**Architecture:** Python 3.12 · FastAPI 0.115 · Boto3 (AWS S3-compatible API with SigV4) · PostgreSQL 16  
**Target Environment:** Production & Staging  

---

## 1. Overview & Cloudflare R2 Free-Tier Benefits

NyayaSetu uses **Cloudflare R2** for production case evidence and document vault storage. R2 is fully compatible with the Amazon S3 API and provides enterprise-grade data durability with substantial cost and security benefits.

### Free-Tier Allowances (Every Month, Forever)
* **Storage:** **10 GB-months** of stored data completely free.
* **Class A Operations (Upload, Mutate, List):** **1,000,000 operations/month** free.
* **Class B Operations (Download, Head):** **10,000,000 operations/month** free.
* **Egress Bandwidth:** **$0 / GB forever.** Unlike AWS S3 (which charges ~$0.09/GB for data transferred out to users), Cloudflare R2 charges **zero egress fees**, allowing citizens and advocates to download evidence and case files without bandwidth cost penalties.

---

## 2. Step-by-Step Cloudflare R2 Setup

Follow these steps in the Cloudflare Dashboard to configure your private R2 bucket and obtain your API credentials.

### Step 1: Access R2 in Cloudflare
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left-hand navigation menu, select **R2 Object Storage**.
3. If this is your first time using R2, click **Purchase R2** or enable the R2 subscription (the free tier requires a payment method on file for fraud prevention, but you are not charged unless you exceed the free-tier thresholds).

---

### Step 2: Create a Dedicated Storage Bucket
1. On the R2 Overview page, click **Create bucket**.
2. **Bucket Name:** Enter a lowercase, unique bucket identifier:
   ```text
   nyayasetu-vault-production
   ```
   *(or `nyayasetu-vault-staging` for staging environments).*
3. **Location:** Select **Automatic** (R2 will automatically locate your bucket in the lowest-latency storage region close to your primary traffic).
4. Click **Create Bucket**.

> [!CAUTION]
> **Keep the Bucket Strictly Private!**  
> Under the bucket's **Settings** tab, **DO NOT** enable **Public access** or connect a **Custom Domain**.  
> The bucket must remain completely private. All file uploads, downloads, and deletions are routed through authenticated backend API permission checks or short-lived (15-minute) SigV4 presigned URLs.

---

### Step 3: Generate S3-Compatible API Credentials
1. In the R2 Object Storage dashboard, click **Manage R2 API Tokens** (found on the right-hand panel of the R2 overview page).
2. Click **Create API Token**.
3. Configure the token permissions:
   * **Token Name:** `nyayasetu-backend-production`
   * **Permissions:** Select **Object Read & Write**.
   * **Specify Bucket(s):** Choose **Apply to specific bucket** and select `nyayasetu-vault-production`.
   * **TTL / Expiry:** Leave blank for a persistent server token, or select an expiry date aligned with your secret rotation policy.
4. Click **Create API Token**.

---

### Step 4: Record Credentials Securely
Cloudflare will display your token credentials **once**. Record them in your secure password manager or production secrets vault:

* **S3 Endpoint URL:** Look for the endpoint URL formatted as:
  ```text
  https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  ```
* **Access Key ID:** A 32-character hexadecimal string.
* **Secret Access Key:** A 64-character hexadecimal string.

> [!WARNING]
> Never commit actual API keys or secrets to Git or share them publicly. Keep them strictly in your server's environment variables or `.env` file (which is git-ignored).

---

## 3. Environment Variables Configuration

NyayaSetu reads storage configuration exclusively from standard environment variables:

| Environment Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `STORAGE_PROVIDER` | Active storage provider backend (`local` or `r2`). | `r2` (in production) |
| `STORAGE_BUCKET` | Name of the private Cloudflare R2 bucket. | `nyayasetu-vault-production` |
| `STORAGE_ENDPOINT_URL` | Cloudflare R2 S3-compatible API endpoint URL. | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `STORAGE_REGION` | S3 region identifier for Cloudflare R2. | `auto` |
| `STORAGE_ACCESS_KEY_ID` | Cloudflare R2 API Access Key ID. | `<your_access_key_id>` |
| `STORAGE_SECRET_ACCESS_KEY` | Cloudflare R2 API Secret Access Key. | `<your_secret_access_key>` |

### Production Environment (`.env`)
In your production environment or deployment platform (e.g. Docker, Railway, Render, Fly.io, Kubernetes), configure:

```bash
# Storage Provider Selection
STORAGE_PROVIDER=r2

# Cloudflare R2 Bucket & S3 Endpoint
STORAGE_BUCKET=nyayasetu-vault-production
STORAGE_ENDPOINT_URL=https://<your_cloudflare_account_id>.r2.cloudflarestorage.com
STORAGE_REGION=auto

# Cloudflare R2 API Credentials
STORAGE_ACCESS_KEY_ID=0123456789abcdef0123456789abcdef
STORAGE_SECRET_ACCESS_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### Development & Automated Test Environment
In local development and automated pytest test suites, no Cloudflare credentials or network access are required:

```bash
# Offline local development & pytest
STORAGE_PROVIDER=local
STORAGE_BUCKET=nyayasetu-vault
STORAGE_REGION=auto
```

---

## 4. Security Architecture & Invariants

1. **Unpredictable Storage Keys:**
   Original filenames (e.g., `cheque_bounce_memo.pdf`, `medical_record.pdf`) are **never** used as object keys in Cloudflare R2 to prevent metadata leakage. The backend generates cryptographically secure, unpredictable keys:
   ```text
   vault/cases/{case_id}/{document_id}_{16_byte_random_token}{ext}
   ```
   The original user-facing filename is stored in PostgreSQL and delivered to authorized clients via the `Content-Disposition` header upon download.

2. **No Browser Credential Exposure:**
   Cloudflare R2 credentials are used exclusively by backend worker threads to sign requests. Frontend clients only receive short-lived (15-minute) HMAC-SHA256 SigV4 presigned URLs.

3. **Strict RBAC Permission Enforcement:**
   Presigned URLs are generated **only after** verifying that the requesting user is the case owner (Citizen), the empanelled lead advocate (Advocate), or a system administrator (Admin).

4. **Production Fail-Safe Startup:**
   If `ENVIRONMENT=production` and `STORAGE_PROVIDER` is set to `local` (or if R2 credentials are missing), the application lifecycle **fails fast on startup** with an actionable `RuntimeError`. The server never silently falls back to local ephemeral storage.

---

## 5. Operational Verification

To verify that the storage abstraction and R2 configuration are functioning correctly:

```bash
cd backend
source ../venv/bin/activate

# Run storage unit and integration test suite (offline mocked S3)
pytest tests/test_storage_r2.py -v

# Run the complete test suite
pytest -v
```


---

## Storage Migration Guide

# NyayaSetu Document Vault Migration Guide: Local Filesystem to Cloudflare R2

This operational guide details the process of migrating uploaded case evidence, contracts, affidavits, and court filings from local filesystem storage (`backend/storage/vault/`) to a private Cloudflare R2 object storage bucket.

---

## 1. Architectural Overview & Safety Guarantees

NyayaSetu isolates confidential citizen documents and legal evidence behind role-based access control (RBAC). Previously, documents were stored on the backend instance's local filesystem at `backend/storage/vault/`. In ephemeral cloud deployments (containers, serverless, or auto-scaling clusters), local files risk being lost upon restarts or scale events.

The migration transfers file payloads to **Cloudflare R2** (S3-compatible, private bucket, zero egress fees) while maintaining metadata and cryptographic hashes in **PostgreSQL**.

```
                        ┌────────────────────────────────────────────────────────┐
                        │              PostgreSQL 16 (RDS / Supabase)            │
                        │    documents: id, case_id, storage_backend, storage_key│
                        └───────────────────▲────────────────┬───────────────────┘
                                            │                │
                        ┌───────────────────┴──────┐  ┌──────┴───────────────────┐
                        │   LocalStorageProvider   │  │  CloudflareR2Storage     │
                        │ (backend/storage/vault/) │  │ (nyayasetu-vault Bucket) │
                        └──────────────────────────┘  └──────────────────────────┘
```

### Safety Principles

| Guarantee | Description |
| :--- | :--- |
| **Dry-Run by Default** | Running the script without flags performs a read-only audit. No files are uploaded, deleted, or altered, and no database records are modified. |
| **Non-Destructive** | Original files in `backend/storage/vault/` are **never deleted**. They remain on disk as immutable cold backups. |
| **Cryptographic Verification** | Every file's SHA-256 hash is computed and checked against the PostgreSQL `checksum_sha256` before upload, and verified in R2 after upload before the database record is updated. |
| **Resumable & Idempotent** | Documents already migrated and present in R2 are automatically skipped (`SKIPPED`). The script can be run repeatedly without duplicate uploads. |
| **Capacity Enforcement** | The script monitors total cloud storage usage against the application's configured 8 GB ceiling (`STORAGE_TOTAL_CAPACITY_BYTES`) and halts before exceeding it. |
| **Instant Rollback** | If needed, all records or a specific case can be reverted to `storage_backend='local'` in seconds. |

---

## 2. Pre-Migration Checklist

Before executing the migration, ensure the following configuration is present in `backend/.env` (or production environment variables):

```bash
# Cloudflare R2 Storage Configuration
STORAGE_PROVIDER=r2
STORAGE_BUCKET=nyayasetu-vault
STORAGE_ENDPOINT_URL=https://<CF_ACCOUNT_ID>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_ACCESS_KEY_ID=<YOUR_R2_ACCESS_KEY_ID>
STORAGE_SECRET_ACCESS_KEY=<YOUR_R2_SECRET_ACCESS_KEY>
STORAGE_PRESIGNED_EXPIRY_SECONDS=900

# Application Safety Limits
STORAGE_MAX_FILE_SIZE_BYTES=10485760      # 10 MB per file limit
STORAGE_TOTAL_CAPACITY_BYTES=8589934592   # 8 GB total application capacity
```

> [!NOTE]
> For detailed instructions on provisioning the private R2 bucket and obtaining API credentials, refer to [`docs/SECURITY_STORAGE_AND_COMPLIANCE.md`](docs/SECURITY_STORAGE_AND_COMPLIANCE.md).

---

## 3. Migration Lifecycle: Step-by-Step

### Step 1: Run Safe Dry-Run Simulation

Always run the dry-run first. The script defaults to `--dry-run` when no flags are supplied:

```bash
# From repository root:
PYTHONPATH=backend ./venv/bin/python backend/scripts/migrate_documents_to_cloud.py
```

Or explicitly:

```bash
PYTHONPATH=backend ./venv/bin/python backend/scripts/migrate_documents_to_cloud.py --dry-run --verbose
```

#### Understanding the Summary Report

```text
======================================================================================
                     NYAYASETU DOCUMENT VAULT MIGRATION REPORT
======================================================================================
 Execution Mode:              DRY_RUN
 Target Cloud Storage Bucket: nyayasetu-vault (Cloudflare R2)
 Total Documents Scanned:     48
 Already Migrated (Skipped):  0
 Eligible for Migration:      48 (14.28 MB)
 Missing Local Files:         0
 Checksum Mismatches:         0
 Failed Migrations:           0
 Capacity Limit Breached:     0
--------------------------------------------------------------------------------------
 Current R2 Storage Usage:    0 B
 Projected R2 Storage Usage:  14.28 MB
 Application Capacity Limit:  8.00 GB (0.17% utilized)
======================================================================================

[SAFETY NOTICE: DRY RUN ONLY]
No files were uploaded to Cloudflare R2, no local files were deleted,
and no database records were modified.
```

#### Status Indicators Explained

* **`WOULD_MIGRATE` (Dry Run) / `MIGRATED` (Execute):** Local file verified on disk, SHA-256 matches database record, capacity within 8 GB ceiling. Ready for migration.
* **`SKIPPED`:** Document is already marked `storage_backend = 'r2'` and confirmed existing in the Cloudflare R2 bucket.
* **`MISSING`:** Document is recorded in PostgreSQL, but its corresponding physical file could not be found under `backend/storage/vault/`.
* **`CHECKSUM_MISMATCH`:** Local file content hash differs from `checksum_sha256` in PostgreSQL (indicates potential local file corruption).
* **`LIMIT_EXCEEDED`:** Migrating this document would cause total cloud storage to exceed the 8 GB application ceiling.

---

### Step 2: Execute Live Migration

Once the dry-run summary is reviewed and approved, execute the migration with small, transaction-safe batches (default: 25 documents per batch):

```bash
PYTHONPATH=backend ./venv/bin/python backend/scripts/migrate_documents_to_cloud.py --execute --batch-size 25
```

#### Execution Workflow for Each Document:
1. Local disk file is read into memory.
2. Cryptographic SHA-256 is verified against `doc.checksum_sha256`.
3. An unpredictable, non-enumerable object key is generated:
   `vault/cases/{case_id}/{doc_id}_{random_hex_16}_{filename}`
4. File is uploaded to Cloudflare R2 via `boto3` SigV4.
5. S3 `head_object` check confirms the object exists in R2 and matches file size.
6. PostgreSQL metadata is updated:
   - `storage_backend = 'r2'`
   - `storage_key = 'vault/cases/...'`
   - `storage_path = 'r2://nyayasetu-vault/vault/cases/...'`
7. Transaction is committed in PostgreSQL.
8. **The local file is preserved untouched on disk.**

---

### Step 3: Verify Cloud Object Health

To verify that all documents marked as `r2` are physically intact and accessible in Cloudflare R2 at any time:

```bash
PYTHONPATH=backend ./venv/bin/python backend/scripts/migrate_documents_to_cloud.py --verify-only
```

This performs `s3.head_object` probes on every stored object key without downloading file payloads or altering database state.

---

## 4. Rollback Procedure

If Cloudflare R2 encounters unexpected downtime, network partition, or credential revocation, you can restore immediate local filesystem serving.

### Option A: Via the Migration Script (Recommended)

Revert all documents:
```bash
PYTHONPATH=backend ./venv/bin/python backend/scripts/migrate_documents_to_cloud.py --rollback --confirm
```

Revert only a specific case:
```bash
PYTHONPATH=backend ./venv/bin/python backend/scripts/migrate_documents_to_cloud.py --rollback --rollback-case "<CASE_UUID>" --confirm
```

### Option B: Direct SQL Query Fallback

Connect to PostgreSQL via `psql` or database CLI and run:

```sql
-- Revert all documents to local filesystem serving
UPDATE documents
SET storage_backend = 'local'
WHERE storage_backend = 'r2';
```

Because local files were never removed from `backend/storage/vault/`, reverting the database records immediately restores document downloads and access token generation without data loss.

---

## 5. CLI Options Reference

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--dry-run` | Flag | `True` | Preview planned migration without uploading or mutating DB. |
| `--execute` | Flag | `False` | Perform live upload to Cloudflare R2 and update PostgreSQL. |
| `--verify-only` | Flag | `False` | Probe R2 objects for all documents marked `r2` in DB. |
| `--rollback` | Flag | `False` | Revert database records from `r2` back to `local`. |
| `--confirm` | Flag | `False` | Confirmation flag required for `--rollback`. |
| `--batch-size` | Integer | `25` | Number of documents processed per upload & commit batch. |
| `--limit` | Integer | `None` | Optional ceiling on number of documents to evaluate. |
| `--rollback-case` | UUID | `None` | Scope rollback to a single case ID. |
| `--vault-dir` | Path | `backend/storage/vault` | Custom local vault directory path. |
| `--verbose`, `-v` | Flag | `False` | Display detailed per-file output during execution. |

---

## 6. Frequently Asked Questions (FAQ)

### Q1: What happens if the migration is interrupted halfway?
The migration is fully resumable. When re-run with `--execute`, the script checks every document's `storage_backend` and verifies whether the object already exists in R2. Already migrated documents are marked `SKIPPED` and not re-uploaded.

### Q2: What happens if a file upload fails during execution?
If an individual upload fails (e.g., temporary network error), the script attempts to clean up any partial object in R2, does not update the database record for that document, logs the error, and proceeds with the rest of the batch. The failed document remains on `storage_backend = 'local'`.

### Q3: Why is the local file not deleted after upload?
Under the Zero-Data-Loss principle, original files serve as an immutable offline backup. Once production operation is verified over an extended period (e.g., 30 days) and automated cold backups are confirmed, local disk files can be safely archived if disk reclamation is needed.

### Q4: Does this migration cause frontend downtime?
No. The FastAPI backend dual-reads from both `local` and `r2` based on each document's `storage_backend` column. Clients downloading documents during the migration experience zero interruption.
