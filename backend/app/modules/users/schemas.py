"""Pydantic schemas for User Profile, DPDP Consent Ledger, Data Export, and Account Deletion."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------------------------------------------------------------------------
# Profile Schemas
# ---------------------------------------------------------------------------

class UserProfileResponse(BaseModel):
    """Authoritative user profile response from the database."""
    id: uuid.UUID
    email: str
    phone: str
    full_name: str
    role: str
    is_verified: bool
    is_active: bool
    preferred_language: str
    city: Optional[str] = None
    state: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdateRequest(BaseModel):
    """Fields permissible for citizen update. Privileged fields (role, is_verified, id) are forbidden."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=255, description="Full legal name")
    email: Optional[EmailStr] = Field(None, description="Official communication email")
    city: Optional[str] = Field(None, min_length=1, max_length=100, description="Jurisdictional city / district")
    state: Optional[str] = Field(None, min_length=1, max_length=100, description="Jurisdictional state")
    preferred_language: Optional[str] = Field(None, min_length=2, max_length=10, description="Language code e.g. en, hi, kn")

    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------------------
# DPDP Consent Ledger Schemas
# ---------------------------------------------------------------------------

class ConsentGrantRequest(BaseModel):
    """Explicit DPDP consent grant payload. Pre-selected checkboxes or implicit consent are disallowed."""
    consent_type: str = Field(
        ...,
        min_length=2,
        max_length=64,
        description="Statutory category: terms | privacy | dpdp | share_brief | share_documents",
    )
    version: str = Field(
        "1.0",
        min_length=1,
        max_length=20,
        description="Version of notice presented to the citizen",
    )
    purpose: str = Field(
        ...,
        min_length=5,
        max_length=1000,
        description="Explicit statutory purpose for processing personal data",
    )
    advocate_id: Optional[str] = Field(
        None,
        max_length=64,
        description="Empanelled counsel identifier if scope is advocate case sharing",
    )
    items_shared: Optional[List[str]] = Field(
        None,
        description="Specific records or documents authorized for transmission",
    )

    model_config = ConfigDict(extra="forbid")


class ConsentResponse(BaseModel):
    """Single consent event record in the audit ledger."""
    id: uuid.UUID
    user_id: uuid.UUID
    consent_type: str
    version: str
    purpose: str
    action: str
    advocate_id: Optional[str] = None
    items_shared: Optional[List[str]] = None
    is_revoked: bool
    revoked_at: Optional[datetime] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConsentStatusResponse(BaseModel):
    """Active and historical consent ledger overview."""
    consents: List[ConsentResponse]
    active_count: int
    revoked_count: int
    dpdp_notice: str = (
        "Technical controls for consent recording, revocation, and audit trails implemented pursuant "
        "to Section 6 of the Digital Personal Data Protection Act, 2023. Operational statutory compliance "
        "requires formal legal notice review and designated Data Protection Officer oversight."
    )


# ---------------------------------------------------------------------------
# Data Portability (Download My Data) Schemas
# ---------------------------------------------------------------------------

class DataExportResponse(BaseModel):
    """Statutory data export archive response under DPDP Act Section 11."""
    export_id: str
    status: str = "COMPLETED"
    user_id: uuid.UUID
    exported_at: datetime
    download_url: Optional[str] = None
    retention_disclaimer: str = (
        "Generated pursuant to Section 11 of the Digital Personal Data Protection Act, 2023. "
        "Contains only personal data and matter records authorized for citizen disclosure. "
        "Confidential judicial deliberations, attorney-client privileged advocate notes, and "
        "third-party identifiers are excluded in compliance with statutory confidentiality mandates."
    )
    data: Dict[str, Any]


# ---------------------------------------------------------------------------
# Right to Erasure / Account Deletion Schemas
# ---------------------------------------------------------------------------

class AccountDeleteRequest(BaseModel):
    """Explicit confirmation payload required to execute account purge."""
    confirmation: str = Field(
        ...,
        description="Must match 'CONFIRM_DELETE_NYAYASETU_ACCOUNT'",
    )
    reason: Optional[str] = Field(None, max_length=500, description="Optional citizen feedback for departure")

    model_config = ConfigDict(extra="forbid")


class AccountDeleteResponse(BaseModel):
    """Truthful deletion status confirming PII scrub, token revocation, and retention policy."""
    status: str = "PURGED"
    message: str
    user_id: uuid.UUID
    retention_policy: str
    purged_at: datetime
