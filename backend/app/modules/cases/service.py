"""Case Intake and Dossier Service."""

import secrets
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException, NotFoundException
from app.core.logging import logger
from app.modules.admin.models import AuditLog
from app.modules.cases.models import LegalCase
from app.modules.cases.schemas import (
    CaseCreateRequest,
    CaseUpdateRequest,
    TriageOutputResponse,
)
from app.modules.triage.engine import get_triage_engine
from app.modules.users.models import User


class CaseService:
    """Business logic for Case Intake, Ownership Enforcement, and Case Triage."""

    @staticmethod
    def _generate_case_reference() -> str:
        """Generate human-readable, unique case reference code e.g. NYA-2026-CS-8421."""
        random_suffix = secrets.token_hex(2).upper()
        return f"NYA-2026-CS-{random_suffix}"

    @classmethod
    async def create_case(
        cls,
        db: AsyncSession,
        current_user: User,
        payload: CaseCreateRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> LegalCase:
        """Create a new case dossier owned by the authenticated citizen and perform initial triage."""
        # Generate unique case reference
        case_ref = cls._generate_case_reference()
        for _ in range(5):
            existing = await db.execute(select(LegalCase).where(LegalCase.case_reference == case_ref))
            if not existing.scalar_one_or_none():
                break
            case_ref = cls._generate_case_reference()

        # Run triage engine on intake payload
        triage_engine = get_triage_engine()
        triage_data = payload.model_dump()
        triage_assessment = triage_engine.evaluate(triage_data)

        # Instantiate case
        new_case = LegalCase(
            case_reference=case_ref,
            client_id=current_user.id,
            title=payload.title,
            problem_description=payload.problem_description,
            legal_issue_category=payload.legal_issue_category,
            state=payload.state,
            district=payload.district,
            relevant_court=payload.relevant_court,
            incident_date=payload.incident_date,
            preferred_language=payload.preferred_language,
            urgency=payload.urgency,
            supporting_info=payload.supporting_info,
            adverse_parties=payload.adverse_parties or "Not specified",
            summary=payload.problem_description[:500],
            practice_group=payload.legal_issue_category,
            matter_type=payload.legal_issue_category,
            stage="INTAKE",
            conflict_status="CLEARANCE_PENDING",
            triage_result=triage_assessment,
        )

        db.add(new_case)
        await db.flush()

        # Record audit log
        audit = AuditLog(
            actor_id=current_user.id,
            action="CASE_INTAKE_CREATED",
            entity_type="legal_cases",
            entity_id=str(new_case.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "case_reference": new_case.case_reference,
                "title": new_case.title,
                "category": new_case.legal_issue_category,
                "state": new_case.state,
                "district": new_case.district,
                "suggested_next_step": triage_assessment.get("suggested_next_step"),
            },
        )
        db.add(audit)
        await db.commit()
        await db.refresh(new_case)

        logger.info(
            f"Case created: ref={new_case.case_reference} id={new_case.id} client_id={current_user.id}"
        )
        return new_case

    @classmethod
    async def list_cases(
        cls,
        db: AsyncSession,
        current_user: User,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[LegalCase], int]:
        """List cases with strict ownership isolation.
        
        - CITIZEN: Only sees cases where client_id == current_user.id
        - ADVOCATE: Only sees cases where assigned as lead_advocate_id
        - ADMIN: Sees all platform cases
        """
        offset = (page - 1) * limit
        query = select(LegalCase)
        count_query = select(func.count(LegalCase.id))

        if current_user.role == "CITIZEN":
            query = query.where(LegalCase.client_id == current_user.id)
            count_query = count_query.where(LegalCase.client_id == current_user.id)
        elif current_user.role == "ADVOCATE":
            # An advocate only sees cases where they are the assigned counsel
            from app.modules.advocates.models import AdvocateProfile
            adv_res = await db.execute(
                select(AdvocateProfile.id).where(AdvocateProfile.user_id == current_user.id)
            )
            adv_profile_id = adv_res.scalar_one_or_none()
            if not adv_profile_id:
                return [], 0
            query = query.where(LegalCase.lead_advocate_id == adv_profile_id)
            count_query = count_query.where(LegalCase.lead_advocate_id == adv_profile_id)
        # ADMIN: Sees all

        total_res = await db.execute(count_query)
        total = total_res.scalar() or 0

        query = query.order_by(LegalCase.created_at.desc()).offset(offset).limit(limit)
        items_res = await db.execute(query)
        items = list(items_res.scalars().all())

        return items, total

    @classmethod
    async def get_case_by_id(
        cls,
        db: AsyncSession,
        case_id: uuid.UUID,
        current_user: User,
    ) -> LegalCase:
        """Retrieve a specific case enforcing client ownership permissions."""
        res = await db.execute(select(LegalCase).where(LegalCase.id == case_id))
        case = res.scalar_one_or_none()

        if not case:
            raise NotFoundException(
                message=f"Case with ID '{case_id}' was not found.",
                details={"case_id": str(case_id)},
            )

        # Enforce Ownership / Authorization
        if current_user.role == "CITIZEN":
            if case.client_id != current_user.id:
                raise ForbiddenException(
                    message="Access forbidden: You do not have permission to view or manage this case.",
                    details={"case_id": str(case_id), "user_id": str(current_user.id)},
                )
        elif current_user.role == "ADVOCATE":
            from app.modules.advocates.models import AdvocateProfile
            adv_res = await db.execute(
                select(AdvocateProfile.id).where(AdvocateProfile.user_id == current_user.id)
            )
            adv_profile_id = adv_res.scalar_one_or_none()
            if not adv_profile_id or case.lead_advocate_id != adv_profile_id:
                raise ForbiddenException(
                    message="Access forbidden: You are not assigned to this case matter.",
                    details={"case_id": str(case_id)},
                )
        # ADMIN allowed

        return case

    @classmethod
    async def update_case(
        cls,
        db: AsyncSession,
        case_id: uuid.UUID,
        current_user: User,
        payload: CaseUpdateRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> LegalCase:
        """Update case details with ownership check and audit trail."""
        case = await cls.get_case_by_id(db, case_id, current_user)

        update_dict = payload.model_dump(exclude_unset=True)
        if not update_dict:
            return case

        # Citizens cannot arbitrarily change stage to DISPOSED or modify internal counsel fields
        if current_user.role == "CITIZEN" and "stage" in update_dict:
            allowed_citizen_stages = ["INTAKE", "WITHDRAWN"]
            if update_dict["stage"] not in allowed_citizen_stages:
                raise ForbiddenException(
                    message=f"Citizens can only transition case stage to: {', '.join(allowed_citizen_stages)}.",
                    details={"attempted_stage": update_dict["stage"]},
                )

        # Apply updates
        for field, value in update_dict.items():
            setattr(case, field, value)

        # If problem description is updated, keep summary in sync
        if "problem_description" in update_dict and update_dict["problem_description"]:
            case.summary = update_dict["problem_description"][:500]

        # Audit update
        audit = AuditLog(
            actor_id=current_user.id,
            action="CASE_UPDATED",
            entity_type="legal_cases",
            entity_id=str(case.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={"updated_fields": list(update_dict.keys())},
        )
        db.add(audit)
        await db.commit()
        await db.refresh(case)

        return case

    @classmethod
    async def run_triage(
        cls,
        db: AsyncSession,
        case_id: uuid.UUID,
        current_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> TriageOutputResponse:
        """Execute or re-evaluate legal triage on an existing case."""
        case = await cls.get_case_by_id(db, case_id, current_user)

        triage_engine = get_triage_engine()
        case_data = {
            "title": case.title,
            "problem_description": case.problem_description or case.summary,
            "legal_issue_category": case.legal_issue_category or case.practice_group,
            "state": case.state,
            "district": case.district,
            "relevant_court": case.relevant_court or case.court_forum,
            "incident_date": case.incident_date,
            "urgency": case.urgency,
            "supporting_info": case.supporting_info,
            "adverse_parties": case.adverse_parties,
        }

        assessment_dict = triage_engine.evaluate(case_data)
        case.triage_result = assessment_dict

        audit = AuditLog(
            actor_id=current_user.id,
            action="CASE_TRIAGE_EVALUATED",
            entity_type="legal_cases",
            entity_id=str(case.id),
            ip_address=ip_address,
            user_agent=user_agent,
            payload_snapshot={
                "case_reference": case.case_reference,
                "identified_category": assessment_dict.get("identified_category"),
                "suggested_next_step": assessment_dict.get("suggested_next_step"),
                "urgency_level": assessment_dict.get("urgency_level"),
                "complexity": assessment_dict.get("complexity"),
            },
        )
        db.add(audit)
        await db.commit()
        await db.refresh(case)

        return TriageOutputResponse(**assessment_dict)
