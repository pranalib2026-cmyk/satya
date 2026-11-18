"""Appointments and Consultations API Router."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.appointments.schemas import (
    AppointmentCreateRequest,
    AppointmentListResponse,
    AppointmentResponse,
    AppointmentStatusUpdateRequest,
)
from app.modules.appointments.service import AppointmentService
from app.modules.auth.dependencies import get_current_active_user, require_roles
from app.modules.users.models import User

router = APIRouter(prefix="/appointments", tags=["Appointments & Consultations"])


@router.get("/status", summary="Appointments Module Status")
async def get_appointments_status():
    """Diagnostic health status for Appointments module."""
    return {"module": "appointments", "status": "initialized", "active": True}


@router.post(
    "",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book Consultation Appointment",
    description="Citizen requests a consultation slot with a verified advocate. Performs conflict checks to prevent overlapping bookings.",
)
async def book_appointment(
    payload: AppointmentCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await AppointmentService.create_appointment(
        db=db,
        payload=payload,
        current_user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get(
    "",
    response_model=AppointmentListResponse,
    summary="List Appointments",
    description="Lists appointments for the authenticated caller: Citizens view their booked consultations; Advocates view requests directed to their chamber; Admins view all records.",
)
async def list_appointments(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    items, total = await AppointmentService.list_appointments(
        db=db,
        current_user=current_user,
        page=page,
        limit=limit,
    )
    return AppointmentListResponse(total=total, page=page, limit=limit, items=items)


@router.get(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Get Appointment Details",
    description="Retrieves details of an appointment with strict ownership access control.",
)
async def get_appointment(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await AppointmentService.get_appointment_by_id(
        db=db,
        appointment_id=appointment_id,
        current_user=current_user,
    )


@router.patch(
    "/{appointment_id}/status",
    response_model=AppointmentResponse,
    summary="Update Appointment Status (Accept / Reject)",
    description="Assigned advocate accepts (CONFIRMED) or rejects (REJECTED) an appointment request. Records rejection reason if declined.",
)
async def update_appointment_status(
    appointment_id: uuid.UUID,
    payload: AppointmentStatusUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return await AppointmentService.update_status(
        db=db,
        appointment_id=appointment_id,
        payload=payload,
        current_user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )
