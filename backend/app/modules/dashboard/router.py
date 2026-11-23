"""Dashboard Overview API Router."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user
from app.modules.dashboard.schemas import DashboardSummaryResponse
from app.modules.dashboard.service import DashboardService
from app.modules.users.models import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard Overview"])


@router.get("/status", summary="Dashboard Module Status")
async def get_dashboard_status():
    return {"module": "dashboard", "status": "initialized", "active": True}


@router.get(
    "/summary",
    response_model=DashboardSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Consolidated Dashboard Summary",
    description="Retrieve real aggregated metrics, active matters, upcoming deadlines, and appointments for the authenticated user.",
)
async def get_dashboard_summary(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardSummaryResponse:
    return await DashboardService.get_summary(db=db, user=current_user)
