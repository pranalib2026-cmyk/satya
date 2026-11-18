"""Cases and Dossiers API Router."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user
from app.modules.cases.schemas import (
    CaseCreateRequest,
    CaseListResponse,
    CaseResponse,
    CaseUpdateRequest,
    TriageOutputResponse,
)
from app.modules.cases.service import CaseService
from app.modules.users.models import User

router = APIRouter(prefix="/cases", tags=["Cases & Dossiers"])


@router.get("/status", summary="Cases Module Status")
async def get_cases_status():
    """Diagnostic health status for Cases module."""
    return {"module": "cases", "status": "initialized", "active": True}


@router.post(
    "",
    response_model=CaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Legal Problem and Intake Case",
    description=(
        "Authenticated citizens submit their legal grievance. Generates a unique "
        "case dossier reference (NYA-2026-CS-XXXX) and automatically runs initial "
        "deterministic legal triage."
    ),
)
async def create_case(
    payload: CaseCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    case = await CaseService.create_case(
        db=db,
        current_user=current_user,
        payload=payload,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return case


@router.get(
    "",
    response_model=CaseListResponse,
    summary="List My Cases",
    description=(
        "Retrieve paginated cases belonging to the authenticated citizen. "
        "Strict ownership isolation is enforced: callers never see another citizen's cases."
    ),
)
async def list_cases(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    items, total = await CaseService.list_cases(
        db=db,
        current_user=current_user,
        page=page,
        limit=limit,
    )
    return CaseListResponse(
        total=total,
        page=page,
        limit=limit,
        items=items,
    )


@router.get(
    "/{case_id}",
    response_model=CaseResponse,
    summary="Get Case Dossier Details",
    description=(
        "Retrieve detailed case information by ID. Enforces ownership: only the "
        "case owner (or assigned counsel / platform admin) can view the case."
    ),
)
async def get_case(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    case = await CaseService.get_case_by_id(
        db=db,
        case_id=case_id,
        current_user=current_user,
    )
    return case


@router.patch(
    "/{case_id}",
    response_model=CaseResponse,
    summary="Update Case Details",
    description="Update mutable fields of a case dossier. Enforces ownership and audit logging.",
)
async def update_case(
    case_id: uuid.UUID,
    payload: CaseUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    updated_case = await CaseService.update_case(
        db=db,
        case_id=case_id,
        current_user=current_user,
        payload=payload,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return updated_case


@router.post(
    "/{case_id}/triage",
    response_model=TriageOutputResponse,
    summary="Run Case Triage Assessment",
    description=(
        "Execute or re-evaluate the legal triage engine on the specified case. "
        "Produces structured next steps, evidentiary gaps, jurisdiction, urgency, "
        "and complexity assessments. Enforces ownership."
    ),
)
async def run_case_triage(
    case_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    triage_result = await CaseService.run_triage(
        db=db,
        case_id=case_id,
        current_user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return triage_result
