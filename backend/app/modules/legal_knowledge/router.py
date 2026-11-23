"""Legal Knowledge & Official Statutory Document Ingestion Router."""

from datetime import date
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.modules.auth.dependencies import require_roles
from app.modules.legal_knowledge.ingestion_pipeline import LegalDocumentIngestionPipeline
from app.modules.legal_knowledge.models import LegalChunk, LegalIngestionJob, LegalSource
from app.modules.legal_knowledge.schemas import (
    LegalIngestionJobResponse,
    LegalIngestTextRequest,
    LegalSourceSummaryResponse,
)
from app.modules.users.models import User

router = APIRouter(prefix="/legal-knowledge", tags=["Legal Knowledge & Statutory Ingestion"])


@router.get("/status", summary="Legal Knowledge Ingestion Status")
async def get_legal_knowledge_status(db: AsyncSession = Depends(get_db)):
    """Diagnostic health status and ingestion metrics for the legal knowledge base."""
    sources_count = await db.scalar(select(func.count(LegalSource.id))) or 0
    chunks_count = await db.scalar(select(func.count(LegalChunk.id))) or 0
    jobs_count = await db.scalar(select(func.count(LegalIngestionJob.id))) or 0

    return {
        "module": "legal_knowledge",
        "status": "initialized",
        "active": True,
        "total_sources": sources_count,
        "total_chunks": chunks_count,
        "total_ingestion_jobs": jobs_count,
    }


# ──────────────────────────────────────────────────────────────
# 1. Admin Text/HTML Ingestion (POST /ingest/text)
# ──────────────────────────────────────────────────────────────


@router.post(
    "/ingest/text",
    response_model=LegalIngestionJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Admin: Ingest Statutory Text or HTML",
    description="Parses, chunks, embeds, and stores verified legal text into PostgreSQL/pgvector.",
)
async def ingest_legal_text(
    payload: LegalIngestTextRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_roles("ADMIN")),
):
    source_metadata = {
        "title": payload.title,
        "short_code": payload.short_code,
        "source_type": payload.source_type,
        "citation": payload.citation,
        "jurisdiction": payload.jurisdiction,
        "court": payload.court,
        "act_or_judgment_identifier": payload.act_or_judgment_identifier,
        "publication_date": payload.publication_date,
        "document_version": payload.document_version,
        "official_source_url": payload.official_source_url,
        "verification_status": "VERIFIED",
    }

    try:
        source, job = await LegalDocumentIngestionPipeline.ingest_document(
            db=db,
            source_metadata=source_metadata,
            raw_content=payload.content_text,
            file_format=payload.file_format,
            force_reprocess=payload.force_reprocess,
            require_verified_source=True,
        )
        return job
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ──────────────────────────────────────────────────────────────
# 2. Admin File Upload Ingestion (POST /ingest/file)
# ──────────────────────────────────────────────────────────────


@router.post(
    "/ingest/file",
    response_model=LegalIngestionJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Admin: Ingest Legal Document File (PDF, HTML, TXT)",
    description="Upload an official gazette or Bare Act file. Extracts text, chunks provisions, and embeds in pgvector.",
)
async def ingest_legal_file(
    file: UploadFile = File(...),
    title: str = Form(...),
    short_code: Optional[str] = Form(None),
    source_type: str = Form("BARE_ACT"),
    citation: Optional[str] = Form(None),
    jurisdiction: str = Form("Union of India"),
    court: Optional[str] = Form(None),
    act_or_judgment_identifier: Optional[str] = Form(None),
    publication_date: Optional[date] = Form(None),
    document_version: str = Form("1.0"),
    official_source_url: Optional[str] = Form(None),
    force_reprocess: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_roles("ADMIN")),
):
    # Read file bytes
    content_bytes = await file.read()
    if not content_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    # Determine file format from filename or content_type
    filename = file.filename or "uploaded_document"
    ext = filename.split(".")[-1].upper() if "." in filename else "TXT"

    source_metadata = {
        "title": title,
        "short_code": short_code,
        "source_type": source_type,
        "citation": citation,
        "jurisdiction": jurisdiction,
        "court": court,
        "act_or_judgment_identifier": act_or_judgment_identifier,
        "publication_date": publication_date,
        "document_version": document_version,
        "official_source_url": official_source_url,
        "verification_status": "VERIFIED",
    }

    try:
        source, job = await LegalDocumentIngestionPipeline.ingest_document(
            db=db,
            source_metadata=source_metadata,
            raw_content=content_bytes,
            file_format=ext,
            filename=filename,
            force_reprocess=force_reprocess,
            require_verified_source=True,
        )
        return job
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ──────────────────────────────────────────────────────────────
# 3. Ingestion Job Monitoring (GET /jobs)
# ──────────────────────────────────────────────────────────────


@router.get(
    "/jobs",
    response_model=List[LegalIngestionJobResponse],
    summary="Admin: List Ingestion Jobs & Run Logs",
)
async def list_ingestion_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_roles("ADMIN")),
):
    query = select(LegalIngestionJob).order_by(LegalIngestionJob.created_at.desc()).limit(limit)
    if status_filter:
        query = query.where(LegalIngestionJob.status == status_filter.upper())

    res = await db.execute(query)
    return res.scalars().all()


@router.get(
    "/jobs/{job_id}",
    response_model=LegalIngestionJobResponse,
    summary="Admin: Get Specific Ingestion Job Detail",
)
async def get_ingestion_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_roles("ADMIN")),
):
    res = await db.execute(select(LegalIngestionJob).where(LegalIngestionJob.id == job_id))
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingestion job not found.")
    return job


# ──────────────────────────────────────────────────────────────
# 4. Verified Legal Sources (GET /sources)
# ──────────────────────────────────────────────────────────────


@router.get(
    "/sources",
    response_model=List[LegalSourceSummaryResponse],
    summary="List Ingested Legal Sources",
)
async def list_legal_sources(
    jurisdiction: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(LegalSource)
        .options(selectinload(LegalSource.chunks))
        .order_by(LegalSource.created_at.desc())
        .limit(limit)
    )
    if jurisdiction:
        query = query.where(LegalSource.jurisdiction == jurisdiction)

    res = await db.execute(query)
    sources = res.scalars().all()

    return [
        LegalSourceSummaryResponse(
            id=s.id,
            title=s.title,
            short_code=s.short_code,
            source_type=s.source_type,
            citation=s.citation,
            jurisdiction=s.jurisdiction,
            court=s.court,
            document_version=s.document_version,
            verification_status=s.verification_status,
            ingestion_status=s.ingestion_status,
            content_checksum=s.content_checksum,
            official_source_url=s.official_source_url,
            total_chunks=len(s.chunks),
            publication_date=s.publication_date,
            last_verified_date=s.last_verified_date,
            created_at=s.created_at,
        )
        for s in sources
    ]
