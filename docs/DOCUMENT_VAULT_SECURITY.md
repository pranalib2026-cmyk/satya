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
