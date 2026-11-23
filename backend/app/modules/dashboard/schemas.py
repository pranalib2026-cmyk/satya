"""Pydantic schemas for the Consolidated Dashboard Overview API."""

import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DashboardDeadlineResponse(BaseModel):
    """Statutory limitation or court calendar deadline record."""
    id: uuid.UUID
    case_id: uuid.UUID
    title: str
    date: str = Field(..., description="ISO Date string (YYYY-MM-DD)")
    due_date: datetime
    days_remaining: int
    urgent: bool
    priority: str
    basis: str
    confirmed: bool
    is_confirmed: bool

    model_config = ConfigDict(from_attributes=True)


class DashboardRecentCaseResponse(BaseModel):
    """Authoritative recent case dossier summary for the active matter ledger card."""
    id: uuid.UUID
    case_reference: str
    title: str
    category: str
    court_forum: str
    stage: str
    stage_label: str
    stage_step: int
    progress_percentage: int
    status: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardAppointmentResponse(BaseModel):
    """Upcoming consultation appointment."""
    id: uuid.UUID
    booking_reference: str
    advocate_name: str
    scheduled_start: datetime
    mode: str
    status: str

    model_config = ConfigDict(from_attributes=True)


class DashboardSummaryResponse(BaseModel):
    """Authoritative dashboard summary aggregating metrics, matters, deadlines, and consultations."""
    # Strict database metrics
    active_cases: int = Field(..., description="Active cases (stage != 'DISPOSED')")
    pending_cases: int = Field(..., description="Pending triage or clearance cases")
    completed_cases: int = Field(..., description="Completed cases (stage == 'DISPOSED')")
    total_cases: int = Field(..., description="Total case dossiers belonging to authenticated user")
    unread_messages: int = Field(..., description="Unread communications in user's cases")
    pending_actions: int = Field(..., description="Unconfirmed statutory limitation dates & pending requests")

    # Direct client compatibility aliases (camelCase)
    activeCases: int = 0
    unreadMessages: int = 0
    pendingActions: int = 0

    # Structured entities (None / empty when user has no records)
    recent_case: Optional[DashboardRecentCaseResponse] = None
    recentCase: Optional[DashboardRecentCaseResponse] = None

    next_deadline: Optional[DashboardDeadlineResponse] = None
    upcoming_deadlines: List[DashboardDeadlineResponse] = []
    deadlines: List[DashboardDeadlineResponse] = []

    upcoming_appointment: Optional[DashboardAppointmentResponse] = None

    model_config = ConfigDict(from_attributes=True)
