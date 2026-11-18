"""Users module router skeleton."""

from fastapi import APIRouter

router = APIRouter(prefix="/users", tags=["Users & Profiles"])


@router.get("/status", summary="Users Module Status")
async def get_users_status():
    return {"module": "users", "status": "initialized", "active": False}
