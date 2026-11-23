"""Dashboard business logic service aggregating case statistics, deadlines, and counsel consultations."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.advocates.models import AdvocateProfile
from app.modules.appointments.models import Appointment
from app.modules.cases.models import CaseMessage, LegalCase
from app.modules.communication.models import Conversation, Message
from app.modules.deadlines.models import Deadline
from app.modules.dashboard.schemas import (
    DashboardAppointmentResponse,
    DashboardDeadlineResponse,
    DashboardRecentCaseResponse,
    DashboardSummaryResponse,
)
from app.modules.users.models import User


class DashboardService:
    """Consolidated dashboard service computing accurate database metrics without in-memory hydration."""

    @staticmethod
    async def get_summary(db: AsyncSession, user: User) -> DashboardSummaryResponse:
        """Calculate dashboard statistics derived solely from the authenticated user's records."""
        now = datetime.now(timezone.utc)

        # 1. Determine role-specific case filter
        if user.role == "ADVOCATE":
            adv_profile = await db.scalar(
                select(AdvocateProfile).where(AdvocateProfile.user_id == user.id)
            )
            if adv_profile:
                case_filter = (LegalCase.lead_advocate_id == adv_profile.id)
            else:
                case_filter = (LegalCase.client_id == user.id)
        elif user.role == "ADMIN":
            case_filter = text("1=1")
        else:  # CITIZEN
            case_filter = (LegalCase.client_id == user.id)

        # 2. Efficient aggregation queries executed directly on PostgreSQL / SQLite
        active_cases_stmt = (
            select(func.count())
            .select_from(LegalCase)
            .where(case_filter, LegalCase.stage != "DISPOSED")
        )
        active_cases = (await db.scalar(active_cases_stmt)) or 0

        pending_cases_stmt = (
            select(func.count())
            .select_from(LegalCase)
            .where(
                case_filter,
                LegalCase.stage.in_(["INTAKE", "COUNSEL_ASSIGNED"]),
            )
        )
        pending_cases = (await db.scalar(pending_cases_stmt)) or 0

        completed_cases_stmt = (
            select(func.count())
            .select_from(LegalCase)
            .where(case_filter, LegalCase.stage == "DISPOSED")
        )
        completed_cases = (await db.scalar(completed_cases_stmt)) or 0

        total_cases_stmt = (
            select(func.count())
            .select_from(LegalCase)
            .where(case_filter)
        )
        total_cases = (await db.scalar(total_cases_stmt)) or 0

        # Unread messages in user's direct chambers conversations and case matters
        unread_direct_stmt = (
            select(func.count())
            .select_from(Message)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(
                or_(
                    Conversation.participant_one_id == user.id,
                    Conversation.participant_two_id == user.id,
                ),
                Message.sender_id != user.id,
                Message.is_read == False,
            )
        )
        unread_direct = (await db.scalar(unread_direct_stmt)) or 0

        unread_msgs_stmt = (
            select(func.count())
            .select_from(CaseMessage)
            .join(LegalCase, CaseMessage.case_id == LegalCase.id)
            .where(case_filter, CaseMessage.sender_id != user.id)
        )
        unread_case = (await db.scalar(unread_msgs_stmt)) or 0
        unread_messages = unread_direct + unread_case

        # Unconfirmed deadlines requiring citizen/advocate review
        unconfirmed_deadlines_stmt = (
            select(func.count())
            .select_from(Deadline)
            .join(LegalCase, Deadline.case_id == LegalCase.id)
            .where(case_filter, Deadline.is_advocate_confirmed == False, Deadline.is_completed == False)
        )
        unconfirmed_deadlines = (await db.scalar(unconfirmed_deadlines_stmt)) or 0

        # Pending appointment bookings requiring action
        pending_appts_stmt = (
            select(func.count())
            .select_from(Appointment)
            .where(Appointment.client_id == user.id, Appointment.status.in_(["PENDING_PAYMENT", "REQUESTED"]))
        )
        pending_appts = (await db.scalar(pending_appts_stmt)) or 0
        pending_actions = unconfirmed_deadlines + pending_appts

        # 3. Retrieve most recent authorized case dossier (LIMIT 1)
        recent_case_stmt = (
            select(LegalCase)
            .where(case_filter)
            .order_by(LegalCase.updated_at.desc())
            .limit(1)
        )
        recent_case_row = await db.scalar(recent_case_stmt)

        recent_case: Optional[DashboardRecentCaseResponse] = None
        if recent_case_row:
            stage_meta = {
                "INTAKE": ("Pre-Filing Intake", 1, 20),
                "COUNSEL_ASSIGNED": ("Counsel Assigned", 2, 40),
                "PLEADINGS": ("Pleadings & Filings", 3, 60),
                "HEARING": ("Hearing Scheduled", 4, 80),
                "DISPOSED": ("Disposed / Concluded", 5, 100),
            }
            stage_name, step, pct = stage_meta.get(
                recent_case_row.stage,
                ("Matter Enrolled", 1, 20),
            )
            recent_case = DashboardRecentCaseResponse(
                id=recent_case_row.id,
                case_reference=recent_case_row.case_reference,
                title=recent_case_row.title,
                category=recent_case_row.legal_issue_category or recent_case_row.practice_group or "General Legal",
                court_forum=recent_case_row.court_forum or recent_case_row.relevant_court or "Jurisdictional Court",
                stage=recent_case_row.stage,
                stage_label=stage_name,
                stage_step=step,
                progress_percentage=pct,
                status="closed" if recent_case_row.stage == "DISPOSED" else "active",
                updated_at=recent_case_row.updated_at,
            )

        # 4. Retrieve upcoming statutory deadlines (LIMIT 3)
        deadlines_stmt = (
            select(Deadline)
            .join(LegalCase, Deadline.case_id == LegalCase.id)
            .where(case_filter, Deadline.is_completed == False)
            .order_by(Deadline.due_date.asc())
            .limit(3)
        )
        deadline_rows = (await db.scalars(deadlines_stmt)).all()

        formatted_deadlines: List[DashboardDeadlineResponse] = []
        for d in deadline_rows:
            due_tz = d.due_date if d.due_date.tzinfo else d.due_date.replace(tzinfo=timezone.utc)
            days = (due_tz.date() - now.date()).days
            formatted_deadlines.append(
                DashboardDeadlineResponse(
                    id=d.id,
                    case_id=d.case_id,
                    title=d.title,
                    date=due_tz.date().isoformat(),
                    due_date=due_tz,
                    days_remaining=days,
                    urgent=days <= 4 or d.priority == "CRITICAL",
                    priority=d.priority,
                    basis=d.statutory_provision or d.source_basis or "Limitation Act, 1963",
                    confirmed=d.is_advocate_confirmed,
                    is_confirmed=d.is_advocate_confirmed,
                )
            )

        next_deadline = formatted_deadlines[0] if formatted_deadlines else None

        # 5. Retrieve upcoming appointment (LIMIT 1)
        upcoming_appt: Optional[DashboardAppointmentResponse] = None
        appt_filter = (Appointment.client_id == user.id)
        if user.role == "ADVOCATE" and adv_profile:
            appt_filter = (Appointment.advocate_id == adv_profile.id)

        appt_row = await db.scalar(
            select(Appointment)
            .where(appt_filter, Appointment.scheduled_start >= now)
            .order_by(Appointment.scheduled_start.asc())
            .limit(1)
        )
        if appt_row:
            advocate_user = await db.scalar(
                select(User)
                .join(AdvocateProfile, AdvocateProfile.user_id == User.id)
                .where(AdvocateProfile.id == appt_row.advocate_id)
            )
            counsel_name = advocate_user.full_name if advocate_user else "Empanelled Counsel"
            upcoming_appt = DashboardAppointmentResponse(
                id=appt_row.id,
                booking_reference=appt_row.booking_reference,
                advocate_name=counsel_name,
                scheduled_start=appt_row.scheduled_start,
                mode=appt_row.mode,
                status=appt_row.status,
            )

        return DashboardSummaryResponse(
            active_cases=active_cases,
            pending_cases=pending_cases,
            completed_cases=completed_cases,
            total_cases=total_cases,
            unread_messages=unread_messages,
            pending_actions=pending_actions,
            activeCases=active_cases,
            unreadMessages=unread_messages,
            pendingActions=pending_actions,
            recent_case=recent_case,
            recentCase=recent_case,
            next_deadline=next_deadline,
            upcoming_deadlines=formatted_deadlines,
            deadlines=formatted_deadlines,
            upcoming_appointment=upcoming_appt,
        )
