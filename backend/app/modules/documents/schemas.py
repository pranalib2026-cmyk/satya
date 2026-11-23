"""Pydantic v2 schemas for Document Management and Optical Extraction."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.legal_assistant.schemas import CitationItem


class DocumentResponse(BaseModel):
    """Metadata response for a secure legal document."""

    id: UUID
    case_id: Optional[UUID] = None
    uploader_id: UUID
    file_name: str
    file_size_bytes: int
    mime_type: str
    checksum_sha256: str
    is_confidential: bool
    document_category: str
    storage_backend: str = "local"
    storage_key: Optional[str] = None
    processing_status: str = "uploaded"
    extracted_text: Optional[str] = None
    ocr_confidence: Optional[float] = None
    ocr_engine: Optional[str] = None
    processing_error: Optional[str] = None
    processed_at: Optional[datetime] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentDownloadTokenResponse(BaseModel):
    """Authorized short-lived document download credentials."""

    document_id: UUID
    file_name: str
    download_url: str
    expires_in_seconds: int = 900
    token: str


class DocumentListResponse(BaseModel):
    """Paginated collection of case documents."""

    total: int
    items: List[DocumentResponse]


class DocumentScanResponse(BaseModel):
    """Result of document upload and optical text extraction."""

    document_id: UUID
    status: str = Field(..., description="uploaded | processing | completed | failed")
    text: str = Field(..., description="Actual extracted text from document")
    confidence: float = Field(..., description="Extraction confidence score (0.0 to 1.0)")
    low_confidence: bool = Field(False, description="Flag indicating poor OCR confidence")
    ocr_engine: str = Field(..., description="Engine used: pdf_embedded | gemini_vision | rapidocr | tesseract")
    file_name: str
    file_size_bytes: int
    mime_type: str
    processing_error: Optional[str] = None
    processed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DocumentDateItem(BaseModel):
    """Key statutory date extracted from legal document."""

    label: str
    value: str


class DocumentAmountItem(BaseModel):
    """Monetary demand or stated amount extracted from legal document."""

    label: str
    value: str


class DocumentExplanationResponse(BaseModel):
    """Grounded plain-language legal explanation of an extracted document."""

    document_id: UUID
    document_type: str = Field(..., description="Classification (e.g. Legal Notice, FIR, Agreement)")
    summary: str = Field(..., description="Plain language explanation of document contents")
    parties: List[str] = Field(default_factory=list, description="Parties identified in the document")
    dates: List[DocumentDateItem] = Field(default_factory=list, description="Extracted dates and limitation deadlines")
    amounts: List[DocumentAmountItem] = Field(default_factory=list, description="Demanded or stated financial figures")
    obligations: List[str] = Field(default_factory=list, description="Recipient obligations and required actions")
    risks: List[str] = Field(default_factory=list, description="Identified legal risks and procedural consequences")
    citations: List[CitationItem] = Field(default_factory=list, description="Traceable statutory citations from retrieved context")
    sources_found: bool = Field(False, description="Whether statutory context was retrieved and verified")
    disclaimer: str = Field(
        default=(
            "NyayaSetu provides an AI-assisted preliminary legal assessment and document explanation. "
            "It is not a law firm and does not provide legal advice. "
            "Please review extracted values and consult an empanelled advocate before acting."
        ),
        description="Mandatory legal disclaimer",
    )
    confidence: float = Field(0.9, description="Overall confidence of analysis")
    extracted_text_snippet: Optional[str] = Field(None, description="Verbatim snippet of source text")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(from_attributes=True)
