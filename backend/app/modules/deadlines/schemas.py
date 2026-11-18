"""Pydantic schemas for Deadline Management and Limitation Tracking."""

import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DeadlineCreateRequest(BaseModel):
    """Payload for creating a case deadline or limitation tracking entry."""

    case_id: uuid.UUID = Field(..., description="ID of the associated legal case")
    title: str = Field(..., min_length=3, max_length=255, description="Short title of the deadline")
    description: Optional[str] = Field(None, max_length=2000, description="Detailed instructions or facts")
    deadline_type: str = Field(
        "STATUTORY_LIMITATION",
        description="STATUTORY_LIMITATION | COURT_HEARING | FILING_RESPONSE | NOTICE_EXPIRY | GENERAL",
    )
    source_basis: Optional[str] = Field(
        None,
        max_length=255,
        description="Legal authority e.g., Limitation Act 1963, Order VIII Rule 1 CPC, Court Order",
    )
    statutory_provision: Optional[str] = Field(
        None,
        max_length=128,
        description="Specific legal section e.g., Section 138(c) Negotiable Instruments Act",
    )
    due_date: datetime = Field(..., description="Target due date and time with timezone")
    priority: str = Field("HIGH", description="CRITICAL | HIGH | MEDIUM | LOW")
    reminder_days_before: Optional[List[int]] = Field(
        default=[7, 3, 1],
        description="List of integer days prior to due_date to trigger notification alerts",
    )


class DeadlineConfirmRequest(BaseModel):
    """Payload for advocate statutory review and confirmation of a deadline."""

    verified_statutory_basis: Optional[str] = Field(
        None,
        max_length=255,
        description="Verified citation or statutory basis confirmed by advocate",
    )
    confirmation_notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Advocate notes regarding limitation, court holidays, or filing strategy",
    )


class DeadlineResponse(BaseModel):
    """Representation of a case deadline."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_id: uuid.UUID
    case_reference: Optional[str] = None
    title: str
    description: Optional[str] = None
    deadline_type: str
    source_basis: Optional[str] = None
    statutory_provision: Optional[str] = None
    due_date: datetime
    priority: str
    is_advocate_confirmed: bool
    confirmed_by_advocate_id: Optional[uuid.UUID] = None
    confirmed_at: Optional[datetime] = None
    is_completed: bool
    completed_at: Optional[datetime] = None
    reminders_json: Optional[dict] = None
    created_at: datetime
    updated_at: datetime


class DeadlineListResponse(BaseModel):
    """Paginated list of case deadlines."""

    total: int
    items: List[DeadlineResponse]
