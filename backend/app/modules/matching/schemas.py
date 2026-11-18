"""Pydantic v2 schemas for the Advocate Matching Engine and Consultation Requests."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AdvocateMatchItem(BaseModel):
    """Detailed profile of a matched, verified advocate."""

    advocate_id: UUID = Field(..., description="Unique AdvocateProfile identifier")
    user_id: UUID = Field(..., description="Associated User identifier")
    full_name: str = Field(..., description="Advocate's professional name")
    bar_council_id: str = Field(..., description="Bar Council Enrollment ID (e.g. D/1089/2014)")
    bar_council_name: str = Field(..., description="State Bar Council")
    verified_status: str = Field("VERIFIED", description="Platform credential verification status")
    years_of_experience: int = Field(..., description="Active years of courtroom and dispute practice")
    primary_practice: str = Field(..., description="Primary practice domain")
    relevant_practice_areas: List[str] = Field(default_factory=list, description="Practices aligning with case category")
    court_compatibility: List[str] = Field(default_factory=list, description="Courts aligning with case forum or jurisdiction")
    language_compatibility: List[str] = Field(default_factory=list, description="Languages shared with citizen")
    city: str = Field(..., description="Chamber / office city")
    district: Optional[str] = Field(None, description="District of practice")
    state: str = Field(..., description="State of enrollment and practice")
    approximate_distance_km: Optional[float] = Field(None, description="Geodesic distance between client and advocate chamber")
    match_score_percentage: float = Field(..., description="Normalized compatibility score (0-100%) based on configurable weights")
    match_factors: Dict[str, float] = Field(default_factory=dict, description="Factor breakdown: practice, jurisdiction, language, proximity, availability")
    match_explanation: str = Field(..., description="Factual, objective justification of why candidate meets the case requirements")
    consultation_request_availability: bool = Field(True, description="Whether advocate accepts private consultation requests")
    fixed_consultation_fee_inr: Optional[float] = Field(None, description="Fixed initial consultation fee in INR")
    hourly_rate_inr: Optional[float] = Field(None, description="Standard hourly rate in INR")

    model_config = ConfigDict(from_attributes=True)


class CaseMatchingResponse(BaseModel):
    """Container for matched advocate candidates for a specific legal case."""

    case_id: UUID
    case_reference: str
    case_title: str
    category: str
    state: Optional[str] = None
    district: Optional[str] = None
    total_candidates_evaluated: int
    total_matches_returned: int
    matches: List[AdvocateMatchItem]

    model_config = ConfigDict(from_attributes=True)


class ConsultationRequestCreate(BaseModel):
    """Payload to initiate a private consultation request with a matched advocate."""

    case_id: Optional[UUID] = Field(None, description="Associated LegalCase identifier if initiated from case dossier")
    targeted_advocate_id: UUID = Field(..., description="Identifier of the targeted verified advocate profile")
    preferred_practice: Optional[str] = Field(None, description="Practice group (defaults to case category if omitted)")
    urgency: Optional[str] = Field("standard-30d", description="Urgency: emergency-24h, urgent-48h, standard-30d, exploratory")
    legal_problem_summary: Optional[str] = Field(None, description="Statement of legal dispute (defaults to case narrative)")
    adverse_party_names: Optional[str] = Field(None, description="Adverse entities for conflict clearance checks")
    budget_inr: Optional[float] = Field(None, ge=0, description="Preferred consultation budget in INR")
    notes: Optional[str] = Field(None, description="Additional notes or meeting preferences")


class ConsultationRequestResponse(BaseModel):
    """Complete representation of a ConsultationRequest entity."""

    id: UUID
    reference_code: str
    client_id: Optional[UUID] = None
    targeted_advocate_id: Optional[UUID] = None
    targeted_advocate_name: Optional[str] = None
    preferred_practice: str
    urgency: str
    legal_problem_summary: str
    adverse_party_names: str
    status: str
    source_screen: str
    budget_inr: Optional[float] = None
    triage_notes_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConsultationRequestListResponse(BaseModel):
    """Paginated collection of consultation requests."""

    total: int
    page: int
    limit: int
    items: List[ConsultationRequestResponse]
