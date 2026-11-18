"""Deadlines and Statutory Limitation API Router."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user
from app.modules.deadlines.schemas import (
    DeadlineConfirmRequest,
    DeadlineCreateRequest,
    DeadlineListResponse,
    DeadlineResponse,
)
from app.modules.deadlines.service import DeadlineService
from app.modules.users.models import User

router = APIRouter(prefix="/deadlines", tags=["Statutory Deadlines & Limitation"])


@router.get("/status", summary="Deadlines Module Status")
async def get_deadlines_status():
    """Diagnostic health status for Deadlines module."""
    return {"module": "deadlines", "status": "initialized", "active": True}


@router.post(
    "",
    response_model=DeadlineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Case Deadline",
    description="Registers a statutory limitation period, court hearing date, or compliance deadline. Validates case ownership.",
)
async def create_deadline(
    payload: DeadlineCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await DeadlineService.create_deadline(
        db=db,
        payload=payload,
        current_user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get(
    "",
    response_model=DeadlineListResponse,
    summary="List Case Deadlines",
    description="Lists deadlines for authenticated user's cases or chamber matters.",
)
async def list_deadlines(
    upcoming_only: bool = Query(False, description="Filter for future pending deadlines"),
    is_completed: Optional[bool] = Query(None, description="Filter by completion status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await DeadlineService.list_deadlines(
        db=db,
        current_user=current_user,
        upcoming_only=upcoming_only,
        is_completed=is_completed,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/cases/{case_id}",
    response_model=DeadlineListResponse,
    summary="List Deadlines for a Specific Case",
    description="Lists all statutory deadlines, court hearings, and compliance reminders associated with a case.",
)
async def list_case_deadlines(
    case_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await DeadlineService.list_deadlines(
        db=db,
        current_user=current_user,
        case_id=case_id,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{deadline_id}",
    response_model=DeadlineResponse,
    summary="Get Deadline Details",
    description="Fetches detailed deadline records including citation basis and notification logs.",
)
async def get_deadline(
    deadline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await DeadlineService.get_deadline(
        db=db,
        deadline_id=deadline_id,
        current_user=current_user,
    )


@router.patch(
    "/{deadline_id}/confirm",
    response_model=DeadlineResponse,
    summary="Advocate Review and Limitation Confirmation",
    description="Allows a verified legal advocate or administrator to review, confirm, and validate the statutory limitation basis.",
)
async def confirm_deadline(
    deadline_id: uuid.UUID,
    payload: DeadlineConfirmRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await DeadlineService.confirm_deadline(
        db=db,
        deadline_id=deadline_id,
        payload=payload,
        current_user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.patch(
    "/{deadline_id}/complete",
    response_model=DeadlineResponse,
    summary="Mark Deadline as Completed",
    description="Marks a deadline, court hearing, or notice expiry reminder as completed.",
)
async def complete_deadline(
    deadline_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await DeadlineService.complete_deadline(
        db=db,
        deadline_id=deadline_id,
        current_user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )
