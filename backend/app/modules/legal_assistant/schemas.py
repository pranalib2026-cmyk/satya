"""Pydantic v2 schemas for the Legal AI Assistant (RAG)."""

from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LegalAskRequest(BaseModel):
    """Payload for submitting a legal inquiry to the Legal AI Assistant."""

    query: str = Field(..., min_length=3, max_length=2000, description="The legal question or grievance description")
    jurisdiction: Optional[str] = Field(None, description="Optional jurisdiction filter (e.g., Union of India, Maharashtra, Delhi)")
    preferred_language: str = Field("en", description="Target language code: 'en' (English), 'hi' (Hindi), 'kn' (Kannada)")
    max_sources: int = Field(5, ge=1, le=10, description="Maximum number of supporting legal chunks to retrieve")


class CitationItem(BaseModel):
    """Verified statutory or judicial citation grounded in official source records."""

    source_title: str = Field(..., description="Official Act title or published judgment name")
    source_type: str = Field(..., description="BARE_ACT | COURT_JUDGMENT | GAZETTE_NOTIFICATION | LEGAL_AID_SCHEME")
    act_or_judgment_identifier: Optional[str] = Field(None, description="Official Act number or citation (e.g., Act No. 26 of 1881)")
    section_or_paragraph: Optional[str] = Field(None, description="Specific statutory section or judgment paragraph")
    clause_heading: Optional[str] = Field(None, description="Official section heading or ratio headline")
    official_source_url: Optional[str] = Field(None, description="Government gazette, e-Courts, or IndiaCode URL")
    content_checksum: Optional[str] = Field(None, description="SHA-256 checksum of verified source chunk")
    is_verified_in_corpus: bool = Field(True, description="Strictly verified against retrieved knowledge base records")

    model_config = ConfigDict(from_attributes=True)


class LegalAskResponse(BaseModel):
    """Structured response from the Legal AI Assistant."""

    query: str
    detected_language: str = Field(..., description="Identified question language (en, hi, kn)")
    answer: str = Field(..., description="Factual, grounded legal explanation derived strictly from retrieved sources")
    sources_found: bool = Field(..., description="Whether supporting statutory provisions were located in the curated corpus")
    citations: List[CitationItem] = Field(default_factory=list, description="Verified citations corresponding to the answer")
    unverified_citations_detected: List[str] = Field(default_factory=list, description="Citations pruned due to lack of corpus backing")
    suggested_next_steps: List[str] = Field(default_factory=list, description="Actionable statutory next steps (e.g., notice, advocate consultation)")
    disclaimer: str = Field(
        default=(
            "NyayaSetu AI Legal Assistant provides informational guidance derived strictly from official Indian Bare Acts "
            "and published judicial precedents. This information does not constitute formal legal advice or create an "
            "advocate-client relationship. Litigants should consult an empanelled, verified advocate for matter-specific representation."
        ),
        description="Statutory non-advice disclaimer",
    )
    retrieved_chunks_count: int
    assessed_at: datetime


class LegalSourceCreate(BaseModel):
    """Admin payload to register a curated legal source."""

    source_type: str = Field(..., description="BARE_ACT | COURT_JUDGMENT | GAZETTE_NOTIFICATION | LEGAL_AID_SCHEME")
    title: str = Field(..., min_length=3, max_length=255)
    short_code: Optional[str] = Field(None, max_length=64)
    citation: Optional[str] = Field(None, max_length=255)
    jurisdiction: str = Field("Union of India", max_length=128)
    court: Optional[str] = Field(None, max_length=128)
    act_or_judgment_identifier: Optional[str] = Field(None, max_length=128)
    publication_date: Optional[date] = None
    last_verified_date: Optional[date] = None
    document_version: str = Field("1.0", max_length=32)
    official_source_url: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None


class LegalChunkCreate(BaseModel):
    """Admin payload to ingest a statutory section or paragraph chunk."""

    section_number: Optional[str] = Field(None, max_length=64)
    clause_heading: Optional[str] = Field(None, max_length=255)
    chunk_text: str = Field(..., min_length=10)
    metadata_json: Optional[Dict[str, Any]] = None


class LegalSourceResponse(BaseModel):
    """Public representation of a verified LegalSource."""

    id: UUID
    source_type: str
    title: str
    short_code: Optional[str] = None
    citation: Optional[str] = None
    jurisdiction: str
    court: Optional[str] = None
    act_or_judgment_identifier: Optional[str] = None
    publication_date: Optional[date] = None
    last_verified_date: Optional[date] = None
    document_version: str
    content_checksum: Optional[str] = None
    official_source_url: Optional[str] = None
    total_chunks: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
