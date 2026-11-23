"""Advocate Evaluation and Client Review Service."""

from collections import Counter
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.core.logging import logger
from app.modules.admin.models import AuditLog
from app.modules.advocates.models import AdvocateProfile
from app.modules.appointments.models import Appointment
from app.modules.reviews.models import Review
from app.modules.reviews.schemas import (
    AdvocateRatingSummaryResponse,
    ReviewCreateRequest,
    ReviewModerationRequest,
    ReviewResponse,
    ReviewUpdateRequest,
)
from app.modules.users.models import User


def utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)


class ReviewService:
    """Business logic for verified advocate feedback, rating computation, and moderation."""

    @classmethod
    async def create_review(
        cls,
        db: AsyncSession,
        current_user: User,
        payload: ReviewCreateRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ReviewResponse:
        """Citizen records a verified evaluation for an attended, completed consultation."""
        # 1. Fetch referenced consultation booking
        booking_stmt = (
            select(Appointment)
            .options(
                selectinload(Appointment.advocate).selectinload(AdvocateProfile.user),
                selectinload(Appointment.client),
            )
            .where(Appointment.id == payload.booking_id)
        )
        booking = (await db.execute(booking_stmt)).scalar_one_or_none()
        if not booking:
            raise NotFoundException(
                message=f"Consultation booking '{payload.booking_id}' not found."
            )

        # 2. Verify booking ownership (strictly citizen who booked)
        if booking.client_id != current_user.id:
            raise ForbiddenException(
                message="Access denied. You are not authorized to evaluate another citizen's consultation session."
            )

        # 3. Verify booking is in COMPLETED state
        if booking.status != "COMPLETED":
            raise BadRequestException(
                message=(
                    f"Evaluations are only permitted for concluded consultations. "
                    f"Current booking status is '{booking.status}'."
                )
            )

        # 4. Enforce strict single review per booking (no duplicates)
        existing_stmt = select(Review).where(Review.booking_id == booking.id)
        existing = (await db.execute(existing_stmt)).scalar_one_or_none()
        if existing:
            raise ConflictException(
                message="An evaluation has already been deposited for this consultation booking."
            )

        # 5. Instantiate review deriving reviewer and advocate from the booking
        now = utc_now()
        review = Review(
            booking_id=booking.id,
            reviewer_id=current_user.id,
            advocate_id=booking.advocate_id,
            rating=payload.rating,
            comment=payload.comment,
            tags=payload.tags or [],
            matter_resolution=payload.matter_resolution,
            status="PUBLISHED",
            created_at=now,
            updated_at=now,
        )
        db.add(review)

        # 6. Immutable audit log
        audit = AuditLog(
            actor_id=current_user.id,
            action="ADVOCATE_REVIEW_SUBMITTED",
            entity_type="reviews",
            entity_id=str(review.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "booking_id": str(booking.id),
                "advocate_id": str(booking.advocate_id),
                "rating": payload.rating,
                "status": "PUBLISHED",
                "submitted_at": now.isoformat(),
            },
        )
        db.add(audit)

        await db.commit()
        await db.refresh(review)

        return await cls.format_review_response(db, review)

    @classmethod
    async def get_review_by_id(
        cls,
        db: AsyncSession,
        review_id: uuid.UUID,
        current_user: Optional[User] = None,
    ) -> ReviewResponse:
        """Fetch single evaluation with role-aware privacy enforcement."""
        review_stmt = (
            select(Review)
            .options(
                selectinload(Review.reviewer),
                selectinload(Review.advocate).selectinload(AdvocateProfile.user),
            )
            .where(Review.id == review_id)
        )
        review = (await db.execute(review_stmt)).scalar_one_or_none()
        if not review:
            raise NotFoundException(message=f"Evaluation review '{review_id}' not found.")

        # If review is non-published (HIDDEN/REJECTED), only author, advocate, or admin can view
        if review.status in ("HIDDEN", "REJECTED"):
            is_authorized = (
                current_user
                and (
                    current_user.role == "ADMIN"
                    or review.reviewer_id == current_user.id
                    or (review.advocate and review.advocate.user_id == current_user.id)
                )
            )
            if not is_authorized:
                raise NotFoundException(message=f"Evaluation review '{review_id}' not found.")

        return await cls.format_review_response(db, review)

    @classmethod
    async def get_review_by_booking(
        cls,
        db: AsyncSession,
        booking_id: uuid.UUID,
        current_user: User,
    ) -> ReviewResponse:
        """Retrieve evaluation deposited for a specific consultation booking."""
        review_stmt = (
            select(Review)
            .options(
                selectinload(Review.reviewer),
                selectinload(Review.advocate).selectinload(AdvocateProfile.user),
            )
            .where(Review.booking_id == booking_id)
        )
        review = (await db.execute(review_stmt)).scalar_one_or_none()
        if not review:
            raise NotFoundException(
                message=f"No evaluation exists for consultation booking '{booking_id}'."
            )

        # Allow access if citizen is owner, evaluated advocate, or admin
        is_allowed = (
            current_user.role == "ADMIN"
            or review.reviewer_id == current_user.id
            or (review.advocate and review.advocate.user_id == current_user.id)
        )
        if not is_allowed:
            raise ForbiddenException(
                message="Access denied to evaluation for another citizen's booking."
            )

        return await cls.format_review_response(db, review)

    @classmethod
    async def list_reviews_for_advocate(
        cls,
        db: AsyncSession,
        advocate_id: uuid.UUID,
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[ReviewResponse], int, AdvocateRatingSummaryResponse]:
        """Retrieve paginated published evaluations and aggregated scoring metrics for an advocate."""
        # 1. Verify advocate profile exists
        adv_stmt = (
            select(AdvocateProfile)
            .where(AdvocateProfile.id == advocate_id)
        )
        advocate = (await db.execute(adv_stmt)).scalar_one_or_none()
        if not advocate:
            raise NotFoundException(message=f"Advocate profile '{advocate_id}' not found.")

        # 2. Build status filter (public views only see PUBLISHED; admin/advocate self see all)
        is_privileged = (
            current_user
            and (current_user.role == "ADMIN" or advocate.user_id == current_user.id)
        )
        status_filter = Review.status.in_(["PUBLISHED", "PENDING", "HIDDEN", "REJECTED"]) if is_privileged else (Review.status == "PUBLISHED")

        # 3. Paginated query
        total_stmt = (
            select(func.count())
            .select_from(Review)
            .where(Review.advocate_id == advocate_id, status_filter)
        )
        total = (await db.scalar(total_stmt)) or 0

        offset = (page - 1) * limit
        reviews_stmt = (
            select(Review)
            .options(
                selectinload(Review.reviewer),
                selectinload(Review.advocate).selectinload(AdvocateProfile.user),
            )
            .where(Review.advocate_id == advocate_id, status_filter)
            .order_by(Review.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        reviews = (await db.execute(reviews_stmt)).scalars().all()

        formatted_items = [await cls.format_review_response(db, r) for r in reviews]

        # 4. Calculate real aggregate rating metrics
        summary = await cls.get_advocate_rating_summary(db, advocate_id)

        return formatted_items, total, summary

    @classmethod
    async def get_advocate_rating_summary(
        cls,
        db: AsyncSession,
        advocate_id: uuid.UUID,
    ) -> AdvocateRatingSummaryResponse:
        """Calculate real advocate rating and star breakdown from eligible PUBLISHED reviews."""
        # Only PUBLISHED reviews count towards public ratings
        agg_stmt = (
            select(
                func.coalesce(func.avg(Review.rating), 0.0),
                func.count(Review.id),
            )
            .where(Review.advocate_id == advocate_id, Review.status == "PUBLISHED")
        )
        res = (await db.execute(agg_stmt)).one()
        raw_avg, review_count = float(res[0]), int(res[1])
        average_rating = round(raw_avg, 1) if review_count > 0 else 0.0

        # Star breakdown (1 through 5)
        dist_stmt = (
            select(Review.rating, func.count(Review.id))
            .where(Review.advocate_id == advocate_id, Review.status == "PUBLISHED")
            .group_by(Review.rating)
        )
        dist_rows = (await db.execute(dist_stmt)).all()
        dist_map = {str(i): 0 for i in range(1, 6)}
        for score, cnt in dist_rows:
            dist_map[str(score)] = int(cnt)

        # Most frequent counsel strength tags
        tags_stmt = (
            select(Review.tags)
            .where(Review.advocate_id == advocate_id, Review.status == "PUBLISHED")
        )
        tag_lists = (await db.execute(tags_stmt)).scalars().all()
        tag_counter: Counter = Counter()
        for t_list in tag_lists:
            if isinstance(t_list, list):
                for t in t_list:
                    if t and isinstance(t, str):
                        tag_counter[t.strip()] += 1

        top_tags = [tag for tag, _ in tag_counter.most_common(5)]

        return AdvocateRatingSummaryResponse(
            advocate_id=advocate_id,
            average_rating=average_rating,
            review_count=review_count,
            star_distribution=dist_map,
            top_tags=top_tags,
        )

    @classmethod
    async def update_review(
        cls,
        db: AsyncSession,
        review_id: uuid.UUID,
        current_user: User,
        payload: ReviewUpdateRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ReviewResponse:
        """Author or Administrator updates their submitted evaluation."""
        review_stmt = (
            select(Review)
            .options(
                selectinload(Review.reviewer),
                selectinload(Review.advocate).selectinload(AdvocateProfile.user),
            )
            .where(Review.id == review_id)
        )
        review = (await db.execute(review_stmt)).scalar_one_or_none()
        if not review:
            raise NotFoundException(message=f"Evaluation review '{review_id}' not found.")

        # Enforce edit ownership
        if review.reviewer_id != current_user.id and current_user.role != "ADMIN":
            raise ForbiddenException(
                message="You do not have permission to modify this evaluation."
            )

        if payload.rating is not None:
            review.rating = payload.rating
        if payload.comment is not None:
            review.comment = payload.comment.strip() if payload.comment.strip() else None
        if payload.tags is not None:
            review.tags = payload.tags
        if payload.matter_resolution is not None:
            review.matter_resolution = payload.matter_resolution

        review.updated_at = utc_now()

        audit = AuditLog(
            actor_id=current_user.id,
            action="ADVOCATE_REVIEW_UPDATED",
            entity_type="reviews",
            entity_id=str(review.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "rating": review.rating,
                "updated_at": review.updated_at.isoformat(),
            },
        )
        db.add(audit)

        await db.commit()
        await db.refresh(review)
        return await cls.format_review_response(db, review)

    @classmethod
    async def delete_review(
        cls,
        db: AsyncSession,
        review_id: uuid.UUID,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        """Author or Administrator deletes an evaluation."""
        review_stmt = select(Review).where(Review.id == review_id)
        review = (await db.execute(review_stmt)).scalar_one_or_none()
        if not review:
            raise NotFoundException(message=f"Evaluation review '{review_id}' not found.")

        # Enforce delete authorization
        if review.reviewer_id != current_user.id and current_user.role != "ADMIN":
            raise ForbiddenException(
                message="You do not have permission to delete this evaluation."
            )

        audit = AuditLog(
            actor_id=current_user.id,
            action="ADVOCATE_REVIEW_DELETED",
            entity_type="reviews",
            entity_id=str(review.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "booking_id": str(review.booking_id),
                "advocate_id": str(review.advocate_id),
                "deleted_at": utc_now().isoformat(),
            },
        )
        db.add(audit)
        await db.delete(review)
        await db.commit()

    @classmethod
    async def moderate_review(
        cls,
        db: AsyncSession,
        review_id: uuid.UUID,
        admin_user: User,
        payload: ReviewModerationRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ReviewResponse:
        """Administrative moderation of published evaluations under Bar Council compliance."""
        if admin_user.role != "ADMIN":
            raise ForbiddenException(message="Administrator privileges required to moderate evaluations.")

        review_stmt = (
            select(Review)
            .options(
                selectinload(Review.reviewer),
                selectinload(Review.advocate).selectinload(AdvocateProfile.user),
            )
            .where(Review.id == review_id)
        )
        review = (await db.execute(review_stmt)).scalar_one_or_none()
        if not review:
            raise NotFoundException(message=f"Evaluation review '{review_id}' not found.")

        review.status = payload.status
        review.moderation_reason = payload.moderation_reason
        review.updated_at = utc_now()

        audit = AuditLog(
            actor_id=admin_user.id,
            action="ADVOCATE_REVIEW_MODERATED",
            entity_type="reviews",
            entity_id=str(review.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "status": review.status,
                "moderation_reason": review.moderation_reason,
                "moderated_at": review.updated_at.isoformat(),
            },
        )
        db.add(audit)

        await db.commit()
        await db.refresh(review)
        return await cls.format_review_response(db, review)

    @classmethod
    async def format_review_response(
        cls,
        db: AsyncSession,
        review: Review,
    ) -> ReviewResponse:
        """Format Review model into public/authenticated response schema."""
        reviewer_name = "Verified Citizen"
        if review.reviewer:
            reviewer_name = review.reviewer.full_name
        else:
            u = await db.scalar(select(User).where(User.id == review.reviewer_id))
            if u:
                reviewer_name = u.full_name

        advocate_name = "Advocate"
        if review.advocate and review.advocate.user:
            advocate_name = review.advocate.user.full_name
        else:
            adv = await db.scalar(
                select(AdvocateProfile)
                .options(selectinload(AdvocateProfile.user))
                .where(AdvocateProfile.id == review.advocate_id)
            )
            if adv and adv.user:
                advocate_name = adv.user.full_name

        return ReviewResponse(
            id=review.id,
            booking_id=review.booking_id,
            reviewer_id=review.reviewer_id,
            reviewer_name=reviewer_name,
            advocate_id=review.advocate_id,
            advocate_name=advocate_name,
            rating=review.rating,
            comment=review.comment,
            tags=review.tags or [],
            matter_resolution=review.matter_resolution,
            status=review.status,
            moderation_reason=review.moderation_reason,
            created_at=review.created_at,
            updated_at=review.updated_at,
        )
