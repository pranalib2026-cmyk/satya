"""Advocate Matching and Consultation Request Service."""

import secrets
import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import BadRequestException, ForbiddenException, NotFoundException
from app.core.logging import logger
from app.modules.admin.models import AuditLog
from app.modules.advocates.models import AdvocateProfile
from app.modules.cases.models import LegalCase
from app.modules.matching.engine import get_matching_engine
from app.modules.matching.schemas import (
    AdvocateMatchItem,
    CaseMatchingResponse,
    ConsultationRequestCreate,
    ConsultationRequestResponse,
)
from app.modules.triage.models import ConsultationRequest
from app.modules.users.models import User


class MatchingService:
    """Business logic for case-driven advocate matching and private consultation requests."""

    @staticmethod
    def _generate_consultation_reference() -> str:
        """Generate unique reference code e.g. NYA-2026-CR-8A4F."""
        suffix = secrets.token_hex(2).upper()
        return f"NYA-2026-CR-{suffix}"

    @classmethod
    async def match_advocates_for_case(
        cls,
        db: AsyncSession,
        case_id: uuid.UUID,
        current_user: User,
        max_distance_km: Optional[float] = None,
        max_budget_inr: Optional[float] = None,
        preferred_language: Optional[str] = None,
        limit: int = 10,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> CaseMatchingResponse:
        """Match platform-verified advocates against case requirements with multi-factor scoring."""
        # 1. Fetch Case and verify client ownership
        case_res = await db.execute(select(LegalCase).where(LegalCase.id == case_id))
        case = case_res.scalar_one_or_none()

        if not case:
            raise NotFoundException(
                message=f"Case with ID '{case_id}' was not found.",
                details={"case_id": str(case_id)},
            )

        # Enforce client ownership
        if current_user.role == "CITIZEN" and case.client_id != current_user.id:
            raise ForbiddenException(
                message="Access forbidden: You do not have permission to view matches for this case.",
                details={"case_id": str(case_id)},
            )

        # 2. Fetch all VERIFIED advocates with active user accounts
        query = (
            select(AdvocateProfile, User)
            .join(User, AdvocateProfile.user_id == User.id)
            .where(
                AdvocateProfile.platform_verification_status == "VERIFIED",
                User.is_active == True,
            )
        )
        candidates_res = await db.execute(query)
        candidates = candidates_res.all()

        engine = get_matching_engine()
        client_coords = engine.resolve_case_coordinates(case)

        matches: List[AdvocateMatchItem] = []
        for adv_profile, adv_user in candidates:
            match_item = engine.evaluate_candidate(
                case=case,
                advocate=adv_profile,
                advocate_user=adv_user,
                client_coords=client_coords,
                max_budget_inr=max_budget_inr,
                max_distance_km=max_distance_km,
                preferred_language=preferred_language,
            )
            if match_item is not None:
                matches.append(match_item)

        # 3. Rank matches strictly by objective match score percentage (Descending)
        matches.sort(key=lambda m: m.match_score_percentage, reverse=True)
        top_matches = matches[:limit]

        # 4. Audit matching query
        audit = AuditLog(
            actor_id=current_user.id,
            action="ADVOCATE_MATCHING_EXECUTED",
            entity_type="legal_cases",
            entity_id=str(case.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "case_reference": case.case_reference,
                "category": case.legal_issue_category,
                "total_verified_evaluated": len(candidates),
                "matches_returned": len(top_matches),
                "applied_filters": {
                    "max_distance_km": max_distance_km,
                    "max_budget_inr": max_budget_inr,
                    "preferred_language": preferred_language,
                },
            },
        )
        db.add(audit)
        await db.commit()

        logger.info(
            f"Matching executed for case {case.case_reference}: {len(top_matches)} matches found out of {len(candidates)} candidates"
        )

        return CaseMatchingResponse(
            case_id=case.id,
            case_reference=case.case_reference,
            case_title=case.title,
            category=case.legal_issue_category or case.practice_group or "General Dispute",
            state=case.state,
            district=case.district,
            total_candidates_evaluated=len(candidates),
            total_matches_returned=len(top_matches),
            matches=top_matches,
        )

    @classmethod
    async def create_consultation_request(
        cls,
        db: AsyncSession,
        current_user: User,
        payload: ConsultationRequestCreate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ConsultationRequestResponse:
        """Create a private consultation request for a matched, verified advocate."""
        # 1. Verify targeted advocate exists and is VERIFIED
        adv_res = await db.execute(
            select(AdvocateProfile, User)
            .join(User, AdvocateProfile.user_id == User.id)
            .where(AdvocateProfile.id == payload.targeted_advocate_id)
        )
        adv_tuple = adv_res.first()
        if not adv_tuple:
            raise NotFoundException(
                message=f"Targeted advocate profile '{payload.targeted_advocate_id}' not found.",
                details={"advocate_id": str(payload.targeted_advocate_id)},
            )
        adv_profile, adv_user = adv_tuple

        if adv_profile.platform_verification_status != "VERIFIED":
            raise BadRequestException(
                message="Consultation requests can only be sent to platform-verified advocates.",
                details={"verification_status": adv_profile.platform_verification_status},
            )

        # 2. Check and load linked case if provided
        case_ref_text = None
        legal_summary = payload.legal_problem_summary
        practice = payload.preferred_practice
        urgency = payload.urgency or "standard-30d"
        adverse_parties = payload.adverse_party_names or "None disclosed"

        if payload.case_id:
            case_res = await db.execute(select(LegalCase).where(LegalCase.id == payload.case_id))
            case = case_res.scalar_one_or_none()
            if not case:
                raise NotFoundException(message=f"Linked case '{payload.case_id}' was not found.")
            if current_user.role == "CITIZEN" and case.client_id != current_user.id:
                raise ForbiddenException(message="Access forbidden: You do not own the linked case.")

            case_ref_text = case.case_reference
            if not legal_summary:
                legal_summary = case.problem_description or case.summary
            if not practice:
                practice = case.legal_issue_category or case.practice_group
            if not payload.urgency:
                urgency = case.urgency
            if not payload.adverse_party_names and case.adverse_parties:
                adverse_parties = case.adverse_parties

        if not legal_summary:
            legal_summary = "Client requesting initial legal assessment and advisory."
        if not practice:
            practice = adv_profile.primary_practice

        # 3. Generate unique consultation reference
        ref_code = cls._generate_consultation_reference()
        for _ in range(5):
            existing = await db.execute(
                select(ConsultationRequest).where(ConsultationRequest.reference_code == ref_code)
            )
            if not existing.scalar_one_or_none():
                break
            ref_code = cls._generate_consultation_reference()

        triage_meta = {
            "case_id": str(payload.case_id) if payload.case_id else None,
            "case_reference": case_ref_text,
            "budget_inr": payload.budget_inr,
            "client_notes": payload.notes,
        }

        consultation = ConsultationRequest(
            reference_code=ref_code,
            client_id=current_user.id,
            targeted_advocate_id=adv_profile.id,
            preferred_practice=practice,
            urgency=urgency,
            legal_problem_summary=legal_summary,
            adverse_party_names=adverse_parties,
            status="SUBMITTED",
            source_screen="ADVOCATE_MATCHING_MODAL",
            non_confidential_acknowledged=True,
            triage_notes_json=triage_meta,
        )

        db.add(consultation)
        await db.flush()

        # 4. Audit Log
        audit = AuditLog(
            actor_id=current_user.id,
            action="CONSULTATION_REQUEST_SUBMITTED",
            entity_type="consultation_requests",
            entity_id=str(consultation.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "reference_code": consultation.reference_code,
                "targeted_advocate_id": str(adv_profile.id),
                "advocate_name": adv_user.full_name,
                "budget_inr": payload.budget_inr,
                "urgency": consultation.urgency,
            },
        )
        db.add(audit)
        await db.commit()
        await db.refresh(consultation)

        return ConsultationRequestResponse(
            id=consultation.id,
            reference_code=consultation.reference_code,
            client_id=consultation.client_id,
            targeted_advocate_id=consultation.targeted_advocate_id,
            targeted_advocate_name=adv_user.full_name,
            preferred_practice=consultation.preferred_practice,
            urgency=consultation.urgency,
            legal_problem_summary=consultation.legal_problem_summary,
            adverse_party_names=consultation.adverse_party_names,
            status=consultation.status,
            source_screen=consultation.source_screen,
            budget_inr=payload.budget_inr,
            triage_notes_json=consultation.triage_notes_json,
            created_at=consultation.created_at,
            updated_at=consultation.updated_at,
        )

    @classmethod
    async def list_consultation_requests(
        cls,
        db: AsyncSession,
        current_user: User,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[ConsultationRequestResponse], int]:
        """List consultation requests with role-based visibility."""
        offset = (page - 1) * limit
        query = select(ConsultationRequest)
        count_query = select(func.count(ConsultationRequest.id))

        if current_user.role == "CITIZEN":
            query = query.where(ConsultationRequest.client_id == current_user.id)
            count_query = count_query.where(ConsultationRequest.client_id == current_user.id)
        elif current_user.role == "ADVOCATE":
            adv_res = await db.execute(
                select(AdvocateProfile.id).where(AdvocateProfile.user_id == current_user.id)
            )
            adv_id = adv_res.scalar_one_or_none()
            if not adv_id:
                return [], 0
            query = query.where(ConsultationRequest.targeted_advocate_id == adv_id)
            count_query = count_query.where(ConsultationRequest.targeted_advocate_id == adv_id)
        # ADMIN sees all

        total_res = await db.execute(count_query)
        total = total_res.scalar() or 0

        query = query.order_by(ConsultationRequest.created_at.desc()).offset(offset).limit(limit)
        items_res = await db.execute(query)
        raw_items = items_res.scalars().all()

        items: List[ConsultationRequestResponse] = []
        for cr in raw_items:
            # Fetch targeted advocate name if present
            adv_name = None
            if cr.targeted_advocate_id:
                name_res = await db.execute(
                    select(User.full_name)
                    .join(AdvocateProfile, AdvocateProfile.user_id == User.id)
                    .where(AdvocateProfile.id == cr.targeted_advocate_id)
                )
                adv_name = name_res.scalar_one_or_none()

            budget = None
            if cr.triage_notes_json and "budget_inr" in cr.triage_notes_json:
                budget = cr.triage_notes_json["budget_inr"]

            items.append(
                ConsultationRequestResponse(
                    id=cr.id,
                    reference_code=cr.reference_code,
                    client_id=cr.client_id,
                    targeted_advocate_id=cr.targeted_advocate_id,
                    targeted_advocate_name=adv_name,
                    preferred_practice=cr.preferred_practice,
                    urgency=cr.urgency,
                    legal_problem_summary=cr.legal_problem_summary,
                    adverse_party_names=cr.adverse_party_names,
                    status=cr.status,
                    source_screen=cr.source_screen,
                    budget_inr=budget,
                    triage_notes_json=cr.triage_notes_json,
                    created_at=cr.created_at,
                    updated_at=cr.updated_at,
                )
            )

        return items, total
