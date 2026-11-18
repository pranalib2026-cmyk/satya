"""Advocate module API endpoints for verification workflow."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import BadRequestException
from app.core.security import decode_jwt
from app.modules.auth.dependencies import get_current_active_user, oauth2_scheme, require_roles
from app.modules.advocates.schemas import (
    AdminDecisionRequest,
    AdminRequestInfoRequest,
    AdminVerificationDetailResponse,
    AdminVerificationListResponse,
    AdvocateApplyRequest,
    AdvocateProfileDetailResponse,
    VerificationApplicationRequest,
    VerificationApplicationResponse,
    VerificationDocumentResponse,
)
from app.modules.advocates.service import AdvocateVerificationService
from app.modules.users.models import User

router = APIRouter(prefix="/advocates", tags=["Advocates & Directory"])


async def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Retrieve user if valid Bearer token provided, otherwise return None."""
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


@router.get("/status", summary="Advocates Module Status")
async def get_advocates_status():
    return {"module": "advocates", "status": "initialized", "active": True}


# ──────────────────────────────────────────────────────────────
# ADVOCATE: Submit professional profile application (POST /apply)
# ──────────────────────────────────────────────────────────────


@router.post(
    "/apply",
    response_model=AdvocateProfileDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Advocate Profile Application",
    description=(
        "Advocate submits their complete professional profile. "
        "A registered advocate does NOT automatically become verified; "
        "the application status is initially PENDING."
    ),
)
async def apply_advocate(
    req: AdvocateApplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    return await AdvocateVerificationService.apply_advocate(
        db=db, req=req, current_user=current_user,
    )


# ──────────────────────────────────────────────────────────────
# ADVOCATE: Get own complete profile (GET /me)
# ──────────────────────────────────────────────────────────────


@router.get(
    "/me",
    response_model=AdvocateProfileDetailResponse,
    summary="Get My Advocate Profile",
    description="Retrieve the current advocate's full profile, verification status, and uploaded documents.",
)
async def get_my_advocate_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await AdvocateVerificationService.get_advocate_me(
        db=db, user=current_user,
    )



# ──────────────────────────────────────────────────────────────
# ADVOCATE: Submit verification application
# ──────────────────────────────────────────────────────────────


@router.post(
    "/me/verification",
    response_model=VerificationApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Verification Application",
    description="Advocate submits their credential verification application.",
)
async def submit_verification(
    req: VerificationApplicationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    application = await AdvocateVerificationService.submit_verification_application(
        db=db, user=current_user, req=req,
    )
    return VerificationApplicationResponse(
        id=application.id,
        enrollment_number=application.enrollment_number,
        enrollment_name=application.enrollment_name,
        state_bar_council=application.state_bar_council,
        enrollment_date=application.enrollment_date,
        aibe_status=application.aibe_status,
        cop_status=application.cop_status,
        platform_verification_status=application.platform_verification_status,
        evidence_level=application.evidence_level,
        verification_method=application.verification_method,
        decision_reason=application.decision_reason,
        info_request_message=application.info_request_message,
        submitted_at=application.submitted_at,
        decided_at=application.decided_at,
        created_at=application.created_at,
        documents=[],
    )


# ──────────────────────────────────────────────────────────────
# ADVOCATE: Get own verification status
# ──────────────────────────────────────────────────────────────


@router.get(
    "/me/verification",
    response_model=Optional[VerificationApplicationResponse],
    summary="Get My Verification Status",
    description="Retrieve the advocate's own verification application and status.",
)
async def get_my_verification(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    application = await AdvocateVerificationService.get_own_verification(
        db=db, user=current_user,
    )
    if not application:
        return None

    # Get documents
    from sqlalchemy import select
    from app.modules.advocates.models import AdvocateVerification, AdvocateProfile

    profile_res = await db.execute(
        select(AdvocateProfile).where(AdvocateProfile.user_id == current_user.id)
    )
    profile = profile_res.scalar_one_or_none()

    docs = []
    if profile:
        docs_res = await db.execute(
            select(AdvocateVerification).where(AdvocateVerification.advocate_id == profile.id)
        )
        for d in docs_res.scalars().all():
            docs.append(VerificationDocumentResponse(
                id=d.id,
                verification_type=d.verification_type,
                filename=d.filename,
                content_type=d.content_type,
                size_bytes=d.size_bytes,
                status=d.status,
                created_at=d.created_at,
            ))

    return VerificationApplicationResponse(
        id=application.id,
        enrollment_number=application.enrollment_number,
        enrollment_name=application.enrollment_name,
        state_bar_council=application.state_bar_council,
        enrollment_date=application.enrollment_date,
        aibe_status=application.aibe_status,
        cop_status=application.cop_status,
        platform_verification_status=application.platform_verification_status,
        evidence_level=application.evidence_level,
        verification_method=application.verification_method,
        decision_reason=application.decision_reason,
        info_request_message=application.info_request_message,
        submitted_at=application.submitted_at,
        decided_at=application.decided_at,
        created_at=application.created_at,
        documents=docs,
    )


# ──────────────────────────────────────────────────────────────
# ADVOCATE: Upload verification documents
# ──────────────────────────────────────────────────────────────


@router.post(
    "/me/verification/documents",
    response_model=VerificationDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Verification Document",
    description="Upload a credential document (enrollment certificate, bar ID, AIBE, COP).",
)
async def upload_document(
    verification_type: str = Form(..., description="ENROLLMENT_CERTIFICATE, BAR_ID_CARD, AIBE_CERTIFICATE, COP_CERTIFICATE"),
    file: UploadFile = File(..., description="Document file (PDF, JPEG, PNG, WebP; max 10 MB)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    file_data = await file.read()
    doc = await AdvocateVerificationService.upload_verification_document(
        db=db,
        user=current_user,
        verification_type=verification_type,
        filename=file.filename or "document",
        content_type=file.content_type or "application/octet-stream",
        file_data=file_data,
    )
    return VerificationDocumentResponse(
        id=doc.id,
        verification_type=doc.verification_type,
        filename=doc.filename,
        content_type=doc.content_type,
        size_bytes=doc.size_bytes,
        status=doc.status,
        created_at=doc.created_at,
    )


# ──────────────────────────────────────────────────────────────
# ADVOCATE: Download own verification document securely
# ──────────────────────────────────────────────────────────────


@router.get(
    "/me/verification/documents/{document_id}/download",
    summary="Download Own Verification Document",
    description="Advocate: securely download own uploaded credential document.",
)
async def advocate_download_own_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from fastapi.responses import Response

    data, filename, content_type = await AdvocateVerificationService.get_document_file(
        db=db, user=current_user, document_id=document_id,
    )
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )

