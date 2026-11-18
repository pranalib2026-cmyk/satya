"""Pydantic v2 schemas for Document Management."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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
