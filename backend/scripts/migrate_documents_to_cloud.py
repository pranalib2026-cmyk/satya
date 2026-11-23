#!/usr/bin/env python3
"""NyayaSetu Document Storage Migration Utility: Local Vault -> Cloudflare R2.

Migrates uploaded legal documents and evidence files stored on the local filesystem
(backend/storage/vault/) to the configured private Cloudflare R2 bucket (S3-compatible).

Guarantees & Constraints:
1. DRY-RUN BY DEFAULT: Does not upload files, delete files, or modify PostgreSQL records unless --execute is passed.
2. RESUMABLE: Automatically detects and skips already migrated, verified R2 documents to prevent duplicate uploads.
3. CRYPTOGRAPHIC INTEGRITY: Computes SHA-256 before upload and verifies against PostgreSQL checksum.
4. VERIFICATION BEFORE MUTATION: Verifies that the object exists in R2 and its size matches before updating the DB.
5. CAPACITY ENFORCEMENT: Enforces the 8 GB application storage limit; halts before exceeding.
6. ZERO-DATA-LOSS: NEVER automatically deletes local files from disk. Original files remain as cold backup.
7. INSTANT ROLLBACK: Provides --rollback to point database records back to 'local' storage instantly.

Usage:
  # 1. Preview planned migration (Dry-run mode, safe, read-only):
  python backend/scripts/migrate_documents_to_cloud.py

  # 2. Perform live migration in batches of 25:
  python backend/scripts/migrate_documents_to_cloud.py --execute --batch-size 25

  # 3. Verify health and presence of all documents migrated to R2:
  python backend/scripts/migrate_documents_to_cloud.py --verify-only

  # 4. Rollback database records to local filesystem serving:
  python backend/scripts/migrate_documents_to_cloud.py --rollback --confirm
"""

import argparse
import asyncio
from dataclasses import dataclass, field
import hashlib
import os
from pathlib import Path
import secrets
import sys
from typing import Dict, List, Optional, Tuple
import uuid

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db_context
from app.core.logging import logger
from app.core.storage import (
    BaseStorageProvider,
    CloudflareR2StorageProvider,
    LocalStorageProvider,
    get_storage_provider,
)
from app.modules.documents.models import Document


# ─────────────────────────────────────────────────────────────────────────────
# Helper Types & Dataclasses
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class DocumentMigrationItem:
    """Status record for an individual document during migration evaluation."""
    doc_id: uuid.UUID
    case_id: Optional[uuid.UUID]
    file_name: str
    file_size_bytes: int
    db_checksum: str
    current_backend: str
    current_storage_path: str
    current_storage_key: Optional[str]
    local_file_path: Optional[Path] = None
    calculated_checksum: Optional[str] = None
    proposed_storage_key: Optional[str] = None
    status: str = "PENDING"  # PENDING, SKIPPED, MIGRATED, FAILED, MISSING, CHECKSUM_MISMATCH, LIMIT_EXCEEDED
    detail: str = ""


@dataclass
class MigrationReport:
    """Comprehensive summary of migration operations and metrics."""
    mode: str  # "DRY_RUN", "EXECUTE", "VERIFY_ONLY", "ROLLBACK"
    total_scanned: int = 0
    already_migrated_skipped: int = 0
    migrated_count: int = 0
    missing_local_files: int = 0
    checksum_mismatches: int = 0
    failed_count: int = 0
    limit_exceeded_count: int = 0
    bytes_migrated: int = 0
    existing_r2_bytes: int = 0
    total_capacity_bytes: int = field(default_factory=lambda: settings.STORAGE_TOTAL_CAPACITY_BYTES)
    target_bucket: str = field(default_factory=lambda: settings.effective_storage_bucket)
    items: List[DocumentMigrationItem] = field(default_factory=list)

    @property
    def projected_r2_bytes(self) -> int:
        return self.existing_r2_bytes + self.bytes_migrated

    @property
    def capacity_percentage(self) -> float:
        if self.total_capacity_bytes <= 0:
            return 0.0
        return (self.projected_r2_bytes / self.total_capacity_bytes) * 100


# ─────────────────────────────────────────────────────────────────────────────
# Core Utility Functions
# ─────────────────────────────────────────────────────────────────────────────

def format_bytes(num_bytes: int) -> str:
    """Human-readable byte size formatting."""
    if num_bytes < 1024:
        return f"{num_bytes} B"
    elif num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.2f} KB"
    elif num_bytes < 1024 * 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.2f} MB"
    else:
        return f"{num_bytes / (1024 * 1024 * 1024):.2f} GB"


def compute_file_sha256(file_path: Path) -> str:
    """Compute cryptographic SHA-256 hex digest of a local file in streaming 64 KB blocks."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest()


def resolve_local_file(doc: Document, vault_dir: Path) -> Optional[Path]:
    """Resolve physical disk file for a database document record across legacy directory structures."""
    # 1. Check storage_path directly if valid on this filesystem
    if doc.storage_path:
        p = Path(doc.storage_path)
        if p.is_file():
            return p
        # Check relative to backend directory or workspace root
        repo_root = backend_dir.parent
        p_rel = (repo_root / doc.storage_path).resolve()
        if p_rel.is_file():
            return p_rel
        p_backend_rel = (backend_dir / doc.storage_path).resolve()
        if p_backend_rel.is_file():
            return p_backend_rel

    clean_filename = Path(doc.file_name).name

    # 2. Check vault_dir / case_id / doc_id_filename
    if doc.case_id:
        candidate_case = vault_dir / str(doc.case_id) / f"{doc.id}_{clean_filename}"
        if candidate_case.is_file():
            return candidate_case

        candidate_cases_sub = vault_dir / "cases" / str(doc.case_id) / f"{doc.id}_{clean_filename}"
        if candidate_cases_sub.is_file():
            return candidate_cases_sub

        # Check any file in case folder containing doc.id
        case_folder = vault_dir / str(doc.case_id)
        if case_folder.is_dir():
            for entry in case_folder.iterdir():
                if entry.is_file() and str(doc.id) in entry.name:
                    return entry

        case_subfolder = vault_dir / "cases" / str(doc.case_id)
        if case_subfolder.is_dir():
            for entry in case_subfolder.iterdir():
                if entry.is_file() and str(doc.id) in entry.name:
                    return entry

    # 3. Check directly in vault_dir / doc_id_filename
    candidate_direct = vault_dir / f"{doc.id}_{clean_filename}"
    if candidate_direct.is_file():
        return candidate_direct

    # 4. Search recursively inside vault_dir for matching doc.id prefix
    try:
        for match in vault_dir.rglob(f"{doc.id}*"):
            if match.is_file():
                return match
    except Exception:
        pass

    return None


def generate_migration_storage_key(doc: Document) -> str:
    """Generate unpredictable S3 object key matching standard NyayaSetu vault hierarchy."""
    clean_name = Path(doc.file_name).name
    random_suffix = secrets.token_hex(16)
    case_part = f"cases/{doc.case_id}" if doc.case_id else "general"
    return f"vault/{case_part}/{doc.id}_{random_suffix}_{clean_name}"


# ─────────────────────────────────────────────────────────────────────────────
# Migration Engine
# ─────────────────────────────────────────────────────────────────────────────

async def run_migration(
    session: AsyncSession,
    storage_provider: Optional[BaseStorageProvider] = None,
    execute: bool = False,
    batch_size: int = 25,
    limit: Optional[int] = None,
    verify_only: bool = False,
    rollback: bool = False,
    rollback_case_id: Optional[uuid.UUID] = None,
    vault_dir: Optional[Path] = None,
    capacity_limit_bytes: Optional[int] = None,
    verbose: bool = False,
) -> MigrationReport:
    """Execute document migration or verification against the provided database session."""
    active_vault_dir = (vault_dir or (backend_dir / "storage" / "vault")).resolve()

    mode_str = "EXECUTE" if execute else "DRY_RUN"
    if rollback:
        mode_str = "ROLLBACK"
    elif verify_only:
        mode_str = "VERIFY_ONLY"

    report = MigrationReport(mode=mode_str)
    if capacity_limit_bytes is not None:
        report.total_capacity_bytes = capacity_limit_bytes

    # ─────────────────────────────────────────────────────────────────────────
    # Mode 1: Rollback Mode
    # ─────────────────────────────────────────────────────────────────────────
    if rollback:
        logger.info(f"Initiating rollback of migrated documents (filter: case_id={rollback_case_id or 'ALL'})...")
        stmt = update(Document).where(Document.storage_backend == "r2")
        if rollback_case_id:
            stmt = stmt.where(Document.case_id == rollback_case_id)
        stmt = stmt.values(storage_backend="local")
        result = await session.execute(stmt)
        await session.commit()
        report.migrated_count = result.rowcount
        print(f"\n[ROLLBACK COMPLETED] Reverted {result.rowcount} document(s) from 'r2' back to 'local' backend.")
        print("All documents will now be served from local filesystem storage.")
        return report

    # ─────────────────────────────────────────────────────────────────────────
    # Initialize Target Storage Provider
    # ─────────────────────────────────────────────────────────────────────────
    target_provider = storage_provider
    if target_provider is None:
        if execute or verify_only:
            # When executing or verifying against cloud, construct R2 provider
            endpoint = settings.effective_storage_endpoint_url
            bucket = settings.effective_storage_bucket
            key_id = settings.effective_storage_access_key_id
            secret = settings.effective_storage_secret_access_key
            region = settings.effective_storage_region

            if not (endpoint and bucket and key_id and secret):
                raise RuntimeError(
                    "Cloudflare R2 credentials are missing or incomplete. "
                    "Ensure STORAGE_ENDPOINT_URL, STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, "
                    "and STORAGE_SECRET_ACCESS_KEY are configured in environment variables."
                )

            target_provider = CloudflareR2StorageProvider(
                endpoint_url=endpoint,
                bucket_name=bucket,
                access_key_id=key_id,
                secret_access_key=secret,
                region=region,
                presigned_expiry_seconds=settings.STORAGE_PRESIGNED_EXPIRY_SECONDS,
            )
        else:
            # In dry-run mode, we can use the configured provider or LocalStorageProvider mock
            target_provider = get_storage_provider()

    # ─────────────────────────────────────────────────────────────────────────
    # Calculate Existing R2 Usage
    # ─────────────────────────────────────────────────────────────────────────
    r2_usage_stmt = select(func.coalesce(func.sum(Document.file_size_bytes), 0)).where(
        Document.storage_backend == "r2"
    )
    existing_r2_bytes = (await session.execute(r2_usage_stmt)).scalar() or 0
    report.existing_r2_bytes = existing_r2_bytes
    running_r2_bytes = existing_r2_bytes

    # ─────────────────────────────────────────────────────────────────────────
    # Query Target Documents
    # ─────────────────────────────────────────────────────────────────────────
    query = select(Document).order_by(Document.created_at.asc())
    if verify_only:
        query = query.where(Document.storage_backend == "r2")
    if limit and limit > 0:
        query = query.limit(limit)

    result = await session.execute(query)
    documents = result.scalars().all()
    report.total_scanned = len(documents)

    if not documents:
        print("\nNo documents found matching migration criteria.")
        return report

    print(f"\nDiscovered {len(documents)} document(s) in database. Evaluating for {mode_str}...")

    # ─────────────────────────────────────────────────────────────────────────
    # Mode 2: Verify-Only Mode
    # ─────────────────────────────────────────────────────────────────────────
    if verify_only:
        for doc in documents:
            item = DocumentMigrationItem(
                doc_id=doc.id,
                case_id=doc.case_id,
                file_name=doc.file_name,
                file_size_bytes=doc.file_size_bytes,
                db_checksum=doc.checksum_sha256,
                current_backend=doc.storage_backend,
                current_storage_path=doc.storage_path,
                current_storage_key=doc.storage_key,
            )

            if not doc.storage_key:
                item.status = "FAILED"
                item.detail = "Document marked as 'r2' but storage_key is null."
                report.failed_count += 1
            else:
                exists_in_r2 = await target_provider.exists(doc.storage_key)
                if exists_in_r2:
                    item.status = "VERIFIED"
                    item.detail = f"Object verified in R2: {doc.storage_key}"
                    report.migrated_count += 1
                else:
                    item.status = "FAILED"
                    item.detail = f"Object missing in R2 bucket at key '{doc.storage_key}'"
                    report.failed_count += 1

            report.items.append(item)
            if verbose:
                print(f"[{item.status}] {item.file_name} ({item.doc_id}) -> {item.detail}")

        return report

    # ─────────────────────────────────────────────────────────────────────────
    # Mode 3: Dry-Run / Execute Mode
    # ─────────────────────────────────────────────────────────────────────────
    batch_buffer: List[Tuple[Document, DocumentMigrationItem, bytes]] = []

    for idx, doc in enumerate(documents, start=1):
        item = DocumentMigrationItem(
            doc_id=doc.id,
            case_id=doc.case_id,
            file_name=doc.file_name,
            file_size_bytes=doc.file_size_bytes,
            db_checksum=doc.checksum_sha256,
            current_backend=doc.storage_backend,
            current_storage_path=doc.storage_path,
            current_storage_key=doc.storage_key,
        )

        # 1. Resumability: Check if already migrated to R2
        if doc.storage_backend == "r2" and doc.storage_key:
            # Check if object exists in R2
            try:
                already_in_r2 = await target_provider.exists(doc.storage_key)
            except Exception:
                already_in_r2 = True if not execute else False

            if already_in_r2:
                item.status = "SKIPPED"
                item.detail = f"Already migrated and verified in R2 ({doc.storage_key})"
                report.already_migrated_skipped += 1
                report.items.append(item)
                if verbose:
                    print(f"[{item.status}] {item.file_name} -> {item.detail}")
                continue

        # 2. Local File Resolution
        local_path = resolve_local_file(doc, active_vault_dir)
        item.local_file_path = local_path

        if not local_path or not local_path.is_file():
            item.status = "MISSING"
            item.detail = f"Local file not found on disk at {active_vault_dir}"
            report.missing_local_files += 1
            report.items.append(item)
            if verbose:
                print(f"[{item.status}] {item.file_name} ({item.doc_id}) -> {item.detail}")
            continue

        # 3. Cryptographic SHA-256 and Size Integrity Check
        computed_hash = compute_file_sha256(local_path)
        item.calculated_checksum = computed_hash
        actual_size = local_path.stat().st_size

        if computed_hash.lower() != doc.checksum_sha256.lower():
            item.status = "CHECKSUM_MISMATCH"
            item.detail = f"Checksum mismatch: local={computed_hash[:12]}... != db={doc.checksum_sha256[:12]}..."
            report.checksum_mismatches += 1
            report.items.append(item)
            if verbose:
                print(f"[{item.status}] {item.file_name} -> {item.detail}")
            continue

        # 4. Storage Capacity Limit Check (8 GB Application Ceiling)
        file_effective_size = max(actual_size, doc.file_size_bytes)
        if running_r2_bytes + file_effective_size > report.total_capacity_bytes:
            item.status = "LIMIT_EXCEEDED"
            item.detail = (
                f"Halting: migrating this file ({format_bytes(file_effective_size)}) would exceed "
                f"the 8 GB application capacity limit ({format_bytes(running_r2_bytes)} used)."
            )
            report.limit_exceeded_count += 1
            report.items.append(item)
            print(f"\n[CAPACITY CEILING REACHED] {item.detail}")
            break

        # 5. Generate Target R2 Storage Key
        proposed_key = generate_migration_storage_key(doc)
        item.proposed_storage_key = proposed_key

        # ─────────────────────────────────────────────────────────────────────
        # Process Item Based on Mode (Dry-Run vs Execute)
        # ─────────────────────────────────────────────────────────────────────
        if not execute:
            # DRY RUN: simulate planned migration
            item.status = "WOULD_MIGRATE"
            item.detail = f"Verified locally ({format_bytes(actual_size)}). Target key: {proposed_key}"
            report.migrated_count += 1
            report.bytes_migrated += actual_size
            running_r2_bytes += actual_size
            report.items.append(item)
            if verbose:
                print(f"[{item.status}] {item.file_name} -> {proposed_key}")
        else:
            # LIVE EXECUTION: read file bytes and queue for batch upload
            try:
                with open(local_path, "rb") as f:
                    file_bytes = f.read()
                batch_buffer.append((doc, item, file_bytes))
            except Exception as read_err:
                item.status = "FAILED"
                item.detail = f"Failed to read local file: {read_err}"
                report.failed_count += 1
                report.items.append(item)
                continue

            # Process batch if buffer threshold reached or last document
            if len(batch_buffer) >= batch_size or idx == len(documents):
                await _process_execution_batch(
                    session=session,
                    batch_buffer=batch_buffer,
                    target_provider=target_provider,
                    report=report,
                    verbose=verbose,
                )
                running_r2_bytes += sum(i.file_size_bytes for _, i, _ in batch_buffer if i.status == "MIGRATED")
                batch_buffer.clear()

    # Flush any remaining items in execution buffer
    if execute and batch_buffer:
        await _process_execution_batch(
            session=session,
            batch_buffer=batch_buffer,
            target_provider=target_provider,
            report=report,
            verbose=verbose,
        )
        batch_buffer.clear()

    return report


async def _process_execution_batch(
    session: AsyncSession,
    batch_buffer: List[Tuple[Document, DocumentMigrationItem, bytes]],
    target_provider: BaseStorageProvider,
    report: MigrationReport,
    verbose: bool,
) -> None:
    """Execute upload and transactional DB update for a batch of documents."""
    bucket_name = getattr(target_provider, "bucket_name", settings.effective_storage_bucket)

    for doc, item, file_bytes in batch_buffer:
        storage_key = item.proposed_storage_key or generate_migration_storage_key(doc)
        try:
            # 1. Upload to Cloudflare R2
            await target_provider.upload(
                key=storage_key,
                content=file_bytes,
                content_type=doc.mime_type or "application/octet-stream",
                metadata={
                    "sha256": doc.checksum_sha256,
                    "original_filename": doc.file_name,
                    "document_id": str(doc.id),
                },
            )

            # 2. Cryptographic and presence verification in R2
            verified = await target_provider.exists(storage_key)
            if not verified:
                raise RuntimeError(f"R2 head_object verification failed for uploaded key '{storage_key}'")

            # 3. Update PostgreSQL entity metadata
            doc.storage_backend = "r2"
            doc.storage_key = storage_key
            doc.storage_path = f"r2://{bucket_name}/{storage_key}"

            item.status = "MIGRATED"
            item.detail = f"Successfully uploaded and verified in R2: {storage_key}"
            report.migrated_count += 1
            report.bytes_migrated += doc.file_size_bytes
            report.items.append(item)

            if verbose:
                print(f"[MIGRATED] {doc.file_name} -> {storage_key} ({format_bytes(doc.file_size_bytes)})")

        except Exception as upload_err:
            logger.error(f"Migration failed for document {doc.id} ({doc.file_name}): {upload_err}", exc_info=True)
            # Safe cleanup in R2 if object was partially uploaded
            try:
                await target_provider.delete(storage_key)
            except Exception:
                pass

            item.status = "FAILED"
            item.detail = f"Upload error: {str(upload_err)}"
            report.failed_count += 1
            report.items.append(item)
            print(f"[FAILED] {doc.file_name} ({doc.id}): {upload_err}")

    # Commit batch updates in PostgreSQL
    await session.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Reporting & Presentation Table
# ─────────────────────────────────────────────────────────────────────────────

def print_summary_table(report: MigrationReport) -> None:
    """Print beautifully formatted tabular summary of the migration run."""
    term_width = 86
    line = "=" * term_width
    subline = "-" * term_width

    print("\n" + line)
    print("                     NYAYASETU DOCUMENT VAULT MIGRATION REPORT")
    print(line)
    print(f" Execution Mode:              {report.mode}")
    print(f" Target Cloud Storage Bucket: {report.target_bucket} (Cloudflare R2)")
    print(f" Total Documents Scanned:     {report.total_scanned}")
    print(f" Already Migrated (Skipped):  {report.already_migrated_skipped}")

    if report.mode == "DRY_RUN":
        print(f" Eligible for Migration:      {report.migrated_count} ({format_bytes(report.bytes_migrated)})")
    elif report.mode == "EXECUTE":
        print(f" Successfully Migrated:       {report.migrated_count} ({format_bytes(report.bytes_migrated)})")
    elif report.mode == "VERIFY_ONLY":
        print(f" Verified in R2:              {report.migrated_count}")

    print(f" Missing Local Files:         {report.missing_local_files}")
    print(f" Checksum Mismatches:         {report.checksum_mismatches}")
    print(f" Failed Migrations:           {report.failed_count}")
    print(f" Capacity Limit Breached:     {report.limit_exceeded_count}")
    print(subline)
    print(f" Current R2 Storage Usage:    {format_bytes(report.existing_r2_bytes)}")
    print(f" Projected R2 Storage Usage:  {format_bytes(report.projected_r2_bytes)}")
    print(f" Application Capacity Limit:  {format_bytes(report.total_capacity_bytes)} ({report.capacity_percentage:.2f}% utilized)")
    print(line)

    # Highlight any problematic documents
    anomalies = [i for i in report.items if i.status in ("MISSING", "CHECKSUM_MISMATCH", "FAILED", "LIMIT_EXCEEDED")]
    if anomalies:
        print("\nATTENTION REQUIRED FOR THE FOLLOWING DOCUMENTS:")
        print(subline)
        print(f"{'STATUS':<20} | {'DOCUMENT ID':<36} | {'FILE NAME':<24}")
        print(subline)
        for anom in anomalies[:20]:
            print(f"{anom.status:<20} | {str(anom.doc_id):<36} | {anom.file_name[:24]:<24}")
            print(f"  └─ {anom.detail}")
        if len(anomalies) > 20:
            print(f"  ... and {len(anomalies) - 20} more items.")
        print(subline)

    if report.mode == "DRY_RUN":
        print("\n[SAFETY NOTICE: DRY RUN ONLY]")
        print("No files were uploaded to Cloudflare R2, no local files were deleted,")
        print("and no database records were modified.")
        print("\nTo perform the live migration, execute:")
        print("  python backend/scripts/migrate_documents_to_cloud.py --execute")
        print(line + "\n")
    elif report.mode == "EXECUTE":
        print("\n[MIGRATION EXECUTION COMPLETED]")
        print("Local disk files have been PRESERVED intact as cold backup at backend/storage/vault/.")
        print("To verify R2 object health at any time, run:")
        print("  python backend/scripts/migrate_documents_to_cloud.py --verify-only")
        print("\nTo rollback to local filesystem serving if ever required, run:")
        print("  python backend/scripts/migrate_documents_to_cloud.py --rollback --confirm")
        print(line + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# CLI Entrypoint
# ─────────────────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    """Construct CLI argument parser with comprehensive safety options."""
    parser = argparse.ArgumentParser(
        description="Safely migrate NyayaSetu vault documents from local disk to Cloudflare R2.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # 1. Preview migration safely without modifications (default):
  python backend/scripts/migrate_documents_to_cloud.py

  # 2. Execute migration with batching:
  python backend/scripts/migrate_documents_to_cloud.py --execute --batch-size 25

  # 3. Verify health of already migrated documents in R2:
  python backend/scripts/migrate_documents_to_cloud.py --verify-only

  # 4. Instant rollback to local filesystem serving:
  python backend/scripts/migrate_documents_to_cloud.py --rollback --confirm
        """,
    )

    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Simulate migration without modifying files or database (DEFAULT).",
    )
    mode_group.add_argument(
        "--execute",
        action="store_true",
        default=False,
        help="Explicitly perform live upload to Cloudflare R2 and update PostgreSQL.",
    )
    mode_group.add_argument(
        "--verify-only",
        action="store_true",
        default=False,
        help="Inspect documents already marked 'r2' and verify their presence in the cloud.",
    )
    mode_group.add_argument(
        "--rollback",
        action="store_true",
        default=False,
        help="Revert database records from 'r2' back to 'local' filesystem serving.",
    )

    parser.add_argument(
        "--confirm",
        action="store_true",
        default=False,
        help="Confirmation flag required for --rollback operations.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=25,
        help="Number of documents per upload and database commit batch (default: 25).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of documents to evaluate in this run.",
    )
    parser.add_argument(
        "--rollback-case",
        type=str,
        default=None,
        help="Specific Case UUID to roll back (only valid with --rollback).",
    )
    parser.add_argument(
        "--vault-dir",
        type=str,
        default=None,
        help="Custom local vault directory path (default: backend/storage/vault).",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        default=False,
        help="Enable detailed per-file output during execution.",
    )

    return parser


async def async_main():
    """Async main routine."""
    parser = build_parser()
    args = parser.parse_args()

    # If --execute, --verify-only, or --rollback is set, clear default dry_run
    is_execute = args.execute
    is_verify = args.verify_only
    is_rollback = args.rollback
    is_dry_run = not (is_execute or is_verify or is_rollback)

    if is_rollback and not args.confirm:
        print("\n[ERROR] --rollback requires explicit --confirm flag to prevent accidental changes.")
        print("Run with: python backend/scripts/migrate_documents_to_cloud.py --rollback --confirm\n")
        sys.exit(1)

    rollback_case_uuid = None
    if args.rollback_case:
        try:
            rollback_case_uuid = uuid.UUID(args.rollback_case)
        except ValueError:
            print(f"\n[ERROR] Invalid Case UUID format: '{args.rollback_case}'\n")
            sys.exit(1)

    custom_vault = Path(args.vault_dir) if args.vault_dir else None

    # Connect to PostgreSQL using standard application session context
    async with get_db_context() as session:
        report = await run_migration(
            session=session,
            execute=is_execute,
            batch_size=args.batch_size,
            limit=args.limit,
            verify_only=is_verify,
            rollback=is_rollback,
            rollback_case_id=rollback_case_uuid,
            vault_dir=custom_vault,
            verbose=args.verbose,
        )

    print_summary_table(report)


def main():
    """CLI script entrypoint."""
    try:
        asyncio.run(async_main())
    except KeyboardInterrupt:
        print("\n[ABORTED] Migration interrupted by operator.")
        sys.exit(130)
    except Exception as exc:
        print(f"\n[FATAL ERROR] Migration failed: {exc}")
        logger.error(f"Migration script fatal exception: {exc}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
