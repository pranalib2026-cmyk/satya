"""Pydantic v2 schemas for Case Intake and Triage."""

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CaseCreateRequest(BaseModel):
    """Payload for submitting a new case for intake and initial evaluation."""

    title: str = Field(..., min_length=3, max_length=255, description="Brief title summarizing the legal matter")
    problem_description: str = Field(..., min_length=10, description="Detailed narrative of user's legal dispute or inquiry")
    legal_issue_category: str = Field(..., min_length=2, max_length=64, description="Legal domain category (e.g., Consumer, Criminal, Family, Property, Cheque Bounce)")
    state: str = Field(..., min_length=2, max_length=128, description="State of occurrence / jurisdiction")
    district: str = Field(..., min_length=2, max_length=128, description="District of occurrence / residence")
    relevant_court: Optional[str] = Field(None, max_length=128, description="Known court, tribunal, or dispute forum")
    incident_date: Optional[date] = Field(None, description="Date when cause of action or dispute arose")
    preferred_language: str = Field("en", min_length=2, max_length=10, description="Preferred language code (en, hi, mr, ta, etc.)")
    urgency: str = Field("standard-30d", description="Urgency timeframe: emergency-24h, urgent-48h, standard-30d, exploratory")
    supporting_info: Optional[str] = Field(None, description="Additional context, witness information, claim amounts, or background")
    adverse_parties: Optional[str] = Field(None, description="Names of adverse individuals, organizations, or opposing counsel")


class CaseUpdateRequest(BaseModel):
    """Payload for updating mutable fields of a citizen case."""

    title: Optional[str] = Field(None, min_length=3, max_length=255)
    problem_description: Optional[str] = Field(None, min_length=10)
    legal_issue_category: Optional[str] = Field(None, min_length=2, max_length=64)
    state: Optional[str] = Field(None, min_length=2, max_length=128)
    district: Optional[str] = Field(None, min_length=2, max_length=128)
    relevant_court: Optional[str] = Field(None, max_length=128)
    incident_date: Optional[date] = None
    preferred_language: Optional[str] = Field(None, min_length=2, max_length=10)
    urgency: Optional[str] = None
    supporting_info: Optional[str] = None
    adverse_parties: Optional[str] = None
    stage: Optional[str] = None


class TriageOutputResponse(BaseModel):
    """Structured legal assessment produced by the Case Triage Engine."""

    identified_category: str = Field(..., description="Normalized legal issue domain")
    summary_of_facts: str = Field(..., description="Synthesized objective summary of facts disclosed")
    missing_information: List[str] = Field(default_factory=list, description="Crucial missing factual or documentary information")
    possible_jurisdiction: str = Field(..., description="Suggested court, tribunal, or statutory authority")
    urgency_level: str = Field(..., description="Urgency rating: EMERGENCY_24H | URGENT_48H | STANDARD_30D | EXPLORATORY")
    complexity: str = Field(..., description="Matter complexity rating: LOW | MEDIUM | HIGH")
    suggested_next_step: str = Field(..., description="Recommended action: SELF_HELP | FREE_LEGAL_AID | ADVOCATE_CONSULTATION | URGENT_ASSISTANCE")
    advocate_assistance_appropriate: bool = Field(..., description="Whether engaging legal counsel is recommended")
    show_free_legal_aid: bool = Field(..., description="Whether to present NALSA / DLSA free legal aid resources")
    assessed_at: datetime = Field(..., description="Timestamp of triage assessment")

    model_config = ConfigDict(from_attributes=True)


class CaseResponse(BaseModel):
    """Complete representation of a LegalCase entity."""

    id: UUID
    case_reference: str
    client_id: UUID
    title: str
    problem_description: Optional[str] = None
    legal_issue_category: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    relevant_court: Optional[str] = None
    incident_date: Optional[date] = None
    preferred_language: str
    urgency: str
    supporting_info: Optional[str] = None
    adverse_parties: Optional[str] = None
    stage: str
    conflict_status: str
    triage_result: Optional[TriageOutputResponse] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CaseListResponse(BaseModel):
    """Paginated collection of cases belonging to the authenticated client."""

    total: int
    page: int
    limit: int
    items: List[CaseResponse]
