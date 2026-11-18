"""Pydantic v2 schemas for Appointments and Consultations."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AppointmentCreateRequest(BaseModel):
    """Payload to book or request a consultation appointment with an advocate."""

    advocate_id: UUID = Field(..., description="Targeted verified advocate profile ID")
    case_id: Optional[UUID] = Field(None, description="Associated case matter if booking from case dossier")
    scheduled_start: datetime = Field(..., description="Consultation start time in ISO-8601 with timezone")
    scheduled_end: datetime = Field(..., description="Consultation end time in ISO-8601 with timezone")
    mode: str = Field("VIDEO_CONFERENCE", description="VIDEO_CONFERENCE | IN_CHAMBERS | PHONE")
    timezone: str = Field("Asia/Kolkata", description="IANA Timezone identifier")
    client_notes: Optional[str] = Field(None, description="Brief description of the consultation goal")
    fee_inr: Optional[float] = Field(None, ge=0, description="Agreed consultation fee in INR")


class AppointmentStatusUpdateRequest(BaseModel):
    """Payload for advocate to accept, reject, or complete appointment."""

    status: str = Field(..., description="CONFIRMED | REJECTED | COMPLETED | CANCELLED")
    rejection_reason: Optional[str] = Field(None, description="Reason if appointment request is rejected")
    meeting_link: Optional[str] = Field(None, description="Video conference room URL")


class AppointmentResponse(BaseModel):
    """Detailed response for an appointment booking."""

    id: UUID
    booking_reference: str
    case_id: Optional[UUID] = None
    advocate_id: UUID
    advocate_name: Optional[str] = None
    client_id: UUID
    client_name: Optional[str] = None
    scheduled_start: datetime
    scheduled_end: datetime
    timezone: str
    status: str
    mode: str
    meeting_link: Optional[str] = None
    fee_inr: float
    payment_status: str
    client_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AppointmentListResponse(BaseModel):
    """Paginated collection of appointments."""

    total: int
    page: int
    limit: int
    items: List[AppointmentResponse]
