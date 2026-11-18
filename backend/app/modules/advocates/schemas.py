"""Pydantic v2 schemas for Advocate Credential Verification System."""

import re
import uuid
from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ──────────────────────────────────────────────────────────────
# Enumerations
# ──────────────────────────────────────────────────────────────


class VerificationStatus(str, Enum):
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    NEEDS_MORE_INFORMATION = "NEEDS_MORE_INFORMATION"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class EvidenceLevel(str, Enum):
    DOCUMENTS_REVIEWED = "DOCUMENTS_REVIEWED"
    OFFICIAL_ROLL_MATCHED = "OFFICIAL_ROLL_MATCHED"
    COUNCIL_CONFIRMED = "COUNCIL_CONFIRMED"


class VerificationMethod(str, Enum):
    AUTOMATIC = "AUTOMATIC"
    MANUAL_ADMIN = "MANUAL_ADMIN"
    OFFICIAL_API = "OFFICIAL_API"


class DocumentType(str, Enum):
    ENROLLMENT_CERTIFICATE = "ENROLLMENT_CERTIFICATE"
    BAR_ID_CARD = "BAR_ID_CARD"
    AIBE_CERTIFICATE = "AIBE_CERTIFICATE"
    COP_CERTIFICATE = "COP_CERTIFICATE"


class AIBEStatus(str, Enum):
    PASSED = "PASSED"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    PENDING = "PENDING"


class COPStatus(str, Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class PlatformVerificationStatus(str, Enum):
    """Overall advocate platform verification status (derived from application lifecycle)."""
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    NEEDS_MORE_INFORMATION = "NEEDS_MORE_INFORMATION"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


# ──────────────────────────────────────────────────────────────
# Indian State Bar Council enrollment format patterns
# ──────────────────────────────────────────────────────────────

# Mapping: bar_council_name → regex pattern
# Not all State Bar Councils follow a uniform format.
# These are known patterns; unknown councils fall through to a generic check.
BAR_COUNCIL_ENROLLMENT_PATTERNS: dict[str, re.Pattern] = {
    "Bar Council of Delhi": re.compile(r"^D/\d{1,6}/\d{4}$"),
    "Bar Council of Maharashtra & Goa": re.compile(r"^MAH/\d{1,6}/\d{4}$"),
    "Bar Council of Maharashtra and Goa": re.compile(r"^MAH/\d{1,6}/\d{4}$"),
    "Bar Council of Uttar Pradesh": re.compile(r"^UP/\d{1,6}/\d{4}$"),
    "Bar Council of Tamil Nadu": re.compile(r"^TN/\d{1,6}/\d{4}$"),
    "Bar Council of Karnataka": re.compile(r"^KAR/\d{1,6}/\d{4}$"),
    "Bar Council of Kerala": re.compile(r"^KER/\d{1,6}/\d{4}$"),
    "Bar Council of West Bengal": re.compile(r"^WB/\d{1,6}/\d{4}$"),
    "Bar Council of Rajasthan": re.compile(r"^RAJ/\d{1,6}/\d{4}$"),
    "Bar Council of Gujarat": re.compile(r"^GUJ/\d{1,6}/\d{4}$"),
    "Bar Council of Andhra Pradesh": re.compile(r"^AP/\d{1,6}/\d{4}$"),
    "Bar Council of Telangana": re.compile(r"^TS/\d{1,6}/\d{4}$"),
    "Bar Council of Punjab & Haryana": re.compile(r"^P&H/\d{1,6}/\d{4}$"),
    "Bar Council of Punjab and Haryana": re.compile(r"^P&H/\d{1,6}/\d{4}$"),
    "Bar Council of Madhya Pradesh": re.compile(r"^MP/\d{1,6}/\d{4}$"),
    "Bar Council of Bihar": re.compile(r"^BIH/\d{1,6}/\d{4}$"),
    "Bar Council of Jharkhand": re.compile(r"^JH/\d{1,6}/\d{4}$"),
    "Bar Council of Odisha": re.compile(r"^ORI/\d{1,6}/\d{4}$"),
    "Bar Council of Assam": re.compile(r"^ASM/\d{1,6}/\d{4}$"),
    "Bar Council of Himachal Pradesh": re.compile(r"^HP/\d{1,6}/\d{4}$"),
    "Bar Council of Chhattisgarh": re.compile(r"^CG/\d{1,6}/\d{4}$"),
    "Bar Council of Uttarakhand": re.compile(r"^UK/\d{1,6}/\d{4}$"),
    "Bar Council of Jammu & Kashmir": re.compile(r"^J&K/\d{1,6}/\d{4}$"),
}

# Generic fallback: at least 3 chars, some alphanumeric content
GENERIC_ENROLLMENT_PATTERN = re.compile(r"^[A-Za-z0-9/&\-]{3,64}$")

# Valid Indian State Bar Councils
VALID_STATE_BAR_COUNCILS = [
    "Bar Council of Delhi",
    "Bar Council of Maharashtra & Goa",
    "Bar Council of Maharashtra and Goa",
    "Bar Council of Uttar Pradesh",
    "Bar Council of Tamil Nadu",
    "Bar Council of Karnataka",
    "Bar Council of Kerala",
    "Bar Council of West Bengal",
    "Bar Council of Rajasthan",
    "Bar Council of Gujarat",
    "Bar Council of Andhra Pradesh",
    "Bar Council of Telangana",
    "Bar Council of Punjab & Haryana",
    "Bar Council of Punjab and Haryana",
    "Bar Council of Madhya Pradesh",
    "Bar Council of Bihar",
    "Bar Council of Jharkhand",
    "Bar Council of Odisha",
    "Bar Council of Assam",
    "Bar Council of Himachal Pradesh",
    "Bar Council of Chhattisgarh",
    "Bar Council of Uttarakhand",
    "Bar Council of Jammu & Kashmir",
    "Bar Council of Jammu and Kashmir",
    "Bar Council of Goa",
    "Bar Council of Tripura",
    "Bar Council of Meghalaya",
    "Bar Council of Manipur",
    "Bar Council of Nagaland",
    "Bar Council of Sikkim",
    "Bar Council of Mizoram",
    "Bar Council of Arunachal Pradesh",
    "Bar Council of India",
]


def normalize_enrollment_number(enrollment_number: str) -> str:
    """Normalize enrollment number for deduplication and comparison.

    - Strips whitespace
    - Converts to uppercase
    - Normalizes separators (multiple slashes, dashes)
    """
    normalized = enrollment_number.strip().upper()
    # Collapse multiple slashes/dashes
    normalized = re.sub(r"[/\-]+", "/", normalized)
    # Remove trailing/leading separators
    normalized = normalized.strip("/")
    return normalized


def validate_enrollment_format(enrollment_number: str, bar_council_name: str) -> tuple[bool, str]:
    """Validate enrollment number format against council-specific patterns.

    Returns:
        (is_valid, message)
    """
    normalized = normalize_enrollment_number(enrollment_number)

    if not normalized:
        return False, "Enrollment number cannot be empty."

    # Try council-specific pattern
    pattern = BAR_COUNCIL_ENROLLMENT_PATTERNS.get(bar_council_name)
    if pattern:
        if pattern.match(normalized):
            return True, f"Enrollment number matches {bar_council_name} format."
        return False, (
            f"Enrollment number '{enrollment_number}' does not match the expected format "
            f"for {bar_council_name}."
        )

    # Fall back to generic alphanumeric pattern
    if GENERIC_ENROLLMENT_PATTERN.match(normalized):
        return True, "Enrollment number format accepted (generic validation; council-specific pattern not configured)."

    return False, f"Enrollment number '{enrollment_number}' contains invalid characters or is too short."


# ──────────────────────────────────────────────────────────────
# Request Schemas
# ──────────────────────────────────────────────────────────────


class VerificationApplicationRequest(BaseModel):
    """Advocate submits their verification application."""

    enrollment_number: str = Field(
        min_length=3, max_length=64,
        description="State Bar Council enrollment number as printed on the certificate.",
    )
    enrollment_name: str = Field(
        min_length=2, max_length=255,
        description="Full name exactly as printed on the enrollment certificate.",
    )
    state_bar_council: str = Field(
        min_length=5, max_length=128,
        description="Name of the State Bar Council (e.g., Bar Council of Delhi).",
    )
    enrollment_date: date = Field(
        description="Date of enrollment as printed on the certificate.",
    )
    aibe_status: AIBEStatus = Field(
        default=AIBEStatus.NOT_APPLICABLE,
        description="AIBE qualification status.",
    )
    cop_status: COPStatus = Field(
        default=COPStatus.NOT_APPLICABLE,
        description="Certificate of Practice status.",
    )
    contact_phone: Optional[str] = Field(
        default=None, max_length=20,
        description="Contact phone number for verification purposes.",
    )
    contact_email: Optional[str] = Field(
        default=None, max_length=255,
        description="Contact email for verification correspondence.",
    )

    @field_validator("enrollment_date")
    @classmethod
    def validate_enrollment_date(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Enrollment date cannot be in the future.")
        return v


class AdminDecisionRequest(BaseModel):
    """Admin submits a verification decision."""

    decision: str = Field(
        description="VERIFIED or REJECTED",
    )
    evidence_level: Optional[str] = Field(
        default=None,
        description="DOCUMENTS_REVIEWED, OFFICIAL_ROLL_MATCHED, or COUNCIL_CONFIRMED",
    )
    verification_method: str = Field(
        default="MANUAL_ADMIN",
        description="Verification method used.",
    )
    source_name: Optional[str] = Field(
        default=None, max_length=128,
        description="Name of the official source consulted (e.g., 'Bar Council of Delhi Online Roll').",
    )
    source_url: Optional[str] = Field(
        default=None, max_length=512,
        description="URL or reference of the official source consulted.",
    )
    decision_reason: str = Field(
        min_length=5, max_length=2000,
        description="Mandatory reason for approval or rejection.",
    )
    internal_notes: Optional[str] = Field(
        default=None, max_length=2000,
        description="Private internal notes (never exposed to the advocate or citizens).",
    )

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, v: str) -> str:
        normalized = v.upper().strip()
        if normalized not in ("VERIFIED", "REJECTED"):
            raise ValueError("Decision must be 'VERIFIED' or 'REJECTED'.")
        return normalized

    @field_validator("evidence_level")
    @classmethod
    def validate_evidence_level(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        normalized = v.upper().strip()
        if normalized not in ("DOCUMENTS_REVIEWED", "OFFICIAL_ROLL_MATCHED", "COUNCIL_CONFIRMED"):
            raise ValueError(
                "evidence_level must be one of: DOCUMENTS_REVIEWED, OFFICIAL_ROLL_MATCHED, COUNCIL_CONFIRMED."
            )
        return normalized


class AdminRequestInfoRequest(BaseModel):
    """Admin requests additional information from the advocate."""

    message: str = Field(
        min_length=10, max_length=2000,
        description="Specific information or documents requested from the advocate.",
    )
    internal_notes: Optional[str] = Field(
        default=None, max_length=2000,
        description="Private internal notes.",
    )


# ──────────────────────────────────────────────────────────────
# Response Schemas
# ──────────────────────────────────────────────────────────────


class VerificationDocumentResponse(BaseModel):
    """Document metadata returned to the advocate (never includes storage_key)."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    verification_type: str
    filename: Optional[str] = None
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    status: str
    created_at: datetime


class VerificationApplicationResponse(BaseModel):
    """Verification application status visible to the advocate."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    enrollment_number: str
    enrollment_name: str
    state_bar_council: str
    enrollment_date: Optional[date] = None
    aibe_status: Optional[str] = None
    cop_status: Optional[str] = None
    platform_verification_status: str
    evidence_level: Optional[str] = None
    verification_method: Optional[str] = None
    # Decision reason visible to the advocate (redacted internal notes)
    decision_reason: Optional[str] = None
    info_request_message: Optional[str] = None
    submitted_at: Optional[datetime] = None
    decided_at: Optional[datetime] = None
    created_at: datetime
    documents: List[VerificationDocumentResponse] = []


class AdminVerificationDetailResponse(BaseModel):
    """Full verification details visible to admin reviewers."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    advocate_profile_id: uuid.UUID
    advocate_user_id: uuid.UUID
    advocate_name: str
    advocate_email: str
    enrollment_number: str
    enrollment_number_normalized: str
    enrollment_name: str
    state_bar_council: str
    enrollment_date: Optional[date] = None
    aibe_status: Optional[str] = None
    cop_status: Optional[str] = None
    platform_verification_status: str
    evidence_level: Optional[str] = None
    verification_method: Optional[str] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    decision_reason: Optional[str] = None
    internal_notes: Optional[str] = None
    info_request_message: Optional[str] = None
    reviewer_id: Optional[uuid.UUID] = None
    reviewer_name: Optional[str] = None
    submitted_at: Optional[datetime] = None
    decided_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    documents: List[VerificationDocumentResponse] = []


class AdminVerificationListItem(BaseModel):
    """Summary item for admin verification listing."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    advocate_name: str
    state_bar_council: str
    enrollment_number: str
    platform_verification_status: str
    aibe_status: Optional[str] = None
    cop_status: Optional[str] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime


class AdminVerificationListResponse(BaseModel):
    """Paginated list of verification applications for admin."""
    items: List[AdminVerificationListItem]
    total: int
    page: int
    page_size: int


class MatchingAdvocateResponse(BaseModel):
    """Public advocate profile for matching results (only verified advocates)."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    bar_council_name: str
    primary_practice: str
    in_practice_years: int
    city: str
    state: str
    is_verified: bool
    fixed_consultation_fee_inr: Optional[float] = None


# ──────────────────────────────────────────────────────────────
# Advocate Registration & Application Schemas (Part 1 - 8)
# ──────────────────────────────────────────────────────────────


class AdvocateApplyRequest(BaseModel):
    """Advocate submits full professional profile."""

    full_name: str = Field(min_length=2, max_length=255, description="Full legal name")
    email: str = Field(description="Advocate email address")
    phone: str = Field(min_length=10, max_length=20, description="10-digit Indian phone number")
    bar_council_id: str = Field(min_length=3, max_length=64, description="Bar Council Enrollment number (e.g. D/1234/2006)")
    bar_council_name: str = Field(min_length=3, max_length=128, description="State Bar Council name")
    practice_areas: Optional[List[str]] = Field(default=None, description="Practice areas (e.g. ['Trials & Disputes', 'Corporate'])")
    primary_practice: Optional[str] = Field(default=None, max_length=64)
    secondary_practices: Optional[List[str]] = Field(default=None)
    courts_of_practice: Optional[List[str]] = Field(default=None, description="Courts and jurisdictions")
    languages: Optional[List[str]] = Field(default=None, description="Languages spoken")
    years_of_experience: Optional[int] = Field(default=None, ge=0, description="Years in active court practice")
    in_practice_years: Optional[int] = Field(default=None, ge=0)
    city: str = Field(min_length=2, max_length=128)
    district: Optional[str] = Field(default=None, max_length=128)
    state: str = Field(min_length=2, max_length=128)
    pincode: Optional[str] = Field(default=None, max_length=10)
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    password: Optional[str] = Field(default=None, min_length=8, max_length=128, description="Password required if registering fresh account")
    preferred_language: Optional[str] = Field(default="en", max_length=10)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one numeral.")
        if not any(char.isalpha() for char in v):
            raise ValueError("Password must contain at least one alphabetical letter.")
        return v


class AdvocateProfileDetailResponse(BaseModel):
    """Full advocate profile response."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: str
    phone: str
    bar_council_id: str
    bar_council_name: str
    practice_areas: List[str] = []
    primary_practice: str
    secondary_practices: Optional[List[str]] = None
    courts_of_practice: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    years_of_experience: int
    city: str
    district: Optional[str] = None
    state: str
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    platform_verification_status: str
    is_verified: bool
    documents: List[VerificationDocumentResponse] = []
    created_at: datetime
    updated_at: datetime


class AdminVerificationUpdateRequest(BaseModel):
    """Admin updates advocate verification status."""

    status: str = Field(
        description="UNDER_REVIEW, VERIFIED, or REJECTED",
    )
    decision_reason: Optional[str] = Field(
        default=None, max_length=2000,
        description="Reason for verification decision",
    )
    internal_notes: Optional[str] = Field(
        default=None, max_length=2000,
        description="Internal reviewer notes",
    )
    evidence_level: Optional[str] = Field(
        default=None,
        description="DOCUMENTS_REVIEWED, OFFICIAL_ROLL_MATCHED, or COUNCIL_CONFIRMED",
    )
    source_name: Optional[str] = Field(
        default=None, max_length=128,
        description="Official roll or source consulted",
    )
    source_url: Optional[str] = Field(
        default=None, max_length=512,
    )

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        normalized = v.upper().strip()
        if normalized not in ("UNDER_REVIEW", "VERIFIED", "REJECTED"):
            raise ValueError("status must be 'UNDER_REVIEW', 'VERIFIED', or 'REJECTED'.")
        return normalized


class AdminPendingAdvocateItem(BaseModel):
    """Summary item for admin pending advocates queue."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: str
    phone: str
    bar_council_id: str
    bar_council_name: str
    primary_practice: str
    practice_areas: List[str] = []
    years_of_experience: int
    city: str
    district: Optional[str] = None
    state: str
    platform_verification_status: str
    documents_count: int = 0
    created_at: datetime


class AdminPendingAdvocatesResponse(BaseModel):
    """Paginated list of pending advocate applications for admin."""
    items: List[AdminPendingAdvocateItem]
    total: int
    page: int
    page_size: int

