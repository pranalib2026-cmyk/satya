"""Legal AI Assistant and Grounded RAG API Router."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import BadRequestException
from app.core.security import decode_jwt
from app.modules.auth.dependencies import oauth2_scheme, require_roles
from app.modules.documents.ocr import DocumentOCREngine
from app.modules.legal_assistant.schemas import (
    AskMeAttachmentResponse,
    AskMeRequest,
    AskMeResponse,
    AskMeSpeakRequest,
    AskMeTranscribeResponse,
    LegalAskRequest,
    LegalAskResponse,
    LegalChunkCreate,
    LegalSourceCreate,
    LegalSourceResponse,
)
from app.modules.legal_assistant.service import LegalAssistantService
from app.modules.legal_knowledge.ingestion import LegalIngestionService
from app.modules.legal_knowledge.models import LegalChunk, LegalSource
from app.modules.users.models import User

# Main RAG router mounted under /api/v1/legal
router = APIRouter(prefix="/legal", tags=["Legal AI Assistant (RAG)"])

# Legacy / Health alias router mounted under /api/v1/legal-assistant
alias_router = APIRouter(prefix="/legal-assistant", tags=["Legal AI Assistant (RAG)"])


async def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Extract user if valid Bearer token provided, otherwise return None."""
    if not token:
        return None
    try:
        payload = decode_jwt(token)
        user_id_str = payload.get("sub")
        if user_id_str:
            res = await db.execute(select(User).where(User.id == uuid.UUID(user_id_str)))
            return res.scalar_one_or_none()
    except Exception:
        pass
    return None


@router.get("/status", summary="Legal Module Status")
@alias_router.get("/status", summary="Legal Assistant Module Status")
async def get_legal_status():
    """Diagnostic health status for Legal Assistant module."""
    return {"module": "legal_assistant", "status": "initialized", "active": True}


# ──────────────────────────────────────────────────────────────
# 1. Grounded Legal AI Question Answering (POST /api/v1/legal/ask)
# ──────────────────────────────────────────────────────────────


@router.post(
    "/ask",
    response_model=LegalAskResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask Legal AI Assistant",
    description=(
        "Executes grounded legal question answering over verified Indian Bare Acts and judicial precedents. "
        "Strictly grounded in retrieved source context; never invents legal sections or fabricates citations. "
        "Returns verified citations, source URLs, content checksums, and actionable next-step guidance."
    ),
)
async def ask_legal_assistant(
    payload: LegalAskRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await LegalAssistantService.ask(
        db=db,
        payload=payload,
        current_user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.post(
    "/ask-me",
    response_model=AskMeResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask Me: Grounded Section Lookup, Simplification, Solutions & Escalation",
    description=(
        "Accepts typed or speech-transcribed citizen queries, returns strictly verified Indian statutory "
        "Sections/Articles with references, a plain-language simplified explanation, actionable solutions, "
        "and verified advocate contact & qualification details for serious matters."
    ),
)
async def ask_me_assistant(
    payload: AskMeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await LegalAssistantService.ask_me(
        db=db,
        payload=payload,
        current_user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.post(
    "/ask-me/stream",
    status_code=status.HTTP_200_OK,
    summary="Ask Me: Streaming SSE Conversational Endpoint",
    description="Streams verified legal metadata followed by token-by-token grounded answer chunks.",
)
async def ask_me_stream(
    payload: AskMeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return StreamingResponse(
        LegalAssistantService.stream_ask_me(
            db=db,
            payload=payload,
            current_user=current_user,
            ip_address=ip_address,
            user_agent=user_agent,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.post(
    "/ask-me/upload-context",
    response_model=AskMeAttachmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask Me: Extract Text from Notice, Memo, or Photo",
    description="Extracts readable text from PDF, JPEG, or PNG attachments for Ask Me chat context.",
)
async def ask_me_upload_context(
    file: UploadFile = File(...),
):
    content = await file.read()
    if not content:
        raise BadRequestException(message="Uploaded file is empty.")
    if len(content) > 10 * 1024 * 1024:
        raise BadRequestException(message="File exceeds the 10 MB limit for Ask Me chat attachments.")

    file_name = file.filename or "attachment"
    mime_type = file.content_type or "application/octet-stream"
    ocr_result = DocumentOCREngine.process_document(
        content=content,
        file_name=file_name,
        mime_type=mime_type,
    )
    return AskMeAttachmentResponse(
        file_name=file_name,
        extracted_text=ocr_result.text[:6000],
        char_count=ocr_result.char_count,
        page_count=ocr_result.page_count,
        engine_name=ocr_result.engine_name,
    )


@router.post(
    "/ask-me/transcribe",
    response_model=AskMeTranscribeResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask Me: Gemini Speech-to-Text Transcription",
    description="Transcribes recorded user speech audio using Google Gemini.",
)
async def ask_me_transcribe(
    file: UploadFile = File(...),
    language: str = Form("en"),
):
    audio_bytes = await file.read()
    if not audio_bytes:
        raise BadRequestException(message="Recorded audio file is empty.")
    if len(audio_bytes) > 10 * 1024 * 1024:
        raise BadRequestException(message="Audio exceeds the 10 MB limit.")

    mime_type = file.content_type or "audio/webm"
    transcript = LegalAssistantService.transcribe_audio_gemini(
        audio_bytes=audio_bytes,
        mime_type=mime_type,
        language=language,
    )
    return AskMeTranscribeResponse(
        transcript=transcript,
        language=language,
        provider="gemini",
    )


@router.post(
    "/ask-me/speak",
    status_code=status.HTTP_200_OK,
    summary="Ask Me: Gemini Text-to-Speech Audio",
    description="Synthesizes spoken audio for Ask Me replies using Google Gemini TTS.",
)
async def ask_me_speak(payload: AskMeSpeakRequest):
    audio_bytes, mime_type = LegalAssistantService.synthesize_speech_gemini(
        text=payload.text,
        language=payload.language,
    )
    return Response(content=audio_bytes, media_type=mime_type)


# ──────────────────────────────────────────────────────────────
# 2. Protected Admin Knowledge Ingestion Workflows
# ──────────────────────────────────────────────────────────────


@router.post(
    "/admin/sources",
    response_model=LegalSourceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Admin: Register Curated Legal Source",
    description="Registers an official Bare Act, published judgment, or legal aid scheme. Admin only.",
)
async def admin_create_source(
    payload: LegalSourceCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    source = await LegalIngestionService.create_source(db=db, payload=payload)
    return LegalSourceResponse(
        id=source.id,
        source_type=source.source_type,
        title=source.title,
        short_code=source.short_code,
        citation=source.citation,
        jurisdiction=source.jurisdiction,
        court=source.court,
        act_or_judgment_identifier=source.act_or_judgment_identifier,
        publication_date=source.publication_date,
        last_verified_date=source.last_verified_date,
        document_version=source.document_version,
        content_checksum=source.content_checksum,
        official_source_url=source.official_source_url,
        total_chunks=0,
        created_at=source.created_at,
        updated_at=source.updated_at,
    )


@router.post(
    "/admin/sources/{source_id}/chunks",
    status_code=status.HTTP_201_CREATED,
    summary="Admin: Ingest and Embed Statutory Chunk",
    description="Ingests a section or paragraph, generates dense vector embedding, and stores checksum. Admin only.",
)
async def admin_ingest_chunk(
    source_id: uuid.UUID,
    payload: LegalChunkCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    chunk = await LegalIngestionService.ingest_chunk(
        db=db,
        source_id=source_id,
        payload=payload,
    )
    return {
        "id": str(chunk.id),
        "source_id": str(chunk.source_id),
        "section_number": chunk.section_number,
        "clause_heading": chunk.clause_heading,
        "content_checksum": chunk.content_checksum,
        "token_count": chunk.token_count,
        "status": "embedded_and_stored",
    }


@router.post(
    "/admin/seed",
    status_code=status.HTTP_200_OK,
    summary="Admin: Seed Curated Initial Legal Corpus",
    description="Loads official Indian statutory Bare Acts into the vector repository. Admin only.",
)
async def admin_seed_corpus(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    count = await LegalIngestionService.seed_curated_corpus(db=db)
    return {"status": "success", "chunks_seeded": count}


@router.get(
    "/admin/sources",
    response_model=List[LegalSourceResponse],
    summary="Admin: List Curated Legal Sources",
    description="Lists all verified Indian legal sources in the repository. Admin only.",
)
async def admin_list_sources(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    res = await db.execute(select(LegalSource).order_by(LegalSource.created_at.desc()))
    sources = res.scalars().all()

    items = []
    for s in sources:
        chunk_count_res = await db.execute(
            select(func.count(LegalChunk.id)).where(LegalChunk.source_id == s.id)
        )
        c_count = chunk_count_res.scalar() or 0
        items.append(
            LegalSourceResponse(
                id=s.id,
                source_type=s.source_type,
                title=s.title,
                short_code=s.short_code,
                citation=s.citation,
                jurisdiction=s.jurisdiction,
                court=s.court,
                act_or_judgment_identifier=s.act_or_judgment_identifier,
                publication_date=s.publication_date,
                last_verified_date=s.last_verified_date,
                document_version=s.document_version,
                content_checksum=s.content_checksum,
                official_source_url=s.official_source_url,
                total_chunks=c_count,
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
        )
    return items
