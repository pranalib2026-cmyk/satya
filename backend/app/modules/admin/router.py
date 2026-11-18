"""Admin module API endpoints — advocate verification dashboard and platform management."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user, require_roles
from app.modules.advocates.schemas import (
    AdminDecisionRequest,
    AdminPendingAdvocatesResponse,
    AdminRequestInfoRequest,
    AdminVerificationDetailResponse,
    AdminVerificationListResponse,
    AdminVerificationUpdateRequest,
    AdvocateProfileDetailResponse,
)
from app.modules.advocates.service import AdvocateVerificationService
from app.modules.users.models import User

router = APIRouter(prefix="/admin", tags=["Platform Administration"])


@router.get("/status", summary="Admin Module Status")
async def get_admin_status():
    return {"module": "admin", "status": "initialized", "active": True}


# ──────────────────────────────────────────────────────────────
# ADMIN: List pending advocate applications
# ──────────────────────────────────────────────────────────────


@router.get(
    "/advocates/pending",
    response_model=AdminPendingAdvocatesResponse,
    summary="List Pending Advocate Applications",
    description="Admin-only: list advocate profiles awaiting credential verification.",
    dependencies=[Depends(require_roles("ADMIN"))],
)
async def get_pending_advocates(
    status_filter: str = Query("PENDING", alias="status", description="Filter status (PENDING, UNDER_REVIEW, ALL_PENDING)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_active_user),
):
    items, total = await AdvocateVerificationService.admin_get_pending_advocates(
        db=db, page=page, page_size=page_size, status_filter=status_filter,
    )
    return AdminPendingAdvocatesResponse(
        items=items, total=total, page=page, page_size=page_size,
    )


# ──────────────────────────────────────────────────────────────
# ADMIN: Get advocate full details by ID
# ──────────────────────────────────────────────────────────────


@router.get(
    "/advocates/{id}",
    response_model=AdvocateProfileDetailResponse,
    summary="Get Advocate Details (Admin)",
    description="Admin-only: retrieve complete advocate profile and verification status by ID.",
    dependencies=[Depends(require_roles("ADMIN"))],
)
async def get_advocate_by_id(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_active_user),
):
    return await AdvocateVerificationService.admin_get_advocate_by_id(
        db=db, advocate_id=id,
    )


# ──────────────────────────────────────────────────────────────
# ADMIN: Review and update advocate verification status
# ──────────────────────────────────────────────────────────────


@router.patch(
    "/advocates/{id}/verification",
    response_model=AdvocateProfileDetailResponse,
    summary="Update Advocate Verification Status",
    description="Admin-only: review and update verification status (UNDER_REVIEW, VERIFIED, REJECTED).",
    dependencies=[Depends(require_roles("ADMIN"))],
)
async def update_advocate_verification(
    id: uuid.UUID,
    req: AdminVerificationUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_active_user),
):
    return await AdvocateVerificationService.admin_update_advocate_verification(
        db=db, admin_user=admin_user, advocate_id=id, req=req,
    )



# ──────────────────────────────────────────────────────────────
# ADMIN: List verification applications
# ──────────────────────────────────────────────────────────────


@router.get(
    "/advocate-verifications",
    response_model=AdminVerificationListResponse,
    summary="List Verification Applications",
    description="Admin-only: paginated list of advocate verification applications.",
    dependencies=[Depends(require_roles("ADMIN"))],
)
async def list_verifications(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_active_user),
):
    items, total = await AdvocateVerificationService.admin_list_verifications(
        db=db, status_filter=status_filter, page=page, page_size=page_size,
    )
    return AdminVerificationListResponse(
        items=items, total=total, page=page, page_size=page_size,
    )


# ──────────────────────────────────────────────────────────────
# ADMIN: Get verification application detail
# ──────────────────────────────────────────────────────────────


@router.get(
    "/advocate-verifications/{id}",
    response_model=AdminVerificationDetailResponse,
    summary="Get Verification Application Detail",
    description="Admin-only: full detail of a single verification application.",
    dependencies=[Depends(require_roles("ADMIN"))],
)
async def get_verification_detail(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_active_user),
):
    return await AdvocateVerificationService.admin_get_verification(
        db=db, application_id=id,
    )


# ──────────────────────────────────────────────────────────────
# ADMIN: Record verification decision (approve / reject)
# ──────────────────────────────────────────────────────────────


@router.post(
    "/advocate-verifications/{id}/decision",
    response_model=AdminVerificationDetailResponse,
    summary="Record Verification Decision",
    description="Admin-only: approve or reject an advocate verification application.",
    dependencies=[Depends(require_roles("ADMIN"))],
)
async def record_decision(
    id: uuid.UUID,
    req: AdminDecisionRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_active_user),
):
    application = await AdvocateVerificationService.admin_record_decision(
        db=db, admin_user=admin_user, application_id=id, req=req,
    )
    # Return full detail
    return await AdvocateVerificationService.admin_get_verification(
        db=db, application_id=id,
    )


# ──────────────────────────────────────────────────────────────
# ADMIN: Request additional information
# ──────────────────────────────────────────────────────────────


@router.post(
    "/advocate-verifications/{id}/request-info",
    response_model=AdminVerificationDetailResponse,
    summary="Request Additional Information",
    description="Admin-only: request additional information or documents from the advocate.",
    dependencies=[Depends(require_roles("ADMIN"))],
)
async def request_info(
    id: uuid.UUID,
    req: AdminRequestInfoRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_active_user),
):
    application = await AdvocateVerificationService.admin_request_info(
        db=db, admin_user=admin_user, application_id=id, req=req,
    )
    return await AdvocateVerificationService.admin_get_verification(
        db=db, application_id=id,
    )


# ──────────────────────────────────────────────────────────────
# ADMIN: Download verification document securely
# ──────────────────────────────────────────────────────────────


@router.get(
    "/advocate-verifications/documents/{document_id}/download",
    summary="Download Verification Document (Admin)",
    description="Admin-only: securely download or view an uploaded credential document.",
    dependencies=[Depends(require_roles("ADMIN"))],
)
async def admin_download_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_active_user),
):
    from fastapi.responses import Response

    data, filename, content_type = await AdvocateVerificationService.get_document_file(
        db=db, user=admin_user, document_id=document_id,
    )
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )

