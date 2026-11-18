"""System Health and Readiness Verification Endpoint."""

from datetime import datetime, timezone
from fastapi import APIRouter, status

from app.core.config import settings
from app.core.database import check_db_health
from app.shared.schemas import DatabaseHealth, HealthResponse

router = APIRouter(tags=["System Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="System Health & Diagnostic Check",
    description="Returns service vitality, application version, active environment, and detailed database status.",
)
async def check_health() -> HealthResponse:
    db_result = await check_db_health()

    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        timestamp=datetime.now(timezone.utc),
        database=DatabaseHealth(**db_result),
    )
