"""Standardized Pydantic schemas shared across all modules."""

from datetime import datetime
from typing import Any, Dict, Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class DatabaseHealth(BaseModel):
    status: str = Field(description="Connection state: connected, disconnected, unreachable, error")
    latency_ms: Optional[float] = Field(default=None, description="Round-trip query latency in ms")
    dialect: str = Field(default="psycopg3", description="SQLAlchemy driver dialect")
    extensions: Dict[str, str] = Field(default_factory=dict, description="Status of PostGIS, vector, and uuid-ossp")
    error: Optional[str] = Field(default=None, description="Error message if probe failed")


class HealthResponse(BaseModel):
    """Payload returned by the system health check endpoint."""

    status: str = Field(default="healthy", description="Current operational status")
    app_name: str = Field(description="Name of the service")
    version: str = Field(description="Semantic version of the application")
    environment: str = Field(description="Active runtime environment")
    timestamp: datetime = Field(description="UTC timestamp of the health check")
    database: DatabaseHealth = Field(description="Detailed database connection status")


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)
    path: Optional[str] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


class APIResponse(BaseModel, Generic[T]):
    """Standard unified response wrapper for all API endpoints."""

    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PaginationMeta(BaseModel):
    page: int
    limit: int
    total_records: int
    total_pages: int
    has_next: bool
    has_prev: bool


class PaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    data: List[T]
    pagination: PaginationMeta
