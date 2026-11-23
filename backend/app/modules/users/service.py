"""Business logic service for User Profiles, DPDP Consent Ledger, Data Export, and Account Deletion."""

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestException, ConflictException, NotFoundException
from app.core.storage import get_storage_provider
from app.modules.appointments.models import Appointment
from app.modules.auth.models import RefreshToken
from app.modules.cases.models import CaseMessage, LegalCase
from app.modules.documents.models import Document
from app.modules.users.models import User, UserConsent
from app.modules.users.schemas import (
    AccountDeleteResponse,
    ConsentGrantRequest,
    DataExportResponse,
    UserProfileResponse,
    UserProfileUpdateRequest,
)


class UserService:
    """Service layer managing profile dossier, DPDP consent tracking, and data sovereignty."""

    @staticmethod
    def get_profile(user: User) -> UserProfileResponse:
        """Return the authenticated user's profile entity."""
        return UserProfileResponse.model_validate(user)

    @staticmethod
    async def update_profile(
        db: AsyncSession,
        user: User,
        data: UserProfileUpdateRequest,
    ) -> User:
        """Update authenticated user fields with validation and email uniqueness checks."""
        # 1. Enforce email uniqueness if email is changed
        if data.email is not None and data.email.strip().lower() != user.email.lower():
            target_email = data.email.strip().lower()
            existing = await db.scalar(
                select(User).where(User.email == target_email, User.id != user.id)
            )
            if existing:
                raise ConflictException(f"Email '{target_email}' is already registered to another account")
            user.email = target_email

        # 2. Update editable fields
        if data.full_name is not None:
            user.full_name = data.full_name.strip()

        if data.city is not None:
            user.city = data.city.strip() if data.city.strip() else None

        if data.state is not None:
            user.state = data.state.strip() if data.state.strip() else None

        if data.preferred_language is not None:
            user.preferred_language = data.preferred_language.strip().lower()

        await db.flush()
        await db.refresh(user)
        return user

    @staticmethod
    async def record_consent(
        db: AsyncSession,
        user: User,
        data: ConsentGrantRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> UserConsent:
        """Record an explicit DPDP statutory consent grant as an auditable ledger entry."""
        purpose_clean = data.purpose.strip()
        if not purpose_clean:
            raise BadRequestException("Consent purpose cannot be blank. Explicit processing purpose required.")

        consent = UserConsent(
            user_id=user.id,
            consent_type=data.consent_type.strip().lower(),
            version=data.version.strip(),
            purpose=purpose_clean,
            action="GRANTED",
            advocate_id=data.advocate_id.strip() if data.advocate_id else None,
            items_shared=data.items_shared,
            is_revoked=False,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(consent)
        await db.flush()
        return consent

    @staticmethod
    async def get_consents(
        db: AsyncSession,
        user: User,
        active_only: bool = False,
    ) -> List[UserConsent]:
        """Fetch consent ledger entries for the authenticated user."""
        stmt = select(UserConsent).where(UserConsent.user_id == user.id)
        if active_only:
            stmt = stmt.where(UserConsent.is_revoked == False)
        stmt = stmt.order_by(UserConsent.created_at.desc())
        result = await db.scalars(stmt)
        return list(result.all())

    @staticmethod
    async def get_consent_history(
        db: AsyncSession,
        user: User,
    ) -> List[UserConsent]:
        """Fetch full chronological audit history of all consent grants and revocations."""
        stmt = (
            select(UserConsent)
            .where(UserConsent.user_id == user.id)
            .order_by(UserConsent.created_at.desc())
        )
        result = await db.scalars(stmt)
        return list(result.all())

    @staticmethod
    async def withdraw_consent(
        db: AsyncSession,
        user: User,
        consent_id: uuid.UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> UserConsent:
        """Revoke a previously granted consent and append an immutable revocation audit event."""
        stmt = select(UserConsent).where(
            UserConsent.id == consent_id,
            UserConsent.user_id == user.id,
        )
        consent = await db.scalar(stmt)
        if not consent:
            raise NotFoundException("Consent record not found or does not belong to this user")

        if consent.is_revoked:
            raise BadRequestException("This consent authorization has already been withdrawn")

        now = datetime.now(timezone.utc)
        consent.is_revoked = True
        consent.revoked_at = now

        # Append immutable audit event for revocation
        audit_revocation = UserConsent(
            user_id=user.id,
            consent_type=consent.consent_type,
            version=consent.version,
            purpose=f"Statutory withdrawal of consent grant (Reference ID: {consent.id})",
            action="WITHDRAWN",
            advocate_id=consent.advocate_id,
            items_shared=consent.items_shared,
            is_revoked=True,
            revoked_at=now,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_revocation)
        await db.flush()
        return consent

    @staticmethod
    async def export_user_data(
        db: AsyncSession,
        user: User,
    ) -> DataExportResponse:
        """Generate a portable, machine-readable JSON archive of the citizen's personal data."""
        export_id = f"EXP-{uuid.uuid4().hex[:12].upper()}"
        now = datetime.now(timezone.utc)

        # 1. Gather all authorized user records
        cases_stmt = select(LegalCase).where(LegalCase.client_id == user.id)
        cases = (await db.scalars(cases_stmt)).all()

        appts_stmt = select(Appointment).where(Appointment.client_id == user.id)
        appts = (await db.scalars(appts_stmt)).all()

        docs_stmt = select(Document).where(Document.uploader_id == user.id)
        docs = (await db.scalars(docs_stmt)).all()

        msgs_stmt = select(CaseMessage).where(CaseMessage.sender_id == user.id)
        msgs = (await db.scalars(msgs_stmt)).all()

        consents_stmt = select(UserConsent).where(UserConsent.user_id == user.id).order_by(UserConsent.created_at.desc())
        consents = (await db.scalars(consents_stmt)).all()

        payload: Dict[str, Any] = {
            "nyayasetu_export_version": "1.0",
            "statutory_basis": "Digital Personal Data Protection Act, 2023 §11 (Right to Data Portability)",
            "exported_at": now.isoformat(),
            "profile": {
                "id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
                "phone": user.phone,
                "role": user.role,
                "is_verified": user.is_verified,
                "preferred_language": user.preferred_language,
                "city": user.city,
                "state": user.state,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            },
            "consent_ledger": [
                {
                    "id": str(c.id),
                    "consent_type": c.consent_type,
                    "version": c.version,
                    "purpose": c.purpose,
                    "action": c.action,
                    "is_revoked": c.is_revoked,
                    "revoked_at": c.revoked_at.isoformat() if c.revoked_at else None,
                    "advocate_id": c.advocate_id,
                    "items_shared": c.items_shared,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in consents
            ],
            "legal_cases": [
                {
                    "id": str(case.id),
                    "case_reference": case.case_reference,
                    "title": case.title,
                    "practice_group": case.practice_group,
                    "matter_type": case.matter_type,
                    "summary": case.summary,
                    "stage": case.stage,
                    "urgency": case.urgency,
                    "created_at": case.created_at.isoformat() if case.created_at else None,
                }
                for case in cases
            ],
            "appointments": [
                {
                    "id": str(a.id),
                    "booking_reference": a.booking_reference,
                    "scheduled_at": a.scheduled_at.isoformat() if a.scheduled_at else None,
                    "duration_minutes": a.duration_minutes,
                    "consultation_mode": a.consultation_mode,
                    "status": a.status,
                    "fee_inr": a.fee_inr,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in appts
            ],
            "vault_documents_metadata": [
                {
                    "id": str(d.id),
                    "file_name": d.file_name,
                    "file_size_bytes": d.file_size_bytes,
                    "mime_type": d.mime_type,
                    "checksum_sha256": d.checksum_sha256,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in docs
            ],
            "messages_sent": [
                {
                    "id": str(m.id),
                    "case_id": str(m.case_id),
                    "message_text": m.message_text,
                    "is_privileged": m.is_privileged,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in msgs
            ],
        }

        # 2. Store archive in persistent document storage
        storage_provider = get_storage_provider()
        storage_key = f"exports/{user.id}/{export_id}.json"
        payload_bytes = json.dumps(payload, indent=2).encode("utf-8")

        await storage_provider.upload(
            key=storage_key,
            content=payload_bytes,
            content_type="application/json",
        )

        # 3. Generate signed download link (15 minutes expiry) or relative secure download endpoint
        download_url: Optional[str] = None
        try:
            download_url = await storage_provider.generate_download_url(
                key=storage_key,
                expiry_seconds=900,
            )
        except Exception:
            download_url = None

        if not download_url:
            download_url = f"/api/v1/users/me/data-export/{export_id}"

        return DataExportResponse(
            export_id=export_id,
            status="COMPLETED",
            user_id=user.id,
            exported_at=now,
            download_url=download_url,
            data=payload,
        )

    @staticmethod
    async def delete_or_anonymize_user(
        db: AsyncSession,
        user: User,
        confirmation: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AccountDeleteResponse:
        """Execute DPDP Act Section 12 erasure with statutory retention safeguards."""
        if confirmation.strip() != "CONFIRM_DELETE_NYAYASETU_ACCOUNT":
            raise BadRequestException(
                "Account deletion requires explicit confirmation string: 'CONFIRM_DELETE_NYAYASETU_ACCOUNT'"
            )

        now = datetime.now(timezone.utc)

        # 1. Invalidate all active refresh tokens (terminates all active sessions immediately)
        await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))

        # 2. Revoke all active DPDP consents
        await db.execute(
            update(UserConsent)
            .where(UserConsent.user_id == user.id, UserConsent.is_revoked == False)
            .values(is_revoked=True, revoked_at=now)
        )

        # 3. Record an immutable audit log entry for statutory compliance
        audit = UserConsent(
            user_id=user.id,
            consent_type="dpdp",
            version="1.0",
            purpose="Account purged under DPDP Act 2023 Section 12 Right to Erasure",
            action="WITHDRAWN",
            is_revoked=True,
            revoked_at=now,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit)

        # 4. Check whether user has active legal cases, appointments, or messages
        cases_count = await db.scalar(
            select(func.count()).select_from(LegalCase).where(LegalCase.client_id == user.id)
        )
        appts_count = await db.scalar(
            select(func.count()).select_from(Appointment).where(Appointment.client_id == user.id)
        )
        msgs_count = await db.scalar(
            select(func.count()).select_from(CaseMessage).where(CaseMessage.sender_id == user.id)
        )

        has_legal_records = (cases_count or 0) > 0 or (appts_count or 0) > 0 or (msgs_count or 0) > 0

        if has_legal_records:
            # Under DPDP §12(3) and Limitation Act 1963, case filings must be preserved in restricted escrow
            user.full_name = "Anonymized Citizen [Account Purged]"
            user.email = f"purged_{user.id.hex[:12]}@deleted.nyayasetu.local"
            user.phone = f"+9100000{user.id.hex[:5]}"
            user.password_hash = "PURGED_ACCOUNT_PASSWORD_INACCESSIBLE"
            user.is_active = False
            user.city = None
            user.state = None
            policy = (
                "Statutory case dossiers and court filings preserved in restricted escrow pursuant "
                "to DPDP Act Section 12(3) and Limitation Act 1963. Personal identifiers, credentials, "
                "and active session tokens have been permanently purged."
            )
        else:
            # Standalone citizen with no court matters or financial appointments
            user.full_name = "Deleted Citizen"
            user.email = f"deleted_{user.id.hex[:12]}@deleted.nyayasetu.local"
            user.phone = f"+9100000{user.id.hex[:5]}"
            user.password_hash = "DELETED"
            user.is_active = False
            user.city = None
            user.state = None
            policy = "User account, personal credentials, and active session tokens have been permanently purged."

        await db.flush()

        return AccountDeleteResponse(
            status="PURGED",
            message="User account and personal identifiers have been successfully purged under DPDP Act Section 12.",
            user_id=user.id,
            retention_policy=policy,
            purged_at=now,
        )
