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
> For detailed instructions on provisioning the private R2 bucket and obtaining API credentials, refer to [`docs/R2_FREE_TIER_SETUP.md`](file:///Users/yashodhan/Documents/Projects/NyayaSetu/docs/R2_FREE_TIER_SETUP.md).

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
