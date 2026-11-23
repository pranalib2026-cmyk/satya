"""Users and Profiles API Router.

Implements User Dossier, DPDP Act 2023 Consent Ledger, Data Portability (§11),
and Right to Erasure (§12).
"""

import uuid
from typing import List
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user
from app.modules.users.models import User
from app.modules.users.schemas import (
    AccountDeleteRequest,
    AccountDeleteResponse,
    ConsentGrantRequest,
    ConsentResponse,
    ConsentStatusResponse,
    DataExportResponse,
    UserProfileResponse,
    UserProfileUpdateRequest,
)
from app.modules.users.service import UserService

router = APIRouter(prefix="/users", tags=["Users & Profiles"])


@router.get("/status", summary="Users Module Status")
async def get_users_status():
    return {"module": "users", "status": "initialized", "active": True}


# ---------------------------------------------------------------------------
# User Profile Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Authenticated User Profile",
    description="Retrieve the authenticated user's authoritative profile record from PostgreSQL.",
)
async def get_my_profile(
    current_user: User = Depends(get_current_active_user),
) -> UserProfileResponse:
    return UserService.get_profile(current_user)


@router.put(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Authenticated User Profile",
    description="Update mutable profile fields (name, email, city, state, language). Role or verification escalation is forbidden.",
)
async def update_my_profile(
    payload: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    updated_user = await UserService.update_profile(db=db, user=current_user, data=payload)
    return UserService.get_profile(updated_user)


# ---------------------------------------------------------------------------
# DPDP Consent Ledger Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/me/consents",
    response_model=ConsentStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="List DPDP Consents",
    description="List active and historical DPDP consents with current active and revoked counts.",
)
async def list_my_consents(
    active_only: bool = Query(False, description="Filter for only active, unrevoked consent grants"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConsentStatusResponse:
    all_consents = await UserService.get_consents(db=db, user=current_user, active_only=False)
    active_count = sum(1 for c in all_consents if not c.is_revoked)
    revoked_count = sum(1 for c in all_consents if c.is_revoked)

    filtered_consents = [c for c in all_consents if not c.is_revoked] if active_only else all_consents

    return ConsentStatusResponse(
        consents=[ConsentResponse.model_validate(c) for c in filtered_consents],
        active_count=active_count,
        revoked_count=revoked_count,
    )


@router.post(
    "/me/consents",
    response_model=ConsentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record DPDP Consent Grant",
    description="Record an explicit statutory consent grant with purpose, version, and client audit metadata.",
)
async def grant_consent(
    payload: ConsentGrantRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConsentResponse:
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    consent = await UserService.record_consent(
        db=db,
        user=current_user,
        data=payload,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return ConsentResponse.model_validate(consent)


@router.get(
    "/me/consents/history",
    response_model=List[ConsentResponse],
    status_code=status.HTTP_200_OK,
    summary="Full Consent Audit Ledger",
    description="Retrieve the complete, immutable chronological audit ledger of all grants and withdrawals.",
)
async def get_consent_history(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> List[ConsentResponse]:
    history = await UserService.get_consent_history(db=db, user=current_user)
    return [ConsentResponse.model_validate(c) for c in history]


@router.post(
    "/me/consents/{consent_id}/withdraw",
    response_model=ConsentResponse,
    status_code=status.HTTP_200_OK,
    summary="Withdraw DPDP Consent Grant",
    description="Immediately revoke a consent grant and record an immutable audit revocation entry.",
)
async def withdraw_consent(
    consent_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConsentResponse:
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    revoked = await UserService.withdraw_consent(
        db=db,
        user=current_user,
        consent_id=consent_id,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return ConsentResponse.model_validate(revoked)


# ---------------------------------------------------------------------------
# Data Portability & Right to Erasure Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/me/data-export",
    response_model=DataExportResponse,
    status_code=status.HTTP_200_OK,
    summary="Download My Data (DPDP §11)",
    description="Generate a complete, portable JSON archive of the authenticated user's personal dossier and court matters.",
)
async def export_my_data(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> DataExportResponse:
    return await UserService.export_user_data(db=db, user=current_user)


@router.get(
    "/me/data-export/{export_id}",
    status_code=status.HTTP_200_OK,
    summary="Download Exported JSON Archive",
    description="Retrieve the generated data export archive bytes directly from persistent storage.",
)
async def download_exported_data(
    export_id: str,
    current_user: User = Depends(get_current_active_user),
):
    from fastapi.responses import Response
    from app.core.storage import get_storage_provider
    from app.core.errors import NotFoundException

    storage_provider = get_storage_provider()
    storage_key = f"exports/{current_user.id}/{export_id}.json"

    if not await storage_provider.exists(storage_key):
        raise NotFoundException("Export archive not found or expired")

    content = await storage_provider.download(storage_key)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="nyayasetu_export_{export_id}.json"',
        },
    )


@router.delete(
    "/me",
    response_model=AccountDeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Purge Citizen Account (DPDP §12)",
    description="Execute DPDP Act Right to Erasure. Revokes tokens, scrubs PII, and applies statutory judicial retention policy.",
)
async def delete_my_account(
    payload: AccountDeleteRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> AccountDeleteResponse:
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await UserService.delete_or_anonymize_user(
        db=db,
        user=current_user,
        confirmation=payload.confirmation,
        ip_address=client_ip,
        user_agent=user_agent,
    )
