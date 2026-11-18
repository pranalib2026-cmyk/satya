"""Advocate Verification Service — business logic for verification workflow."""

import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional, Tuple

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.errors import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.core.logging import logger
from app.core.security import hash_password
from app.modules.admin.models import AuditLog
from app.modules.advocates.models import (
    AdvocateProfile,
    AdvocateVerification,
    AdvocateVerificationApplication,
)
from app.modules.advocates.schemas import (
    AdminDecisionRequest,
    AdminPendingAdvocateItem,
    AdminPendingAdvocatesResponse,
    AdminRequestInfoRequest,
    AdminVerificationDetailResponse,
    AdminVerificationListItem,
    AdminVerificationUpdateRequest,
    AdvocateApplyRequest,
    AdvocateProfileDetailResponse,
    DocumentType,
    VerificationApplicationRequest,
    VerificationApplicationResponse,
    VerificationDocumentResponse,
    normalize_enrollment_number,
    validate_enrollment_format,
)
from app.modules.advocates.verification_engine import (
    AutomaticFormatValidator,
    VerificationResult,
    get_verification_provider,
)
from app.modules.users.models import User


def make_point(latitude: Optional[float], longitude: Optional[float]):
    """Safely create a geography POINT representation for PostgreSQL/SQLite."""
    if latitude is None or longitude is None:
        return None
    return f"POINT({longitude} {latitude})"


def parse_coordinates(location: Optional[Any]) -> tuple[Optional[float], Optional[float]]:
    """Extract (latitude, longitude) from WKT/WKB or string location element."""
    if not location:
        return None, None
    s = str(location)
    m = re.search(r"POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)", s, re.IGNORECASE)
    if m:
        try:
            return float(m.group(2)), float(m.group(1))  # lat, lon
        except (ValueError, TypeError):
            pass
    return None, None



# ──────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────

ALLOWED_DOCUMENT_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
UPLOAD_DIRECTORY = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "uploads",
    "advocate_documents",
)


class AdvocateVerificationService:
    """Core business logic for advocate credential verification workflow."""

    # ──────────────────────────────────────────────────────────
    # ADVOCATE: Submit verification application
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def submit_verification_application(
        db: AsyncSession,
        user: User,
        req: VerificationApplicationRequest,
    ) -> AdvocateVerificationApplication:
        """Submit a new verification application for the current advocate."""

        # 1. Ensure user is an ADVOCATE with a profile
        if user.role != "ADVOCATE":
            raise ForbiddenException(
                message="Only advocates can submit verification applications.",
            )

        profile_result = await db.execute(
            select(AdvocateProfile).where(AdvocateProfile.user_id == user.id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            raise NotFoundException(
                message="Advocate profile not found. Please complete registration first.",
            )

        # 2. Check for existing application
        existing = await db.execute(
            select(AdvocateVerificationApplication).where(
                AdvocateVerificationApplication.advocate_id == profile.id
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictException(
                message="A verification application already exists for this advocate.",
            )

        # 3. Validate enrollment format
        provider = get_verification_provider()
        format_result = await provider.validate_enrollment_format(
            req.enrollment_number, req.state_bar_council
        )
        if not format_result.is_valid:
            raise BadRequestException(
                message=format_result.message,
                details={"enrollment_number": req.enrollment_number, "bar_council": req.state_bar_council},
            )

        # 4. Normalize enrollment number and check for duplicates
        normalized = normalize_enrollment_number(req.enrollment_number)
        dup_result = await db.execute(
            select(AdvocateVerificationApplication).where(
                AdvocateVerificationApplication.enrollment_number_normalized == normalized
            )
        )
        if dup_result.scalar_one_or_none():
            raise ConflictException(
                message=f"Enrollment number '{req.enrollment_number}' is already registered in the system.",
                details={"enrollment_number_normalized": normalized},
            )

        # 5. Create application
        application = AdvocateVerificationApplication(
            advocate_id=profile.id,
            enrollment_number=req.enrollment_number.strip(),
            enrollment_number_normalized=normalized,
            enrollment_name=req.enrollment_name.strip(),
            state_bar_council=req.state_bar_council.strip(),
            enrollment_date=req.enrollment_date,
            aibe_status=req.aibe_status.value if req.aibe_status else "NOT_APPLICABLE",
            cop_status=req.cop_status.value if req.cop_status else "NOT_APPLICABLE",
            contact_phone=req.contact_phone,
            contact_email=req.contact_email,
            platform_verification_status="SUBMITTED",
            submitted_at=datetime.now(timezone.utc),
        )
        db.add(application)

        # 6. Update advocate profile status
        profile.platform_verification_status = "SUBMITTED"

        # 7. Create audit log
        audit = AuditLog(
            actor_id=user.id,
            action="VERIFICATION_APPLICATION_SUBMITTED",
            entity_type="advocate_verification_applications",
            entity_id=str(application.id),
            payload_snapshot={
                "enrollment_number": req.enrollment_number,
                "state_bar_council": req.state_bar_council,
                "enrollment_name": req.enrollment_name,
                "format_validation": format_result.message,
            },
        )
        db.add(audit)

        await db.flush()
        logger.info(f"Advocate {user.email} submitted verification application {application.id}.")
        return application

    # ──────────────────────────────────────────────────────────
    # ADVOCATE: Get own verification status
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def get_own_verification(
        db: AsyncSession,
        user: User,
    ) -> Optional[AdvocateVerificationApplication]:
        """Retrieve the advocate's own verification application."""
        if user.role != "ADVOCATE":
            raise ForbiddenException(message="Only advocates can view verification status.")

        profile_result = await db.execute(
            select(AdvocateProfile).where(AdvocateProfile.user_id == user.id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            return None

        result = await db.execute(
            select(AdvocateVerificationApplication).where(
                AdvocateVerificationApplication.advocate_id == profile.id
            )
        )
        return result.scalar_one_or_none()

    # ──────────────────────────────────────────────────────────
    # ADVOCATE: Upload verification document
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def upload_verification_document(
        db: AsyncSession,
        user: User,
        verification_type: str,
        filename: str,
        content_type: str,
        file_data: bytes,
    ) -> AdvocateVerification:
        """Upload a credential document for verification."""

        if user.role != "ADVOCATE":
            raise ForbiddenException(message="Only advocates can upload verification documents.")

        # Validate document type enum
        try:
            doc_type = DocumentType(verification_type)
        except ValueError:
            raise BadRequestException(
                message=f"Invalid verification_type: '{verification_type}'. "
                        f"Must be one of: {', '.join(dt.value for dt in DocumentType)}.",
            )

        # Validate content type
        if content_type not in ALLOWED_DOCUMENT_TYPES:
            raise BadRequestException(
                message=f"File type '{content_type}' is not allowed. Accepted: {', '.join(ALLOWED_DOCUMENT_TYPES)}.",
            )

        # Validate file size
        if len(file_data) > MAX_DOCUMENT_SIZE_BYTES:
            raise BadRequestException(
                message=f"File size exceeds maximum allowed ({MAX_DOCUMENT_SIZE_BYTES // (1024*1024)} MB).",
            )

        # Get advocate profile
        profile_result = await db.execute(
            select(AdvocateProfile).where(AdvocateProfile.user_id == user.id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            raise NotFoundException(message="Advocate profile not found.")

        # Generate private storage key
        file_ext = os.path.splitext(filename)[1] if filename else ".pdf"
        storage_key = f"{profile.id}/{doc_type.value}/{uuid.uuid4().hex}{file_ext}"

        # Store file to private storage directory
        storage_path = os.path.join(UPLOAD_DIRECTORY, storage_key)
        os.makedirs(os.path.dirname(storage_path), exist_ok=True)
        with open(storage_path, "wb") as f:
            f.write(file_data)

        # Create verification document record
        doc = AdvocateVerification(
            advocate_id=profile.id,
            verification_type=doc_type.value,
            storage_key=storage_key,
            filename=filename,
            content_type=content_type,
            size_bytes=len(file_data),
            status="PENDING",
        )
        db.add(doc)

        # Create audit log
        audit = AuditLog(
            actor_id=user.id,
            action="VERIFICATION_DOCUMENT_UPLOADED",
            entity_type="advocate_verifications",
            entity_id=str(doc.id),
            payload_snapshot={
                "verification_type": doc_type.value,
                "filename": filename,
                "content_type": content_type,
                "size_bytes": len(file_data),
            },
        )
        db.add(audit)

        await db.flush()
        logger.info(f"Advocate {user.email} uploaded {doc_type.value} document.")
        return doc

    # ──────────────────────────────────────────────────────────
    # ADMIN: List verification applications
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def admin_list_verifications(
        db: AsyncSession,
        status_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[AdminVerificationListItem], int]:
        """List verification applications for admin review."""

        query = (
            select(AdvocateVerificationApplication)
            .join(AdvocateProfile, AdvocateVerificationApplication.advocate_id == AdvocateProfile.id)
            .join(User, AdvocateProfile.user_id == User.id)
        )

        count_query = (
            select(func.count(AdvocateVerificationApplication.id))
            .join(AdvocateProfile, AdvocateVerificationApplication.advocate_id == AdvocateProfile.id)
        )

        if status_filter:
            query = query.where(
                AdvocateVerificationApplication.platform_verification_status == status_filter.upper()
            )
            count_query = count_query.where(
                AdvocateVerificationApplication.platform_verification_status == status_filter.upper()
            )

        # Total count
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginated results
        offset = (page - 1) * page_size
        query = query.order_by(AdvocateVerificationApplication.created_at.desc())
        query = query.offset(offset).limit(page_size)

        result = await db.execute(query)
        applications = result.scalars().all()

        items = []
        for app in applications:
            # Fetch associated user info
            profile_result = await db.execute(
                select(AdvocateProfile).where(AdvocateProfile.id == app.advocate_id)
            )
            profile = profile_result.scalar_one_or_none()
            user_result = await db.execute(
                select(User).where(User.id == profile.user_id)
            ) if profile else None
            user = user_result.scalar_one_or_none() if user_result else None

            items.append(AdminVerificationListItem(
                id=app.id,
                advocate_name=user.full_name if user else "Unknown",
                state_bar_council=app.state_bar_council,
                enrollment_number=app.enrollment_number,
                platform_verification_status=app.platform_verification_status,
                aibe_status=app.aibe_status,
                cop_status=app.cop_status,
                submitted_at=app.submitted_at,
                created_at=app.created_at,
            ))

        return items, total

    # ──────────────────────────────────────────────────────────
    # ADMIN: Get verification detail
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def admin_get_verification(
        db: AsyncSession,
        application_id: uuid.UUID,
    ) -> AdminVerificationDetailResponse:
        """Get full verification application details for admin review."""

        result = await db.execute(
            select(AdvocateVerificationApplication).where(
                AdvocateVerificationApplication.id == application_id
            )
        )
        application = result.scalar_one_or_none()
        if not application:
            raise NotFoundException(
                message="Verification application not found.",
                details={"application_id": str(application_id)},
            )

        # Get advocate profile and user
        profile_result = await db.execute(
            select(AdvocateProfile).where(AdvocateProfile.id == application.advocate_id)
        )
        profile = profile_result.scalar_one_or_none()

        user_result = await db.execute(
            select(User).where(User.id == profile.user_id)
        )
        user = user_result.scalar_one_or_none()

        # Get uploaded documents
        docs_result = await db.execute(
            select(AdvocateVerification).where(
                AdvocateVerification.advocate_id == application.advocate_id
            )
        )
        documents = docs_result.scalars().all()
        doc_responses = [
            VerificationDocumentResponse(
                id=d.id,
                verification_type=d.verification_type,
                filename=d.filename,
                content_type=d.content_type,
                size_bytes=d.size_bytes,
                status=d.status,
                created_at=d.created_at,
            )
            for d in documents
        ]

        # Get reviewer name
        reviewer_name = None
        if application.reviewer_id:
            reviewer_result = await db.execute(
                select(User).where(User.id == application.reviewer_id)
            )
            reviewer = reviewer_result.scalar_one_or_none()
            reviewer_name = reviewer.full_name if reviewer else None

        return AdminVerificationDetailResponse(
            id=application.id,
            advocate_profile_id=profile.id,
            advocate_user_id=user.id,
            advocate_name=user.full_name,
            advocate_email=user.email,
            enrollment_number=application.enrollment_number,
            enrollment_number_normalized=application.enrollment_number_normalized,
            enrollment_name=application.enrollment_name,
            state_bar_council=application.state_bar_council,
            enrollment_date=application.enrollment_date,
            aibe_status=application.aibe_status,
            cop_status=application.cop_status,
            platform_verification_status=application.platform_verification_status,
            evidence_level=application.evidence_level,
            verification_method=application.verification_method,
            source_name=application.source_name,
            source_url=application.source_url,
            decision_reason=application.decision_reason,
            internal_notes=application.internal_notes,
            info_request_message=application.info_request_message,
            reviewer_id=application.reviewer_id,
            reviewer_name=reviewer_name,
            submitted_at=application.submitted_at,
            decided_at=application.decided_at,
            created_at=application.created_at,
            updated_at=application.updated_at,
            documents=doc_responses,
        )

    # ──────────────────────────────────────────────────────────
    # ADMIN: Record verification decision
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def admin_record_decision(
        db: AsyncSession,
        admin_user: User,
        application_id: uuid.UUID,
        req: AdminDecisionRequest,
    ) -> AdvocateVerificationApplication:
        """Admin approves or rejects a verification application."""

        if admin_user.role != "ADMIN":
            raise ForbiddenException(message="Only administrators can make verification decisions.")

        # Fetch application
        result = await db.execute(
            select(AdvocateVerificationApplication).where(
                AdvocateVerificationApplication.id == application_id
            )
        )
        application = result.scalar_one_or_none()
        if not application:
            raise NotFoundException(message="Verification application not found.")

        # Prevent duplicate decisions on already-decided applications
        if application.platform_verification_status in ("VERIFIED", "REJECTED"):
            raise ConflictException(
                message=f"Application already has status '{application.platform_verification_status}'. "
                        "Cannot re-decide.",
            )

        # Prevent self-approval: admin cannot verify their own advocate profile
        profile_result = await db.execute(
            select(AdvocateProfile).where(AdvocateProfile.id == application.advocate_id)
        )
        profile = profile_result.scalar_one_or_none()
        if profile and profile.user_id == admin_user.id:
            raise ForbiddenException(
                message="Administrators cannot approve or reject their own verification application.",
            )

        # Validate COUNCIL_CONFIRMED evidence requires proof
        if req.evidence_level == "COUNCIL_CONFIRMED" and not req.source_name:
            raise BadRequestException(
                message="COUNCIL_CONFIRMED evidence level requires source_name identifying the confirming council.",
            )

        now = datetime.now(timezone.utc)

        # Update application
        application.platform_verification_status = req.decision
        application.evidence_level = req.evidence_level
        application.verification_method = req.verification_method
        application.source_name = req.source_name
        application.source_url = req.source_url
        application.decision_reason = req.decision_reason
        application.internal_notes = req.internal_notes
        application.reviewer_id = admin_user.id
        application.decided_at = now

        # Sync profile-level status and user verification
        if profile:
            profile.platform_verification_status = req.decision
            if req.decision == "VERIFIED":
                user_res = await db.execute(select(User).where(User.id == profile.user_id))
                user_obj = user_res.scalar_one_or_none()
                if user_obj:
                    user_obj.is_verified = True

        # Create immutable audit record
        audit = AuditLog(
            actor_id=admin_user.id,
            action=f"VERIFICATION_{req.decision}",
            entity_type="advocate_verification_applications",
            entity_id=str(application.id),
            payload_snapshot={
                "decision": req.decision,
                "evidence_level": req.evidence_level,
                "verification_method": req.verification_method,
                "source_name": req.source_name,
                "source_url": req.source_url,
                "decision_reason": req.decision_reason,
                "advocate_enrollment": application.enrollment_number,
            },
        )
        db.add(audit)

        await db.flush()
        logger.info(
            f"Admin {admin_user.email} {req.decision} verification for "
            f"enrollment {application.enrollment_number} (application {application.id})."
        )
        return application

    # ──────────────────────────────────────────────────────────
    # ADMIN: Request additional information
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def admin_request_info(
        db: AsyncSession,
        admin_user: User,
        application_id: uuid.UUID,
        req: AdminRequestInfoRequest,
    ) -> AdvocateVerificationApplication:
        """Admin requests additional information or documents from the advocate."""

        if admin_user.role != "ADMIN":
            raise ForbiddenException(message="Only administrators can request additional information.")

        result = await db.execute(
            select(AdvocateVerificationApplication).where(
                AdvocateVerificationApplication.id == application_id
            )
        )
        application = result.scalar_one_or_none()
        if not application:
            raise NotFoundException(message="Verification application not found.")

        if application.platform_verification_status in ("VERIFIED", "REJECTED"):
            raise ConflictException(
                message=f"Cannot request info on application with status '{application.platform_verification_status}'.",
            )

        now = datetime.now(timezone.utc)

        application.platform_verification_status = "NEEDS_MORE_INFORMATION"
        application.info_request_message = req.message
        if req.internal_notes:
            application.internal_notes = req.internal_notes
        application.reviewer_id = admin_user.id

        # Sync profile
        profile_result = await db.execute(
            select(AdvocateProfile).where(AdvocateProfile.id == application.advocate_id)
        )
        profile = profile_result.scalar_one_or_none()
        if profile:
            profile.platform_verification_status = "NEEDS_MORE_INFORMATION"

        # Audit
        audit = AuditLog(
            actor_id=admin_user.id,
            action="VERIFICATION_INFO_REQUESTED",
            entity_type="advocate_verification_applications",
            entity_id=str(application.id),
            payload_snapshot={
                "message": req.message,
                "advocate_enrollment": application.enrollment_number,
            },
        )
        db.add(audit)

        await db.flush()
        logger.info(f"Admin {admin_user.email} requested info for application {application.id}.")
        return application

    # ──────────────────────────────────────────────────────────
    # MATCHING: Verified advocates only
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def get_verified_advocates(
        db: AsyncSession,
        practice_filter: Optional[str] = None,
        city_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[AdvocateProfile], int]:
        """Return only platform-verified advocates for matching results."""

        query = (
            select(AdvocateProfile)
            .join(User, AdvocateProfile.user_id == User.id)
            .where(AdvocateProfile.platform_verification_status == "VERIFIED")
            .where(User.is_active == True)
        )

        count_query = (
            select(func.count(AdvocateProfile.id))
            .join(User, AdvocateProfile.user_id == User.id)
            .where(AdvocateProfile.platform_verification_status == "VERIFIED")
            .where(User.is_active == True)
        )

        if practice_filter:
            query = query.where(AdvocateProfile.primary_practice == practice_filter)
            count_query = count_query.where(AdvocateProfile.primary_practice == practice_filter)

        if city_filter:
            query = query.where(AdvocateProfile.city == city_filter)
            count_query = count_query.where(AdvocateProfile.city == city_filter)

        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        offset = (page - 1) * page_size
        query = query.order_by(AdvocateProfile.in_practice_years.desc())
        query = query.offset(offset).limit(page_size)

        result = await db.execute(query)
        advocates = result.scalars().all()

        return advocates, total

    # ──────────────────────────────────────────────────────────
    # DOCUMENT MANAGEMENT: Secure Download
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def get_document_file(
        db: AsyncSession,
        user: User,
        document_id: uuid.UUID,
    ) -> Tuple[bytes, str, str]:
        """Retrieve raw document file bytes, filename, and mime type.
        
        Enforces access control:
        - Admin can access any document.
        - Advocate can only access documents belonging to their own advocate profile.
        - Citizen is forbidden.
        """
        if user.role not in ("ADMIN", "ADVOCATE"):
            raise ForbiddenException(message="Citizens are not authorized to view verification documents.")

        result = await db.execute(
            select(AdvocateVerification).where(AdvocateVerification.id == document_id)
        )
        doc = result.scalar_one_or_none()
        if not doc:
            raise NotFoundException(message="Verification document not found.")

        # If user is advocate, verify ownership
        if user.role == "ADVOCATE":
            profile_res = await db.execute(
                select(AdvocateProfile).where(AdvocateProfile.user_id == user.id)
            )
            profile = profile_res.scalar_one_or_none()
            if not profile or doc.advocate_id != profile.id:
                raise ForbiddenException(message="You cannot access documents belonging to another advocate.")

        # Read file from storage
        storage_path = os.path.join(UPLOAD_DIRECTORY, doc.storage_key)
        if not os.path.exists(storage_path):
            raise NotFoundException(message="Physical document file not found in storage.")

        with open(storage_path, "rb") as f:
            data = f.read()

        filename = doc.filename or f"verification_document_{doc.id}.pdf"
        content_type = doc.content_type or "application/octet-stream"
        return data, filename, content_type

    # ──────────────────────────────────────────────────────────
    # ADVOCATE REGISTRATION & FULL PROFILE APPLICATION
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def apply_advocate(
        db: AsyncSession,
        req: AdvocateApplyRequest,
        current_user: Optional[User] = None,
    ) -> AdvocateProfileDetailResponse:
        """Register or submit full professional advocate profile. Status begins as PENDING."""

        # 1. Format validation of Bar Council enrollment ID
        provider = get_verification_provider()
        fmt_res = await provider.validate_enrollment_format(req.bar_council_id, req.bar_council_name)
        if not fmt_res.is_valid:
            raise BadRequestException(
                message=fmt_res.message,
                details={"bar_council_id": req.bar_council_id, "bar_council_name": req.bar_council_name},
            )

        # 2. Check for duplicate bar_council_id
        dup_profile_query = select(AdvocateProfile).where(
            AdvocateProfile.bar_council_id == req.bar_council_id.strip()
        )
        if current_user:
            dup_profile_query = dup_profile_query.where(AdvocateProfile.user_id != current_user.id)
        dup_profile_res = await db.execute(dup_profile_query)
        if dup_profile_res.scalar_one_or_none():
            raise ConflictException(
                message=f"Bar Council enrollment number '{req.bar_council_id}' is already registered.",
                details={"bar_council_id": req.bar_council_id},
            )

        # 3. Determine User account
        if current_user:
            user = current_user
            if user.role not in ("ADVOCATE", "ADMIN"):
                user.role = "ADVOCATE"
        else:
            # Check for existing email or phone
            dup_user_query = select(User).where(
                (User.email == req.email.lower().strip()) | (User.phone == req.phone.strip())
            )
            dup_user_res = await db.execute(dup_user_query)
            existing_user = dup_user_res.scalar_one_or_none()
            if existing_user:
                field = "email" if existing_user.email == req.email.lower().strip() else "mobile number"
                raise ConflictException(
                    message=f"An account with this {field} already exists.",
                    details={"duplicate_field": field},
                )

            if not req.password:
                raise BadRequestException(
                    message="Password is required to register an advocate account.",
                )

            # Create User
            user = User(
                full_name=req.full_name.strip(),
                email=req.email.lower().strip(),
                phone=req.phone.strip(),
                password_hash=hash_password(req.password),
                role="ADVOCATE",
                is_verified=False,
                is_active=True,
                preferred_language=req.preferred_language or "en",
            )
            db.add(user)
            await db.flush()

        # 4. Resolve practice areas and years of experience
        primary_practice = req.primary_practice
        secondary_practices = req.secondary_practices or []
        if req.practice_areas and len(req.practice_areas) > 0:
            if not primary_practice:
                primary_practice = req.practice_areas[0]
            if not secondary_practices and len(req.practice_areas) > 1:
                secondary_practices = req.practice_areas[1:]
        if not primary_practice:
            primary_practice = "Trials & Disputes"

        years_exp = req.years_of_experience
        if years_exp is None:
            years_exp = req.in_practice_years if req.in_practice_years is not None else 0

        location_point = make_point(req.latitude, req.longitude)

        # 5. Look for existing profile for this user
        prof_res = await db.execute(select(AdvocateProfile).where(AdvocateProfile.user_id == user.id))
        profile = prof_res.scalar_one_or_none()

        if profile:
            # Update existing profile
            profile.bar_council_id = req.bar_council_id.strip()
            profile.bar_council_name = req.bar_council_name.strip()
            profile.in_practice_years = years_exp
            profile.primary_practice = primary_practice.strip()
            profile.secondary_practices = secondary_practices
            profile.courts_of_practice = req.courts_of_practice or []
            profile.languages = req.languages or []
            profile.city = req.city.strip()
            profile.district = req.district.strip() if req.district else None
            profile.state = req.state.strip()
            profile.pincode = req.pincode.strip() if req.pincode else None
            profile.location = location_point
            profile.platform_verification_status = "PENDING"
        else:
            # Create new profile
            profile = AdvocateProfile(
                user_id=user.id,
                bar_council_id=req.bar_council_id.strip(),
                bar_council_name=req.bar_council_name.strip(),
                in_practice_years=years_exp,
                primary_practice=primary_practice.strip(),
                secondary_practices=secondary_practices,
                courts_of_practice=req.courts_of_practice or [],
                languages=req.languages or [],
                city=req.city.strip(),
                district=req.district.strip() if req.district else None,
                state=req.state.strip(),
                pincode=req.pincode.strip() if req.pincode else None,
                location=location_point,
                platform_verification_status="PENDING",
            )
            db.add(profile)
            await db.flush()

        # Audit Log
        audit = AuditLog(
            actor_id=user.id,
            action="ADVOCATE_APPLICATION_SUBMITTED",
            entity_type="advocate_profiles",
            entity_id=str(profile.id),
            payload_snapshot={
                "bar_council_id": req.bar_council_id,
                "bar_council_name": req.bar_council_name,
                "city": req.city,
                "district": req.district,
                "state": req.state,
                "status": "PENDING",
            },
        )
        db.add(audit)
        await db.flush()

        all_practices = [profile.primary_practice] + (profile.secondary_practices or [])
        lat, lon = parse_coordinates(profile.location)

        return AdvocateProfileDetailResponse(
            id=profile.id,
            user_id=user.id,
            full_name=user.full_name,
            email=user.email,
            phone=user.phone,
            bar_council_id=profile.bar_council_id,
            bar_council_name=profile.bar_council_name,
            practice_areas=all_practices,
            primary_practice=profile.primary_practice,
            secondary_practices=profile.secondary_practices,
            courts_of_practice=profile.courts_of_practice,
            languages=profile.languages,
            years_of_experience=profile.in_practice_years,
            city=profile.city,
            district=profile.district,
            state=profile.state,
            pincode=profile.pincode,
            latitude=lat,
            longitude=lon,
            platform_verification_status=profile.platform_verification_status,
            is_verified=user.is_verified,
            documents=[],
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        )

    # ──────────────────────────────────────────────────────────
    # ADVOCATE: Get own complete profile
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def get_advocate_me(
        db: AsyncSession,
        user: User,
    ) -> AdvocateProfileDetailResponse:
        """Retrieve the current advocate's full profile including verification status and documents."""
        if user.role != "ADVOCATE":
            raise ForbiddenException(message="Only advocates can access the advocate profile.")

        prof_res = await db.execute(
            select(AdvocateProfile).where(AdvocateProfile.user_id == user.id)
        )
        profile = prof_res.scalar_one_or_none()
        if not profile:
            raise NotFoundException(message="Advocate profile not found. Please apply first.")

        # Get uploaded documents
        docs_res = await db.execute(
            select(AdvocateVerification).where(AdvocateVerification.advocate_id == profile.id)
        )
        docs = [
            VerificationDocumentResponse(
                id=d.id,
                verification_type=d.verification_type,
                filename=d.filename,
                content_type=d.content_type,
                size_bytes=d.size_bytes,
                status=d.status,
                created_at=d.created_at,
            )
            for d in docs_res.scalars().all()
        ]

        all_practices = [profile.primary_practice] + (profile.secondary_practices or [])
        lat, lon = parse_coordinates(profile.location)

        return AdvocateProfileDetailResponse(
            id=profile.id,
            user_id=user.id,
            full_name=user.full_name,
            email=user.email,
            phone=user.phone,
            bar_council_id=profile.bar_council_id,
            bar_council_name=profile.bar_council_name,
            practice_areas=all_practices,
            primary_practice=profile.primary_practice,
            secondary_practices=profile.secondary_practices,
            courts_of_practice=profile.courts_of_practice,
            languages=profile.languages,
            years_of_experience=profile.in_practice_years,
            city=profile.city,
            district=profile.district,
            state=profile.state,
            pincode=profile.pincode,
            latitude=lat,
            longitude=lon,
            platform_verification_status=profile.platform_verification_status,
            is_verified=user.is_verified,
            documents=docs,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        )

    # ──────────────────────────────────────────────────────────
    # ADMIN: List pending advocates
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def admin_get_pending_advocates(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        status_filter: str = "PENDING",
    ) -> Tuple[List[AdminPendingAdvocateItem], int]:
        """List advocates awaiting verification review."""
        query = (
            select(AdvocateProfile)
            .join(User, AdvocateProfile.user_id == User.id)
        )
        count_query = (
            select(func.count(AdvocateProfile.id))
            .join(User, AdvocateProfile.user_id == User.id)
        )

        status_norm = status_filter.upper().strip()
        if status_norm == "ALL_PENDING":
            query = query.where(
                AdvocateProfile.platform_verification_status.in_(["PENDING", "UNDER_REVIEW", "SUBMITTED"])
            )
            count_query = count_query.where(
                AdvocateProfile.platform_verification_status.in_(["PENDING", "UNDER_REVIEW", "SUBMITTED"])
            )
        else:
            query = query.where(AdvocateProfile.platform_verification_status == status_norm)
            count_query = count_query.where(AdvocateProfile.platform_verification_status == status_norm)

        total_res = await db.execute(count_query)
        total = total_res.scalar() or 0

        offset = (page - 1) * page_size
        query = query.order_by(AdvocateProfile.created_at.desc()).offset(offset).limit(page_size)

        result = await db.execute(query)
        profiles = result.scalars().all()

        items = []
        for p in profiles:
            user_res = await db.execute(select(User).where(User.id == p.user_id))
            u = user_res.scalar_one_or_none()

            doc_count_res = await db.execute(
                select(func.count(AdvocateVerification.id)).where(AdvocateVerification.advocate_id == p.id)
            )
            doc_count = doc_count_res.scalar() or 0

            all_practices = [p.primary_practice] + (p.secondary_practices or [])

            items.append(
                AdminPendingAdvocateItem(
                    id=p.id,
                    user_id=p.user_id,
                    full_name=u.full_name if u else "Unknown",
                    email=u.email if u else "",
                    phone=u.phone if u else "",
                    bar_council_id=p.bar_council_id,
                    bar_council_name=p.bar_council_name,
                    primary_practice=p.primary_practice,
                    practice_areas=all_practices,
                    years_of_experience=p.in_practice_years,
                    city=p.city,
                    district=p.district,
                    state=p.state,
                    platform_verification_status=p.platform_verification_status,
                    documents_count=doc_count,
                    created_at=p.created_at,
                )
            )

        return items, total

    # ──────────────────────────────────────────────────────────
    # ADMIN: Get advocate full details by ID
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def admin_get_advocate_by_id(
        db: AsyncSession,
        advocate_id: uuid.UUID,
    ) -> AdvocateProfileDetailResponse:
        """Retrieve full details of an advocate by ID for admin review."""
        prof_res = await db.execute(
            select(AdvocateProfile).where(AdvocateProfile.id == advocate_id)
        )
        profile = prof_res.scalar_one_or_none()
        if not profile:
            raise NotFoundException(message="Advocate profile not found.")

        user_res = await db.execute(select(User).where(User.id == profile.user_id))
        user = user_res.scalar_one_or_none()
        if not user:
            raise NotFoundException(message="Advocate user account not found.")

        # Get documents
        docs_res = await db.execute(
            select(AdvocateVerification).where(AdvocateVerification.advocate_id == profile.id)
        )
        docs = [
            VerificationDocumentResponse(
                id=d.id,
                verification_type=d.verification_type,
                filename=d.filename,
                content_type=d.content_type,
                size_bytes=d.size_bytes,
                status=d.status,
                created_at=d.created_at,
            )
            for d in docs_res.scalars().all()
        ]

        all_practices = [profile.primary_practice] + (profile.secondary_practices or [])
        lat, lon = parse_coordinates(profile.location)

        return AdvocateProfileDetailResponse(
            id=profile.id,
            user_id=user.id,
            full_name=user.full_name,
            email=user.email,
            phone=user.phone,
            bar_council_id=profile.bar_council_id,
            bar_council_name=profile.bar_council_name,
            practice_areas=all_practices,
            primary_practice=profile.primary_practice,
            secondary_practices=profile.secondary_practices,
            courts_of_practice=profile.courts_of_practice,
            languages=profile.languages,
            years_of_experience=profile.in_practice_years,
            city=profile.city,
            district=profile.district,
            state=profile.state,
            pincode=profile.pincode,
            latitude=lat,
            longitude=lon,
            platform_verification_status=profile.platform_verification_status,
            is_verified=user.is_verified,
            documents=docs,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        )

    # ──────────────────────────────────────────────────────────
    # ADMIN: Update advocate verification status
    # ──────────────────────────────────────────────────────────

    @staticmethod
    async def admin_update_advocate_verification(
        db: AsyncSession,
        admin_user: User,
        advocate_id: uuid.UUID,
        req: AdminVerificationUpdateRequest,
    ) -> AdvocateProfileDetailResponse:
        """Admin updates advocate verification status (UNDER_REVIEW, VERIFIED, REJECTED)."""
        if admin_user.role != "ADMIN":
            raise ForbiddenException(message="Only administrators can update verification status.")

        prof_res = await db.execute(
            select(AdvocateProfile).where(AdvocateProfile.id == advocate_id)
        )
        profile = prof_res.scalar_one_or_none()
        if not profile:
            raise NotFoundException(message="Advocate profile not found.")

        # Prevent self-approval
        if profile.user_id == admin_user.id:
            raise ForbiddenException(
                message="Administrators cannot approve or update verification for their own advocate profile.",
            )

        new_status = req.status.upper().strip()

        # Update profile status
        profile.platform_verification_status = new_status

        # Sync user.is_verified flag
        user_res = await db.execute(select(User).where(User.id == profile.user_id))
        user = user_res.scalar_one_or_none()
        if user:
            if new_status == "VERIFIED":
                user.is_verified = True
            elif new_status == "REJECTED":
                user.is_verified = False

        # If a verification application exists, sync it
        app_res = await db.execute(
            select(AdvocateVerificationApplication).where(
                AdvocateVerificationApplication.advocate_id == profile.id
            )
        )
        app = app_res.scalar_one_or_none()
        if app:
            app.platform_verification_status = new_status
            if req.decision_reason:
                app.decision_reason = req.decision_reason
            if req.internal_notes:
                app.internal_notes = req.internal_notes
            if req.evidence_level:
                app.evidence_level = req.evidence_level
            if req.source_name:
                app.source_name = req.source_name
            if req.source_url:
                app.source_url = req.source_url
            app.reviewer_id = admin_user.id
            if new_status in ("VERIFIED", "REJECTED"):
                app.decided_at = datetime.now(timezone.utc)

        # Audit Log
        audit = AuditLog(
            actor_id=admin_user.id,
            action=f"ADVOCATE_VERIFICATION_STATUS_{new_status}",
            entity_type="advocate_profiles",
            entity_id=str(profile.id),
            payload_snapshot={
                "status": new_status,
                "reason": req.decision_reason,
                "evidence_level": req.evidence_level,
                "source_name": req.source_name,
                "advocate_id": str(profile.id),
                "user_id": str(profile.user_id),
            },
        )
        db.add(audit)
        await db.flush()

        logger.info(
            f"Admin {admin_user.email} updated advocate {profile.id} verification status to {new_status}."
        )

        return await AdvocateVerificationService.admin_get_advocate_by_id(db, profile.id)


