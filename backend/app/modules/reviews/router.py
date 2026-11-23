"""Advocate Feedback and Evaluation API Router."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user, get_optional_user, require_roles
from app.modules.reviews.schemas import (
    AdvocateRatingSummaryResponse,
    ReviewCreateRequest,
    ReviewListResponse,
    ReviewModerationRequest,
    ReviewResponse,
    ReviewUpdateRequest,
)
from app.modules.reviews.service import ReviewService
from app.modules.users.models import User

router = APIRouter(prefix="/reviews", tags=["Advocate Evaluations & Reviews"])


@router.post(
    "",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Advocate Evaluation",
    description=(
        "Citizen deposits a verified statutory evaluation for a completed consultation. "
        "Strictly verifies booking ownership, concludes consultation state, and prohibits duplicates."
    ),
)
async def create_review(
    payload: ReviewCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await ReviewService.create_review(
        db=db,
        current_user=current_user,
        payload=payload,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get(
    "/advocates/{advocate_id}",
    response_model=ReviewListResponse,
    summary="List Advocate Reviews",
    description="Retrieve paginated verified evaluations and summary rating metrics for an advocate.",
)
async def list_advocate_reviews(
    advocate_id: uuid.UUID,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    items, total, summary = await ReviewService.list_reviews_for_advocate(
        db=db,
        advocate_id=advocate_id,
        current_user=current_user,
        page=page,
        limit=limit,
    )
    return ReviewListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        summary=summary,
    )


@router.get(
    "/advocates/{advocate_id}/summary",
    response_model=AdvocateRatingSummaryResponse,
    summary="Get Advocate Rating Summary",
    description="Calculates real aggregate rating and star distribution derived from persisted reviews.",
)
async def get_advocate_rating_summary(
    advocate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    return await ReviewService.get_advocate_rating_summary(db=db, advocate_id=advocate_id)


@router.get(
    "/bookings/{booking_id}",
    response_model=ReviewResponse,
    summary="Get Review for Booking",
    description="Retrieve existing evaluation for a specific consultation booking to prevent repeat submissions.",
)
async def get_review_by_booking(
    booking_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await ReviewService.get_review_by_booking(
        db=db,
        booking_id=booking_id,
        current_user=current_user,
    )


@router.get(
    "/{review_id}",
    response_model=ReviewResponse,
    summary="Get Review Details",
    description="Retrieve specific evaluation by ID with role-aware privacy enforcement.",
)
async def get_review(
    review_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    return await ReviewService.get_review_by_id(
        db=db,
        review_id=review_id,
        current_user=current_user,
    )


@router.patch(
    "/{review_id}",
    response_model=ReviewResponse,
    summary="Update Review",
    description="Author updates their previously deposited evaluation.",
)
async def update_review(
    review_id: uuid.UUID,
    payload: ReviewUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await ReviewService.update_review(
        db=db,
        review_id=review_id,
        current_user=current_user,
        payload=payload,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.delete(
    "/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Review",
    description="Author or Administrator deletes an evaluation.",
)
async def delete_review(
    review_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    await ReviewService.delete_review(
        db=db,
        review_id=review_id,
        current_user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return None


@router.post(
    "/{review_id}/moderate",
    response_model=ReviewResponse,
    summary="Moderate Review",
    description="Administrator moderates evaluation status (PENDING, PUBLISHED, REJECTED, HIDDEN).",
)
async def moderate_review(
    review_id: uuid.UUID,
    payload: ReviewModerationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_roles("ADMIN")),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await ReviewService.moderate_review(
        db=db,
        review_id=review_id,
        admin_user=admin_user,
        payload=payload,
        ip_address=ip_address,
        user_agent=user_agent,
    )
