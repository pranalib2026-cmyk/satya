"""Document Management API Router."""

import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.storage import BaseStorageProvider, get_storage
from app.modules.auth.dependencies import get_current_active_user, oauth2_scheme
from app.modules.documents.schemas import (
    DocumentDownloadTokenResponse,
    DocumentExplanationResponse,
    DocumentListResponse,
    DocumentResponse,
    DocumentScanResponse,
)
from app.modules.documents.service import DocumentService
from app.modules.users.models import User

router = APIRouter(prefix="/documents", tags=["Document Vault & Evidence"])


@router.get("/status", summary="Documents Module Status")
async def get_documents_status():
    """Diagnostic health status for Documents module."""
    return {"module": "documents", "status": "initialized", "active": True}


@router.post(
    "/cases/{case_id}/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Case Document",
    description="Uploads a case evidence or legal filing document with SHA-256 integrity validation and case ownership enforcement.",
)
async def upload_case_document(
    case_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    document_category: str = Form("EVIDENCE"),
    is_confidential: bool = Form(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorageProvider = Depends(get_storage),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    doc = await DocumentService.upload_document(
        db=db,
        case_id=case_id,
        file=file,
        document_category=document_category,
        current_user=current_user,
        is_confidential=is_confidential,
        storage_provider=storage,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return doc


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Document",
    description="Uploads a document to the private vault associated with the authenticated user or an optional case.",
)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    case_id: Optional[uuid.UUID] = Form(None),
    document_category: str = Form("EVIDENCE"),
    is_confidential: bool = Form(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorageProvider = Depends(get_storage),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    doc = await DocumentService.upload_document(
        db=db,
        case_id=case_id,
        file=file,
        document_category=document_category,
        current_user=current_user,
        is_confidential=is_confidential,
        storage_provider=storage,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return doc


@router.post(
    "/scan",
    response_model=DocumentScanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and Scan Document",
    description="Uploads a document and immediately extracts text using native PDF text or real OCR engine.",
)
async def scan_and_upload_document(
    request: Request,
    file: UploadFile = File(...),
    case_id: Optional[uuid.UUID] = Form(None),
    document_category: str = Form("EVIDENCE"),
    is_confidential: bool = Form(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorageProvider = Depends(get_storage),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    doc, ocr_res = await DocumentService.scan_document(
        db=db,
        file=file,
        case_id=case_id,
        document_category=document_category,
        is_confidential=is_confidential,
        current_user=current_user,
        storage_provider=storage,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return DocumentScanResponse(
        document_id=doc.id,
        status=doc.processing_status,
        text=doc.extracted_text or "",
        confidence=doc.ocr_confidence or 0.0,
        low_confidence=ocr_res.low_confidence,
        ocr_engine=doc.ocr_engine or "unknown",
        file_name=doc.file_name,
        file_size_bytes=doc.file_size_bytes,
        mime_type=doc.mime_type,
        processing_error=doc.processing_error,
        processed_at=doc.processed_at,
    )


@router.post(
    "/{document_id}/ocr",
    response_model=DocumentScanResponse,
    summary="Run OCR on Existing Document",
    description="Executes optical text extraction on an already uploaded document in the vault.",
)
async def trigger_document_ocr(
    document_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorageProvider = Depends(get_storage),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    doc, ocr_res = await DocumentService.run_ocr(
        db=db,
        document_id=document_id,
        current_user=current_user,
        storage_provider=storage,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return DocumentScanResponse(
        document_id=doc.id,
        status=doc.processing_status,
        text=doc.extracted_text or "",
        confidence=doc.ocr_confidence or 0.0,
        low_confidence=ocr_res.low_confidence,
        ocr_engine=doc.ocr_engine or "unknown",
        file_name=doc.file_name,
        file_size_bytes=doc.file_size_bytes,
        mime_type=doc.mime_type,
        processing_error=doc.processing_error,
        processed_at=doc.processed_at,
    )


@router.get(
    "/{document_id}/ocr",
    response_model=DocumentScanResponse,
    summary="Get Document OCR Result",
    description="Retrieves the current OCR processing status, confidence, and extracted text.",
)
async def get_document_ocr(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    doc = await DocumentService.get_document(db, document_id, current_user)
    low_conf = False
    if doc.metadata_json and isinstance(doc.metadata_json, dict):
        low_conf = doc.metadata_json.get("low_confidence", False)

    return DocumentScanResponse(
        document_id=doc.id,
        status=doc.processing_status,
        text=doc.extracted_text or "",
        confidence=doc.ocr_confidence or 0.0,
        low_confidence=low_conf,
        ocr_engine=doc.ocr_engine or "unknown",
        file_name=doc.file_name,
        file_size_bytes=doc.file_size_bytes,
        mime_type=doc.mime_type,
        processing_error=doc.processing_error,
        processed_at=doc.processed_at,
    )


@router.post(
    "/{document_id}/explain",
    response_model=DocumentExplanationResponse,
    summary="Explain Legal Document",
    description="Generates plain-language explanation and entities from extracted document text grounded in verified Indian statutory sources.",
)
async def explain_document(
    document_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorageProvider = Depends(get_storage),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await DocumentService.explain_document(
        db=db,
        document_id=document_id,
        current_user=current_user,
        storage_provider=storage,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get(
    "/cases/{case_id}",
    response_model=DocumentListResponse,
    summary="List Case Documents",
    description="Lists documents for a case. Enforces case ownership permissions.",
)
async def list_case_documents(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    docs = await DocumentService.list_case_documents(
        db=db,
        case_id=case_id,
        current_user=current_user,
    )
    return DocumentListResponse(total=len(docs), items=docs)


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    summary="Get Document Metadata",
    description="Retrieves metadata of a specific document with permission enforcement.",
)
async def get_document_metadata(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await DocumentService.get_document(
        db=db,
        document_id=document_id,
        current_user=current_user,
    )


@router.get(
    "/{document_id}/access-token",
    response_model=DocumentDownloadTokenResponse,
    summary="Generate Authorized Short-Lived Download Token",
    description="Generates an authorized, signed download token valid for 15 minutes. Never exposes public URLs.",
)
async def get_document_download_token(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorageProvider = Depends(get_storage),
):
    return await DocumentService.generate_download_token(
        db=db,
        document_id=document_id,
        current_user=current_user,
        storage_provider=storage,
    )


@router.get(
    "/{document_id}/download",
    summary="Download Case Document",
    description="Securely streams document from private vault using either Bearer token or short-lived download token. Never exposed through public directories.",
)
async def download_document(
    document_id: uuid.UUID,
    request: Request,
    token: Optional[str] = Query(None, description="Short-lived download token"),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageProvider = Depends(get_storage),
):
    # Check if Bearer token is present in Authorization header
    auth_header = request.headers.get("authorization")
    current_user: Optional[User] = None

    if auth_header and auth_header.startswith("Bearer ") and not token:
        try:
            from app.core.security import decode_jwt
            jwt_token = auth_header.split(" ")[1]
            payload = decode_jwt(jwt_token)
            user_id = payload.get("sub")
            if user_id:
                from sqlalchemy import select
                u_res = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
                current_user = u_res.scalar_one_or_none()
        except Exception:
            pass

    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    doc, download_target = await DocumentService.get_document_for_download(
        db=db,
        document_id=document_id,
        current_user=current_user,
        token=token,
        storage_provider=storage,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    # 1. If download target is a remote presigned URL (e.g. Cloudflare R2), issue HTTP 307 temporary redirect
    if download_target.startswith("http://") or download_target.startswith("https://"):
        return RedirectResponse(url=download_target, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    # 2. If download target is an existing local file on disk, stream via FileResponse
    if os.path.isfile(download_target):
        return FileResponse(
            path=download_target,
            media_type=doc.mime_type,
            filename=doc.file_name,
        )

    # 3. Fallback: retrieve raw bytes from storage provider
    content = await storage.download(download_target)
    return Response(
        content=content,
        media_type=doc.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{doc.file_name}"'},
    )


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Case Document",
    description="Deletes a document from storage vault and database with permission enforcement.",
)
async def delete_case_document(
    document_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorageProvider = Depends(get_storage),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    await DocumentService.delete_document(
        db=db,
        document_id=document_id,
        current_user=current_user,
        storage_provider=storage,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return {"status": "success", "message": "Document deleted successfully."}

