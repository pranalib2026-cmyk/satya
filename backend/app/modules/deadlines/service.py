"""Deadline and Limitation Period Management Service."""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import BadRequestException, ForbiddenException, NotFoundException
from app.core.logging import logger
from app.modules.admin.models import AuditLog
from app.modules.advocates.models import AdvocateProfile
from app.modules.cases.models import LegalCase
from app.modules.deadlines.models import Deadline
from app.modules.deadlines.schemas import (
    DeadlineConfirmRequest,
    DeadlineCreateRequest,
    DeadlineListResponse,
    DeadlineResponse,
)
from app.modules.users.models import User, UserRole


class DeadlineService:
    """Service handling case deadlines, advocate limitation reviews, and reminder tracking."""

    @classmethod
    async def _verify_case_access(
        cls,
        db: AsyncSession,
        case_id: uuid.UUID,
        current_user: User,
    ) -> LegalCase:
        """Verify existence and ensure caller has permission to view/modify the case."""
        stmt = (
            select(LegalCase)
            .options(selectinload(LegalCase.lead_advocate))
            .where(LegalCase.id == case_id)
        )
        res = await db.execute(stmt)
        legal_case = res.scalar_one_or_none()
        if not legal_case:
            raise NotFoundException(message="Legal case not found.")

        if current_user.role == UserRole.ADMIN:
            return legal_case

        if legal_case.client_id == current_user.id:
            return legal_case

        if (
            legal_case.lead_advocate
            and legal_case.lead_advocate.user_id == current_user.id
        ):
            return legal_case

        raise ForbiddenException(message="You do not have authorization to access deadlines for this case.")

    @classmethod
    async def create_deadline(
        cls,
        db: AsyncSession,
        payload: DeadlineCreateRequest,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DeadlineResponse:
        """Create a new deadline or limitation tracking entry."""
        legal_case = await cls._verify_case_access(db, payload.case_id, current_user)

        # Configure notification alerts
        days_before = payload.reminder_days_before or [7, 3, 1]
        scheduled_alerts = []
        due_utc = payload.due_date if payload.due_date.tzinfo else payload.due_date.replace(tzinfo=timezone.utc)
        for days in sorted(days_before, reverse=True):
            alert_dt = due_utc - timedelta(days=days)
            scheduled_alerts.append({
                "days_before": days,
                "scheduled_at": alert_dt.isoformat(),
                "status": "PENDING",
            })

        reminders_data = {
            "days_before": days_before,
            "scheduled_alerts": scheduled_alerts,
            "history": [],
        }

        # Check if creator is already an advocate assigned to case or admin confirming it
        is_advocate_confirmed = False
        confirmed_by_advocate_id = None
        confirmed_at = None

        if current_user.role == UserRole.ADVOCATE:
            adv_res = await db.execute(
                select(AdvocateProfile).where(AdvocateProfile.user_id == current_user.id)
            )
            adv_profile = adv_res.scalar_one_or_none()
            if adv_profile and adv_profile.platform_verification_status == "VERIFIED":
                is_advocate_confirmed = True
                confirmed_by_advocate_id = adv_profile.id
                confirmed_at = datetime.now(timezone.utc)
                reminders_data["history"].append({
                    "action": "CREATED_BY_VERIFIED_ADVOCATE",
                    "actor_id": str(current_user.id),
                    "timestamp": confirmed_at.isoformat(),
                })

        deadline = Deadline(
            case_id=legal_case.id,
            title=payload.title,
            description=payload.description,
            deadline_type=payload.deadline_type.upper(),
            source_basis=payload.source_basis,
            statutory_provision=payload.statutory_provision,
            due_date=payload.due_date,
            priority=payload.priority.upper(),
            is_advocate_confirmed=is_advocate_confirmed,
            confirmed_by_advocate_id=confirmed_by_advocate_id,
            confirmed_at=confirmed_at,
            is_completed=False,
            reminders_json=reminders_data,
        )
        db.add(deadline)
        await db.flush()

        audit = AuditLog(
            actor_id=current_user.id,
            action="DEADLINE_CREATED",
            entity_type="deadlines",
            entity_id=str(deadline.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "case_id": str(legal_case.id),
                "case_reference": legal_case.case_reference,
                "title": deadline.title,
                "due_date": str(deadline.due_date),
                "is_advocate_confirmed": is_advocate_confirmed,
            },
        )
        db.add(audit)
        await db.commit()
        await db.refresh(deadline)

        logger.info(
            f"Created deadline id={deadline.id} for case={legal_case.case_reference} (confirmed={is_advocate_confirmed})"
        )

        return DeadlineResponse(
            id=deadline.id,
            case_id=deadline.case_id,
            case_reference=legal_case.case_reference,
            title=deadline.title,
            description=deadline.description,
            deadline_type=deadline.deadline_type,
            source_basis=deadline.source_basis,
            statutory_provision=deadline.statutory_provision,
            due_date=deadline.due_date,
            priority=deadline.priority,
            is_advocate_confirmed=deadline.is_advocate_confirmed,
            confirmed_by_advocate_id=deadline.confirmed_by_advocate_id,
            confirmed_at=deadline.confirmed_at,
            is_completed=deadline.is_completed,
            completed_at=deadline.completed_at,
            reminders_json=deadline.reminders_json,
            created_at=deadline.created_at,
            updated_at=deadline.updated_at,
        )

    @classmethod
    async def confirm_deadline(
        cls,
        db: AsyncSession,
        deadline_id: uuid.UUID,
        payload: DeadlineConfirmRequest,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DeadlineResponse:
        """Allow a verified legal advocate or administrator to independently review and confirm statutory limitation."""
        if current_user.role not in [UserRole.ADVOCATE, UserRole.ADMIN]:
            raise ForbiddenException(
                message="Only verified legal advocates or administrators can confirm statutory limitation deadlines."
            )

        stmt = (
            select(Deadline)
            .options(selectinload(Deadline.case))
            .where(Deadline.id == deadline_id)
        )
        res = await db.execute(stmt)
        deadline = res.scalar_one_or_none()
        if not deadline:
            raise NotFoundException(message="Deadline not found.")

        confirmed_advocate_id = None
        if current_user.role == UserRole.ADVOCATE:
            adv_res = await db.execute(
                select(AdvocateProfile).where(AdvocateProfile.user_id == current_user.id)
            )
            adv_profile = adv_res.scalar_one_or_none()
            if not adv_profile or adv_profile.platform_verification_status != "VERIFIED":
                raise ForbiddenException(message="Your advocate account must be verified to confirm statutory deadlines.")
            confirmed_advocate_id = adv_profile.id

        now_utc = datetime.now(timezone.utc)
        deadline.is_advocate_confirmed = True
        deadline.confirmed_by_advocate_id = confirmed_advocate_id
        deadline.confirmed_at = now_utc

        if payload.verified_statutory_basis:
            deadline.statutory_provision = payload.verified_statutory_basis

        reminders = dict(deadline.reminders_json or {})
        history = reminders.get("history", [])
        history.append({
            "action": "ADVOCATE_CONFIRMED",
            "actor_id": str(current_user.id),
            "timestamp": now_utc.isoformat(),
            "notes": payload.confirmation_notes,
            "statutory_basis": payload.verified_statutory_basis,
        })
        reminders["history"] = history
        deadline.reminders_json = reminders

        audit = AuditLog(
            actor_id=current_user.id,
            action="DEADLINE_ADVOCATE_CONFIRMED",
            entity_type="deadlines",
            entity_id=str(deadline.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "case_id": str(deadline.case_id),
                "confirmed_by_advocate_id": str(confirmed_advocate_id) if confirmed_advocate_id else None,
                "verified_statutory_basis": payload.verified_statutory_basis,
                "notes": payload.confirmation_notes,
            },
        )
        db.add(audit)
        await db.commit()
        await db.refresh(deadline)

        logger.info(f"Deadline {deadline.id} confirmed by advocate/admin user={current_user.id}")

        return DeadlineResponse(
            id=deadline.id,
            case_id=deadline.case_id,
            case_reference=deadline.case.case_reference if deadline.case else None,
            title=deadline.title,
            description=deadline.description,
            deadline_type=deadline.deadline_type,
            source_basis=deadline.source_basis,
            statutory_provision=deadline.statutory_provision,
            due_date=deadline.due_date,
            priority=deadline.priority,
            is_advocate_confirmed=deadline.is_advocate_confirmed,
            confirmed_by_advocate_id=deadline.confirmed_by_advocate_id,
            confirmed_at=deadline.confirmed_at,
            is_completed=deadline.is_completed,
            completed_at=deadline.completed_at,
            reminders_json=deadline.reminders_json,
            created_at=deadline.created_at,
            updated_at=deadline.updated_at,
        )

    @classmethod
    async def complete_deadline(
        cls,
        db: AsyncSession,
        deadline_id: uuid.UUID,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DeadlineResponse:
        """Mark a deadline or reminder as completed."""
        stmt = (
            select(Deadline)
            .options(selectinload(Deadline.case).selectinload(LegalCase.lead_advocate))
            .where(Deadline.id == deadline_id)
        )
        res = await db.execute(stmt)
        deadline = res.scalar_one_or_none()
        if not deadline:
            raise NotFoundException(message="Deadline not found.")

        # Check access
        await cls._verify_case_access(db, deadline.case_id, current_user)

        now_utc = datetime.now(timezone.utc)
        deadline.is_completed = True
        deadline.completed_at = now_utc

        reminders = dict(deadline.reminders_json or {})
        history = reminders.get("history", [])
        history.append({
            "action": "COMPLETED",
            "actor_id": str(current_user.id),
            "timestamp": now_utc.isoformat(),
        })
        reminders["history"] = history
        deadline.reminders_json = reminders

        audit = AuditLog(
            actor_id=current_user.id,
            action="DEADLINE_COMPLETED",
            entity_type="deadlines",
            entity_id=str(deadline.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "case_id": str(deadline.case_id),
                "completed_at": now_utc.isoformat(),
            },
        )
        db.add(audit)
        await db.commit()
        await db.refresh(deadline)

        logger.info(f"Deadline {deadline.id} marked as completed by user={current_user.id}")

        return DeadlineResponse(
            id=deadline.id,
            case_id=deadline.case_id,
            case_reference=deadline.case.case_reference if deadline.case else None,
            title=deadline.title,
            description=deadline.description,
            deadline_type=deadline.deadline_type,
            source_basis=deadline.source_basis,
            statutory_provision=deadline.statutory_provision,
            due_date=deadline.due_date,
            priority=deadline.priority,
            is_advocate_confirmed=deadline.is_advocate_confirmed,
            confirmed_by_advocate_id=deadline.confirmed_by_advocate_id,
            confirmed_at=deadline.confirmed_at,
            is_completed=deadline.is_completed,
            completed_at=deadline.completed_at,
            reminders_json=deadline.reminders_json,
            created_at=deadline.created_at,
            updated_at=deadline.updated_at,
        )

    @classmethod
    async def get_deadline(
        cls,
        db: AsyncSession,
        deadline_id: uuid.UUID,
        current_user: User,
    ) -> DeadlineResponse:
        """Get deadline details by ID after validating permissions."""
        stmt = (
            select(Deadline)
            .options(selectinload(Deadline.case).selectinload(LegalCase.lead_advocate))
            .where(Deadline.id == deadline_id)
        )
        res = await db.execute(stmt)
        deadline = res.scalar_one_or_none()
        if not deadline:
            raise NotFoundException(message="Deadline not found.")

        await cls._verify_case_access(db, deadline.case_id, current_user)

        return DeadlineResponse(
            id=deadline.id,
            case_id=deadline.case_id,
            case_reference=deadline.case.case_reference if deadline.case else None,
            title=deadline.title,
            description=deadline.description,
            deadline_type=deadline.deadline_type,
            source_basis=deadline.source_basis,
            statutory_provision=deadline.statutory_provision,
            due_date=deadline.due_date,
            priority=deadline.priority,
            is_advocate_confirmed=deadline.is_advocate_confirmed,
            confirmed_by_advocate_id=deadline.confirmed_by_advocate_id,
            confirmed_at=deadline.confirmed_at,
            is_completed=deadline.is_completed,
            completed_at=deadline.completed_at,
            reminders_json=deadline.reminders_json,
            created_at=deadline.created_at,
            updated_at=deadline.updated_at,
        )

    @classmethod
    async def list_deadlines(
        cls,
        db: AsyncSession,
        current_user: User,
        case_id: Optional[uuid.UUID] = None,
        upcoming_only: bool = False,
        is_completed: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> DeadlineListResponse:
        """List deadlines with role-based scoping and filtering."""
        stmt = select(Deadline).options(selectinload(Deadline.case)).join(LegalCase, Deadline.case_id == LegalCase.id)

        if case_id:
            await cls._verify_case_access(db, case_id, current_user)
            stmt = stmt.where(Deadline.case_id == case_id)
        else:
            if current_user.role == UserRole.CITIZEN:
                stmt = stmt.where(LegalCase.client_id == current_user.id)
            elif current_user.role == UserRole.ADVOCATE:
                adv_res = await db.execute(
                    select(AdvocateProfile.id).where(AdvocateProfile.user_id == current_user.id)
                )
                adv_id = adv_res.scalar_one_or_none()
                if adv_id:
                    stmt = stmt.where(
                        (LegalCase.lead_advocate_id == adv_id)
                        | (Deadline.confirmed_by_advocate_id == adv_id)
                    )
                else:
                    return DeadlineListResponse(total=0, items=[])
            # ADMIN sees all

        if is_completed is not None:
            stmt = stmt.where(Deadline.is_completed == is_completed)

        if upcoming_only:
            now_utc = datetime.now(timezone.utc)
            stmt = stmt.where(Deadline.due_date >= now_utc, Deadline.is_completed == False)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one()

        stmt = stmt.order_by(Deadline.due_date.asc()).offset(offset).limit(limit)
        res = await db.execute(stmt)
        deadlines = res.scalars().all()

        items = [
            DeadlineResponse(
                id=d.id,
                case_id=d.case_id,
                case_reference=d.case.case_reference if d.case else None,
                title=d.title,
                description=d.description,
                deadline_type=d.deadline_type,
                source_basis=d.source_basis,
                statutory_provision=d.statutory_provision,
                due_date=d.due_date,
                priority=d.priority,
                is_advocate_confirmed=d.is_advocate_confirmed,
                confirmed_by_advocate_id=d.confirmed_by_advocate_id,
                confirmed_at=d.confirmed_at,
                is_completed=d.is_completed,
                completed_at=d.completed_at,
                reminders_json=d.reminders_json,
                created_at=d.created_at,
                updated_at=d.updated_at,
            )
            for d in deadlines
        ]

        return DeadlineListResponse(total=total, items=items)
