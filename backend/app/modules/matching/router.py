"""Advocate Matching Engine and Private Consultation Request API Router."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.advocates.schemas import MatchingAdvocateResponse
from app.modules.advocates.service import AdvocateVerificationService
from app.modules.auth.dependencies import get_current_active_user
from app.modules.matching.schemas import (
    CaseMatchingResponse,
    ConsultationRequestCreate,
    ConsultationRequestListResponse,
    ConsultationRequestResponse,
)
from app.modules.matching.service import MatchingService
from app.modules.users.models import User

router = APIRouter(prefix="/matching", tags=["Advocate Matching Engine"])


@router.get("/status", summary="Matching Module Status")
async def get_matching_status():
    """Diagnostic health status for Matching module."""
    return {"module": "matching", "status": "initialized", "active": True}


# ──────────────────────────────────────────────────────────────
# 1. Private Case-Driven Advocate Matching
# ──────────────────────────────────────────────────────────────


@router.get(
    "/cases/{case_id}/advocates",
    response_model=CaseMatchingResponse,
    summary="Match Verified Advocates for Case",
    description=(
        "Executes multi-factor objective matching against platform-verified advocates "
        "based on the citizen's case parameters: practice relevance (35%), court jurisdiction (25%), "
        "language compatibility (20%), geographic proximity (10%), and availability (10%). "
        "Enforces client case ownership, BCI Rule 36 compliance, and zero paid placement."
    ),
)
async def match_advocates_for_case(
    case_id: uuid.UUID,
    request: Request,
    max_distance_km: Optional[float] = Query(None, ge=1.0, le=2000.0, description="Maximum distance threshold in km"),
    max_budget_inr: Optional[float] = Query(None, ge=0.0, description="Preferred maximum consultation fee in INR"),
    preferred_language: Optional[str] = Query(None, description="Preferred language for consultation"),
    limit: int = Query(10, ge=1, le=50, description="Maximum candidates to return"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    matching_result = await MatchingService.match_advocates_for_case(
        db=db,
        case_id=case_id,
        current_user=current_user,
        max_distance_km=max_distance_km,
        max_budget_inr=max_budget_inr,
        preferred_language=preferred_language,
        limit=limit,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return matching_result


# ──────────────────────────────────────────────────────────────
# 2. Private Consultation Request Initiation
# ──────────────────────────────────────────────────────────────


@router.post(
    "/consultation-requests",
    response_model=ConsultationRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Private Consultation Request to Verified Advocate",
    description=(
        "Initiates a private 1-on-1 consultation request to a matched, verified advocate. "
        "Creates a unique reference code (NYA-2026-CR-XXXX) and an immutable audit trail."
    ),
)
async def create_consultation_request(
    payload: ConsultationRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    consultation = await MatchingService.create_consultation_request(
        db=db,
        current_user=current_user,
        payload=payload,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return consultation


# ──────────────────────────────────────────────────────────────
# 3. List Consultation Requests
# ──────────────────────────────────────────────────────────────


@router.get(
    "/consultation-requests",
    response_model=ConsultationRequestListResponse,
    summary="List My Consultation Requests",
    description=(
        "Lists consultation requests with role-based isolation: Citizens see their submitted "
        "requests; Advocates see requests targeted at their chamber; Admins see all requests."
    ),
)
async def list_consultation_requests(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    items, total = await MatchingService.list_consultation_requests(
        db=db,
        current_user=current_user,
        page=page,
        limit=limit,
    )
    return ConsultationRequestListResponse(
        total=total,
        page=page,
        limit=limit,
        items=items,
    )


# ──────────────────────────────────────────────────────────────
# 4. Directory Search (Preserved for compatibility)
# ──────────────────────────────────────────────────────────────


@router.get(
    "/advocates",
    response_model=dict,
    summary="Search Verified Advocates Directory",
    description=(
        "Search for platform-verified advocates eligible for matching. "
        "Only advocates whose platform_verification_status is VERIFIED appear."
    ),
)
async def search_verified_advocates(
    practice: Optional[str] = Query(None, description="Filter by primary practice area"),
    city: Optional[str] = Query(None, description="Filter by city"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    advocates, total = await AdvocateVerificationService.get_verified_advocates(
        db=db,
        practice_filter=practice,
        city_filter=city,
        page=page,
        page_size=page_size,
    )

    from sqlalchemy import select
    items = []
    for adv in advocates:
        user_result = await db.execute(select(User).where(User.id == adv.user_id))
        user = user_result.scalar_one_or_none()
        items.append(
            MatchingAdvocateResponse(
                id=adv.id,
                full_name=user.full_name if user else "Unknown",
                bar_council_name=adv.bar_council_name,
                primary_practice=adv.primary_practice,
                in_practice_years=adv.in_practice_years,
                city=adv.city,
                state=adv.state,
                is_verified=True,
                fixed_consultation_fee_inr=float(adv.fixed_consultation_fee_inr) if adv.fixed_consultation_fee_inr else None,
            )
        )

    return {
        "items": [item.model_dump() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
