#!/usr/bin/env python3
"""CLI Operational Tool for Legal Document Ingestion in NyayaSetu.

Allows DevOps and Legal Engineers to ingest verified Indian Bare Acts,
run seed corpus initialization, and batch process legal documents into PostgreSQL/pgvector.

Usage:
  # Ingest a single PDF/HTML/TXT legal document:
  python scripts/ingest_legal_document.py --file path/to/act.pdf --title "The Act Name" --short-code "ACT" --official-url "https://indiacode.nic.in/..."

  # Seed the verified curated 20-statute corpus:
  python scripts/ingest_legal_document.py --seed

  # Re-embed all stored chunks with the active embedding provider:
  python scripts/ingest_legal_document.py --reembed
"""

import argparse
import asyncio
import os
from pathlib import Path
import sys

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.database import get_db_context
import app.core.models  # noqa: F401  # Register all ORM models before mapper configuration
from app.core.logging import logger
from app.modules.legal_knowledge.ingestion import LegalIngestionService
from app.modules.legal_knowledge.ingestion_pipeline import LegalDocumentIngestionPipeline


async def handle_seed():
    """Seed the curated baseline corpus."""
    logger.info("Starting curated legal corpus seeding...")
    async with get_db_context() as session:
        count = await LegalIngestionService.seed_curated_corpus(session)
        logger.info(f"Seeding completed successfully. Total chunks stored: {count}")
        print(f"✅ Successfully seeded {count} curated legal chunks into PostgreSQL/pgvector.")


async def handle_reembed():
    """Re-embed all existing chunks."""
    logger.info("Starting knowledge base re-embedding...")
    async with get_db_context() as session:
        count = await LegalIngestionService.reembed_all_chunks(session)
        logger.info(f"Re-embedding completed. Total chunks re-embedded: {count}")
        print(f"✅ Successfully re-embedded {count} legal chunks.")


async def handle_ingest_processed(
    chunks_file: str,
    datasets: list[str] | None,
    limit: int | None,
):
    """Ingest preprocessed RAG chunks JSONL into PostgreSQL/pgvector."""
    logger.info(f"Starting processed corpus ingestion from {chunks_file}...")
    async with get_db_context() as session:
        summary = await LegalIngestionService.ingest_processed_corpus(
            db=session,
            chunks_jsonl_path=chunks_file,
            dataset_filter=datasets,
            max_documents=limit,
        )
        print(f"✅ Processed corpus ingestion complete: {summary}")


async def handle_ingest_file(
    file_path: str,
    title: str,
    short_code: str,
    citation: str,
    jurisdiction: str,
    official_url: str,
    version: str,
    force: bool,
):
    """Ingest a single document file."""
    path = Path(file_path)
    if not path.is_file():
        print(f"❌ Error: File not found at '{file_path}'")
        sys.exit(1)

    ext = path.suffix.lower().replace(".", "")
    if ext not in {"pdf", "html", "htm", "txt", "md", "json"}:
        print(f"❌ Error: Unsupported file format '{ext}'. Must be PDF, HTML, TXT, or JSON.")
        sys.exit(1)

    format_map = {
        "pdf": "PDF",
        "html": "HTML",
        "htm": "HTML",
        "txt": "TXT",
        "md": "TXT",
        "json": "JSON",
    }
    file_format = format_map[ext]

    with open(path, "rb") as f:
        raw_bytes = f.read()

    source_metadata = {
        "title": title,
        "short_code": short_code,
        "citation": citation,
        "jurisdiction": jurisdiction,
        "official_source_url": official_url,
        "document_version": version,
        "verification_status": "VERIFIED",
    }

    print(f"📄 Processing document '{title}' ({file_format}, {len(raw_bytes)} bytes)...")
    async with get_db_context() as session:
        try:
            source, job = await LegalDocumentIngestionPipeline.ingest_document(
                db=session,
                source_metadata=source_metadata,
                raw_content=raw_bytes,
                file_format=file_format,
                filename=path.name,
                force_reprocess=force,
                require_verified_source=bool(official_url),
            )
            print(f"✅ Ingestion successful!")
            print(f"   Status:           {job.status}")
            print(f"   Source ID:        {source.id}")
            print(f"   Sections Parsed:  {job.chunks_extracted}")
            print(f"   Sections Embedded:{job.chunks_embedded}")
            print(f"   Checksum:         {job.content_checksum}")
        except Exception as e:
            print(f"❌ Ingestion failed: {str(e)}")
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="NyayaSetu Legal Document Ingestion CLI")
    parser.add_argument("--seed", action="store_true", help="Seed curated 20-statute baseline legal corpus")
    parser.add_argument("--reembed", action="store_true", help="Re-embed all chunks with active provider")
    parser.add_argument("--ingest-processed", action="store_true", help="Ingest preprocessed data/processed/chunked/rag_chunks.jsonl")
    parser.add_argument(
        "--chunks-file",
        type=str,
        default=str(backend_dir.parent / "data" / "processed" / "chunked" / "rag_chunks.jsonl"),
        help="Path to preprocessed rag_chunks.jsonl",
    )
    parser.add_argument("--dataset", action="append", default=None, help="Filter by source_dataset (repeatable)")
    parser.add_argument("--limit", type=int, default=None, help="Maximum documents to ingest")
    parser.add_argument("--file", type=str, help="Path to legal document file (PDF, HTML, TXT, JSON)")
    parser.add_argument("--title", type=str, help="Official title of the statute or judgment")
    parser.add_argument("--short-code", type=str, default=None, help="Statutory short code (e.g., BNS, NI_ACT)")
    parser.add_argument("--citation", type=str, default=None, help="Official publication citation")
    parser.add_argument("--jurisdiction", type=str, default="Union of India", help="Legal jurisdiction")
    parser.add_argument("--official-url", type=str, default=None, help="Official government portal source URL")
    parser.add_argument("--version", type=str, default="1.0", help="Document version string")
    parser.add_argument("--force", action="store_true", help="Force reprocessing if document already exists")

    args = parser.parse_args()

    if args.seed:
        asyncio.run(handle_seed())
    elif args.reembed:
        asyncio.run(handle_reembed())
    elif args.ingest_processed:
        asyncio.run(handle_ingest_processed(args.chunks_file, args.dataset, args.limit))
    elif args.file:
        if not args.title:
            parser.error("--title is required when specifying --file")
        asyncio.run(
            handle_ingest_file(
                file_path=args.file,
                title=args.title,
                short_code=args.short_code,
                citation=args.citation,
                jurisdiction=args.jurisdiction,
                official_url=args.official_url,
                version=args.version,
                force=args.force,
            )
        )
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
