"""Intake and Triage Module API Router."""

from fastapi import APIRouter
from app.modules.cases.schemas import CaseCreateRequest, TriageOutputResponse
from app.modules.triage.engine import get_triage_engine

router = APIRouter(prefix="/triage", tags=["Intake & Triage"])


@router.get("/status", summary="Triage Module Status")
async def get_triage_status():
    """Diagnostic health status for Triage module."""
    return {"module": "triage", "status": "initialized", "active": True}


@router.post(
    "/assess",
    response_model=TriageOutputResponse,
    summary="Instant Preliminary Triage Assessment",
    description=(
        "Run deterministic legal triage evaluation on an intake submission "
        "without persisting a case dossier. Useful for pre-registration advice preview."
    ),
)
async def assess_legal_problem(payload: CaseCreateRequest):
    engine = get_triage_engine()
    result = engine.evaluate(payload.model_dump())
    return TriageOutputResponse(**result)
