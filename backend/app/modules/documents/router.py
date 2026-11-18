"""Document Management API Router."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user, oauth2_scheme
from app.modules.documents.schemas import (
    DocumentDownloadTokenResponse,
    DocumentListResponse,
    DocumentResponse,
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
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return doc


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
):
    return await DocumentService.generate_download_token(
        db=db,
        document_id=document_id,
        current_user=current_user,
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

    doc, physical_path = await DocumentService.get_document_for_download(
        db=db,
        document_id=document_id,
        current_user=current_user,
        token=token,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return FileResponse(
        path=physical_path,
        media_type=doc.mime_type,
        filename=doc.file_name,
    )
