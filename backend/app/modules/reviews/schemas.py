"""Pydantic v2 schemas for Advocate Evaluation and Review Management."""

from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ReviewCreateRequest(BaseModel):
    """Payload to submit client evaluation for a completed consultation booking."""

    booking_id: Optional[uuid.UUID] = Field(None, description="Associated completed consultation booking UUID")
    bookingId: Optional[uuid.UUID] = Field(None, description="Associated completed consultation booking UUID (camelCase alias)")
    rating: int = Field(
        ...,
        ge=1,
        le=5,
        description="Client statutory evaluation rating between 1 and 5 stars",
    )
    comment: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional qualitative observations regarding counsel clarity",
    )
    tags: Optional[List[str]] = Field(
        default_factory=list,
        description="Selected counsel strengths (e.g. 'Clear communication', 'Punctual & prepared')",
    )
    matter_resolution: Optional[str] = Field(
        None,
        description="Outcome indicator: 'yes' | 'in_progress' | 'no'",
    )
    resolved: Optional[str] = Field(
        None,
        description="Alternative field for matter outcome (compatibility alias)",
    )

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def unify_booking_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            b_id = data.get("booking_id") or data.get("bookingId")
            if not b_id:
                raise ValueError("booking_id is required.")
            data["booking_id"] = b_id
        return data

    @field_validator("comment")
    @classmethod
    def clean_comment(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            return trimmed if trimmed else None
        return None

    @model_validator(mode="after")
    def unify_resolution(self) -> "ReviewCreateRequest":
        if not self.matter_resolution and self.resolved:
            self.matter_resolution = self.resolved
        return self


class ReviewUpdateRequest(BaseModel):
    """Payload to update an existing evaluation."""

    rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)
    tags: Optional[List[str]] = None
    matter_resolution: Optional[str] = None
    resolved: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def unify_resolution(self) -> "ReviewUpdateRequest":
        if not self.matter_resolution and self.resolved:
            self.matter_resolution = self.resolved
        return self


class ReviewModerationRequest(BaseModel):
    """Administrative moderation payload."""

    status: str = Field(
        ...,
        pattern="^(PENDING|PUBLISHED|REJECTED|HIDDEN)$",
        description="Target moderation status",
    )
    moderation_reason: Optional[str] = Field(None, description="Administrative rationale")


class ReviewResponse(BaseModel):
    """Public and authenticated representation of an advocate evaluation."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    booking_id: uuid.UUID
    bookingId: Optional[uuid.UUID] = None
    reviewer_id: uuid.UUID
    reviewerId: Optional[uuid.UUID] = None
    reviewer_name: Optional[str] = None
    reviewerName: Optional[str] = None
    advocate_id: uuid.UUID
    advocateId: Optional[uuid.UUID] = None
    advocate_name: Optional[str] = None
    advocateName: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    matter_resolution: Optional[str] = None
    resolved: Optional[str] = None
    status: str
    moderation_reason: Optional[str] = None
    created_at: datetime
    createdAt: Optional[datetime] = None
    updated_at: datetime
    updatedAt: Optional[datetime] = None

    @model_validator(mode="after")
    def populate_dual_casing(self) -> "ReviewResponse":
        self.bookingId = self.bookingId or self.booking_id
        self.reviewerId = self.reviewerId or self.reviewer_id
        self.reviewerName = self.reviewerName or self.reviewer_name
        self.advocateId = self.advocateId or self.advocate_id
        self.advocateName = self.advocateName or self.advocate_name
        self.resolved = self.resolved or self.matter_resolution
        self.createdAt = self.createdAt or self.created_at
        self.updatedAt = self.updatedAt or self.updated_at
        return self


class AdvocateRatingSummaryResponse(BaseModel):
    """Aggregated verified client review metrics for an advocate profile."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    advocate_id: uuid.UUID
    advocateId: Optional[uuid.UUID] = None
    average_rating: float
    averageRating: Optional[float] = None
    review_count: int
    reviewCount: Optional[int] = None
    star_distribution: Dict[str, int] = Field(default_factory=dict)
    starDistribution: Optional[Dict[str, int]] = None
    top_tags: List[str] = Field(default_factory=list)
    topTags: Optional[List[str]] = None

    @model_validator(mode="after")
    def populate_dual_casing(self) -> "AdvocateRatingSummaryResponse":
        self.advocateId = self.advocateId or self.advocate_id
        self.averageRating = self.averageRating if self.averageRating is not None else self.average_rating
        self.reviewCount = self.reviewCount if self.reviewCount is not None else self.review_count
        self.starDistribution = self.starDistribution or self.star_distribution
        self.topTags = self.topTags or self.top_tags
        return self


class ReviewListResponse(BaseModel):
    """Paginated collection of reviews with summary metrics."""

    items: List[ReviewResponse]
    total: int
    page: int
    limit: int
    summary: Optional[AdvocateRatingSummaryResponse] = None
