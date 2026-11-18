"""Appointments and Consultations Management Service."""

from datetime import datetime, timezone
import secrets
from typing import List, Optional, Tuple
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.core.logging import logger
from app.modules.admin.models import AuditLog
from app.modules.advocates.models import AdvocateProfile
from app.modules.appointments.models import Appointment
from app.modules.appointments.schemas import (
    AppointmentCreateRequest,
    AppointmentResponse,
    AppointmentStatusUpdateRequest,
)
from app.modules.cases.models import LegalCase
from app.modules.users.models import User


class AppointmentService:
    """Business logic for consultation booking, conflict detection, and status management."""

    @staticmethod
    def _generate_booking_reference() -> str:
        """Generate human-readable booking code e.g. NYA-BK-2026-9A4F."""
        suffix = secrets.token_hex(2).upper()
        return f"NYA-BK-2026-{suffix}"

    @classmethod
    async def create_appointment(
        cls,
        db: AsyncSession,
        payload: AppointmentCreateRequest,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AppointmentResponse:
        """Citizen books an appointment slot with a verified advocate with conflict prevention."""
        # 1. Validate times
        if payload.scheduled_start >= payload.scheduled_end:
            raise BadRequestException(message="Scheduled start time must precede scheduled end time.")

        now_utc = datetime.now(timezone.utc)
        start_utc = payload.scheduled_start if payload.scheduled_start.tzinfo else payload.scheduled_start.replace(tzinfo=timezone.utc)
        if start_utc <= now_utc:
            raise BadRequestException(message="Appointment start time must be in the future.")

        # 2. Validate Advocate existence and VERIFIED status
        adv_res = await db.execute(
            select(AdvocateProfile, User)
            .join(User, AdvocateProfile.user_id == User.id)
            .where(AdvocateProfile.id == payload.advocate_id)
        )
        adv_tuple = adv_res.first()
        if not adv_tuple:
            raise NotFoundException(message=f"Advocate profile '{payload.advocate_id}' not found.")
        adv_profile, adv_user = adv_tuple

        if adv_profile.platform_verification_status != "VERIFIED":
            raise BadRequestException(message="Appointments can only be scheduled with platform-verified advocates.")

        # 3. Check for Scheduling Conflicts (Prevent overlapping appointments)
        conflict_query = (
            select(Appointment)
            .where(
                Appointment.advocate_id == payload.advocate_id,
                Appointment.status.in_(["REQUESTED", "SCHEDULED", "CONFIRMED"]),
                Appointment.scheduled_start < payload.scheduled_end,
                Appointment.scheduled_end > payload.scheduled_start,
            )
        )
        conflict_res = await db.execute(conflict_query)
        if conflict_res.scalar_one_or_none():
            raise ConflictException(
                message="The advocate has an existing consultation or pending request during this time slot. Please choose another time."
            )

        # 4. Check case ownership if case_id provided
        if payload.case_id:
            case_res = await db.execute(select(LegalCase).where(LegalCase.id == payload.case_id))
            case = case_res.scalar_one_or_none()
            if not case:
                raise NotFoundException(message=f"Case with ID '{payload.case_id}' not found.")
            if current_user.role == "CITIZEN" and case.client_id != current_user.id:
                raise ForbiddenException(message="Access forbidden: You do not own the linked case.")

        # 5. Determine fee
        fee = payload.fee_inr
        if fee is None:
            fee = float(adv_profile.fixed_consultation_fee_inr) if adv_profile.fixed_consultation_fee_inr else 1500.0

        # 6. Generate booking reference
        ref_code = cls._generate_booking_reference()
        for _ in range(5):
            existing = await db.execute(select(Appointment).where(Appointment.booking_reference == ref_code))
            if not existing.scalar_one_or_none():
                break
            ref_code = cls._generate_booking_reference()

        meeting_link = f"https://meet.nyayasetu.gov.in/room/{ref_code}" if payload.mode == "VIDEO_CONFERENCE" else None

        appointment = Appointment(
            booking_reference=ref_code,
            case_id=payload.case_id,
            advocate_id=adv_profile.id,
            client_id=current_user.id,
            scheduled_start=payload.scheduled_start,
            scheduled_end=payload.scheduled_end,
            timezone=payload.timezone,
            status="REQUESTED",
            mode=payload.mode,
            meeting_link=meeting_link,
            fee_inr=fee,
            payment_status="PENDING",
            client_notes=payload.client_notes,
        )
        db.add(appointment)
        await db.flush()

        # 7. Audit log
        audit = AuditLog(
            actor_id=current_user.id,
            action="APPOINTMENT_REQUESTED",
            entity_type="appointments",
            entity_id=str(appointment.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "booking_reference": appointment.booking_reference,
                "advocate_id": str(adv_profile.id),
                "scheduled_start": str(appointment.scheduled_start),
                "fee_inr": fee,
            },
        )
        db.add(audit)
        await db.commit()
        await db.refresh(appointment)

        return AppointmentResponse(
            id=appointment.id,
            booking_reference=appointment.booking_reference,
            case_id=appointment.case_id,
            advocate_id=appointment.advocate_id,
            advocate_name=adv_user.full_name,
            client_id=appointment.client_id,
            client_name=current_user.full_name,
            scheduled_start=appointment.scheduled_start,
            scheduled_end=appointment.scheduled_end,
            timezone=appointment.timezone,
            status=appointment.status,
            mode=appointment.mode,
            meeting_link=appointment.meeting_link,
            fee_inr=float(appointment.fee_inr),
            payment_status=appointment.payment_status,
            client_notes=appointment.client_notes,
            rejection_reason=appointment.rejection_reason,
            created_at=appointment.created_at,
            updated_at=appointment.updated_at,
        )

    @classmethod
    async def update_status(
        cls,
        db: AsyncSession,
        appointment_id: uuid.UUID,
        payload: AppointmentStatusUpdateRequest,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AppointmentResponse:
        """Advocate accepts or rejects an appointment request."""
        res = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
        app = res.scalar_one_or_none()
        if not app:
            raise NotFoundException(message=f"Appointment '{appointment_id}' not found.")

        # Permissions: only the assigned advocate or Admin can accept/reject
        if current_user.role == "ADVOCATE":
            adv_res = await db.execute(
                select(AdvocateProfile.id).where(AdvocateProfile.user_id == current_user.id)
            )
            adv_id = adv_res.scalar_one_or_none()
            if not adv_id or app.advocate_id != adv_id:
                raise ForbiddenException(message="Access forbidden: You are not the assigned advocate for this appointment.")
        elif current_user.role != "ADMIN":
            raise ForbiddenException(message="Only the assigned advocate or platform admin can update appointment status.")

        app.status = payload.status
        if payload.rejection_reason:
            app.rejection_reason = payload.rejection_reason
        if payload.meeting_link:
            app.meeting_link = payload.meeting_link

        audit = AuditLog(
            actor_id=current_user.id,
            action="APPOINTMENT_STATUS_UPDATED",
            entity_type="appointments",
            entity_id=str(app.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={"status": app.status, "rejection_reason": app.rejection_reason},
        )
        db.add(audit)
        await db.commit()
        await db.refresh(app)

        return await cls.get_appointment_by_id(db, app.id, current_user)

    @classmethod
    async def get_appointment_by_id(
        cls,
        db: AsyncSession,
        appointment_id: uuid.UUID,
        current_user: User,
    ) -> AppointmentResponse:
        """Fetch appointment details with permission check."""
        res = await db.execute(
            select(Appointment, User)
            .join(User, Appointment.client_id == User.id)
            .where(Appointment.id == appointment_id)
        )
        row = res.first()
        if not row:
            raise NotFoundException(message=f"Appointment '{appointment_id}' not found.")
        app, client_user = row

        # Fetch advocate name
        adv_res = await db.execute(
            select(User.full_name, AdvocateProfile.user_id)
            .join(AdvocateProfile, AdvocateProfile.user_id == User.id)
            .where(AdvocateProfile.id == app.advocate_id)
        )
        adv_row = adv_res.first()
        adv_name = adv_row[0] if adv_row else "Assigned Counsel"
        adv_user_id = adv_row[1] if adv_row else None

        # Verify access
        if current_user.role == "CITIZEN" and app.client_id != current_user.id:
            raise ForbiddenException(message="Access forbidden: You do not own this appointment.")
        elif current_user.role == "ADVOCATE" and current_user.id != adv_user_id:
            raise ForbiddenException(message="Access forbidden: You are not the assigned advocate for this appointment.")

        return AppointmentResponse(
            id=app.id,
            booking_reference=app.booking_reference,
            case_id=app.case_id,
            advocate_id=app.advocate_id,
            advocate_name=adv_name,
            client_id=app.client_id,
            client_name=client_user.full_name,
            scheduled_start=app.scheduled_start,
            scheduled_end=app.scheduled_end,
            timezone=app.timezone,
            status=app.status,
            mode=app.mode,
            meeting_link=app.meeting_link,
            fee_inr=float(app.fee_inr),
            payment_status=app.payment_status,
            client_notes=app.client_notes,
            rejection_reason=app.rejection_reason,
            created_at=app.created_at,
            updated_at=app.updated_at,
        )

    @classmethod
    async def list_appointments(
        cls,
        db: AsyncSession,
        current_user: User,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[AppointmentResponse], int]:
        """List appointments with role-based visibility."""
        offset = (page - 1) * limit
        query = select(Appointment)
        count_query = select(func.count(Appointment.id))

        if current_user.role == "CITIZEN":
            query = query.where(Appointment.client_id == current_user.id)
            count_query = count_query.where(Appointment.client_id == current_user.id)
        elif current_user.role == "ADVOCATE":
            adv_res = await db.execute(
                select(AdvocateProfile.id).where(AdvocateProfile.user_id == current_user.id)
            )
            adv_id = adv_res.scalar_one_or_none()
            if not adv_id:
                return [], 0
            query = query.where(Appointment.advocate_id == adv_id)
            count_query = count_query.where(Appointment.advocate_id == adv_id)
        # ADMIN sees all

        total_res = await db.execute(count_query)
        total = total_res.scalar() or 0

        query = query.order_by(Appointment.scheduled_start.desc()).offset(offset).limit(limit)
        items_res = await db.execute(query)
        raw_items = items_res.scalars().all()

        responses: List[AppointmentResponse] = []
        for app in raw_items:
            # Client name
            c_res = await db.execute(select(User.full_name).where(User.id == app.client_id))
            c_name = c_res.scalar_one_or_none()

            # Adv name
            a_res = await db.execute(
                select(User.full_name)
                .join(AdvocateProfile, AdvocateProfile.user_id == User.id)
                .where(AdvocateProfile.id == app.advocate_id)
            )
            a_name = a_res.scalar_one_or_none()

            responses.append(
                AppointmentResponse(
                    id=app.id,
                    booking_reference=app.booking_reference,
                    case_id=app.case_id,
                    advocate_id=app.advocate_id,
                    advocate_name=a_name,
                    client_id=app.client_id,
                    client_name=c_name,
                    scheduled_start=app.scheduled_start,
                    scheduled_end=app.scheduled_end,
                    timezone=app.timezone,
                    status=app.status,
                    mode=app.mode,
                    meeting_link=app.meeting_link,
                    fee_inr=float(app.fee_inr),
                    payment_status=app.payment_status,
                    client_notes=app.client_notes,
                    rejection_reason=app.rejection_reason,
                    created_at=app.created_at,
                    updated_at=app.updated_at,
                )
            )

        return responses, total
