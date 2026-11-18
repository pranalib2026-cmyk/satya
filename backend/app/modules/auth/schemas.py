"""Pydantic v2 schemas for Authentication and Authorization."""

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserRole(str, Enum):
    """Enforced application account roles."""
    CITIZEN = "CITIZEN"
    ADVOCATE = "ADVOCATE"
    ADMIN = "ADMIN"


class UserResponse(BaseModel):
    """Safe user profile response payload — NEVER exposes password hashes."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    phone: str
    full_name: str
    role: str
    is_verified: bool
    is_active: bool
    preferred_language: str
    created_at: datetime


class CitizenRegisterRequest(BaseModel):
    """Citizen account onboarding payload."""

    full_name: str = Field(min_length=2, max_length=255, description="Full legal name")
    email: EmailStr = Field(description="Corporate or personal email address")
    phone: str = Field(min_length=10, max_length=20, description="10-digit Indian telephone (+91)")
    password: str = Field(min_length=8, max_length=128, description="Minimum 8-character password")
    preferred_language: Optional[str] = Field(default="en", max_length=10)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one numeral.")
        if not any(char.isalpha() for char in v):
            raise ValueError("Password must contain at least one alphabetical letter.")
        return v


class AdvocateRegisterRequest(BaseModel):
    """Advocate account onboarding payload with Bar Council credentials."""

    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    phone: str = Field(min_length=10, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    bar_council_id: str = Field(min_length=3, max_length=64, description="Bar Council Enrolment ID (e.g. D/1234/2006)")
    bar_council_name: str = Field(min_length=3, max_length=128, description="State Bar Council name")
    in_practice_years: int = Field(ge=0, description="Years in active court practice")
    primary_practice: str = Field(min_length=3, max_length=64, description="Primary legal domain")
    city: str = Field(min_length=2, max_length=128)
    state: str = Field(min_length=2, max_length=128)
    pincode: Optional[str] = Field(default=None, max_length=10)
    preferred_language: Optional[str] = Field(default="en", max_length=10)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one numeral.")
        if not any(char.isalpha() for char in v):
            raise ValueError("Password must contain at least one alphabetical letter.")
        return v


class UniversalRegisterRequest(BaseModel):
    """Polymorphic registration request for the primary POST /auth/register endpoint."""

    account_type: str = Field(
        default="CITIZEN",
        description="CITIZEN or ADVOCATE (ADMIN registration is strictly forbidden)",
    )
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    phone: str = Field(min_length=10, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    preferred_language: Optional[str] = Field(default="en", max_length=10)

    # Advocate-specific fields (required when account_type is ADVOCATE)
    bar_council_id: Optional[str] = Field(default=None, max_length=64)
    bar_council_name: Optional[str] = Field(default=None, max_length=128)
    in_practice_years: Optional[int] = Field(default=None, ge=0)
    primary_practice: Optional[str] = Field(default=None, max_length=64)
    city: Optional[str] = Field(default=None, max_length=128)
    state: Optional[str] = Field(default=None, max_length=128)
    pincode: Optional[str] = Field(default=None, max_length=10)

    @field_validator("account_type")
    @classmethod
    def validate_account_type(cls, v: str) -> str:
        normalized = v.upper().strip()
        if normalized == "ADMIN":
            raise ValueError("ADMIN role cannot be self-assigned. Registration forbidden.")
        if normalized not in ("CITIZEN", "ADVOCATE"):
            raise ValueError("account_type must be either 'CITIZEN' or 'ADVOCATE'.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one numeral.")
        if not any(char.isalpha() for char in v):
            raise ValueError("Password must contain at least one alphabetical letter.")
        return v


class LoginRequest(BaseModel):
    """Credential login payload."""

    email: EmailStr
    password: str = Field(min_length=1, description="Account password")


class TokenRefreshRequest(BaseModel):
    """Payload to exchange a valid refresh token for a rotated key pair."""

    refresh_token: str = Field(min_length=10, description="Current JWT refresh token")


class LogoutRequest(BaseModel):
    """Optional payload specifying which refresh token to invalidate."""

    refresh_token: Optional[str] = Field(default=None, description="Optional refresh token to explicitly revoke")


class TokenResponse(BaseModel):
    """Authentication success payload returning access and refresh tokens."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token lifespan in seconds")
    user: UserResponse
