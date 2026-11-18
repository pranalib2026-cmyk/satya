"""Authentication and Authorization API Endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user, require_roles
from app.modules.auth.schemas import (
    AdvocateRegisterRequest,
    CitizenRegisterRequest,
    LoginRequest,
    LogoutRequest,
    TokenRefreshRequest,
    TokenResponse,
    UniversalRegisterRequest,
    UserResponse,
)
from app.modules.auth.service import AuthService
from app.modules.users.models import User

router = APIRouter(prefix="/auth", tags=["Authentication & Session"])


@router.get("/status", summary="Auth Module Status")
async def get_auth_status():
    return {"module": "auth", "status": "initialized", "active": True}


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="User Registration (Citizen or Advocate)",
    description="Register a new citizen or advocate. ADMIN role cannot be self-assigned.",
)
async def register_user(
    req: UniversalRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await AuthService.register_universal(db=db, req=req)
    return UserResponse.model_validate(user)


@router.post(
    "/register/advocate",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Dedicated Advocate Account Registration",
    description="Register an advocate account with required Bar Council enrolment verification details.",
)
async def register_advocate(
    req: AdvocateRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await AuthService.register_advocate(db=db, req=req)
    return UserResponse.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="User Login",
    description="Authenticate with email and password to receive JWT access and refresh tokens.",
)
async def login(
    req: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user_agent = request.headers.get("user-agent")
    client_ip = request.client.host if request.client else None

    return await AuthService.authenticate_and_create_tokens(
        db=db,
        email=req.email,
        password=req.password,
        user_agent=user_agent,
        ip_address=client_ip,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate Refresh Token",
    description="Submit an active refresh token to invalidate it and receive a new access/refresh token pair.",
)
async def refresh_token(
    req: TokenRefreshRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user_agent = request.headers.get("user-agent")
    client_ip = request.client.host if request.client else None

    return await AuthService.rotate_refresh_token(
        db=db,
        old_refresh_token=req.refresh_token,
        user_agent=user_agent,
        ip_address=client_ip,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Logout & Revoke Session",
    description="Revoke the provided refresh token and invalidate active user sessions.",
)
async def logout(
    req: Optional[LogoutRequest] = None,
    current_user: Optional[User] = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    refresh_token_str = req.refresh_token if req else None
    await AuthService.logout(
        db=db,
        user_id=current_user.id,
        refresh_token_str=refresh_token_str,
    )
    return {
        "success": True,
        "message": "Successfully logged out. Refresh token revoked.",
    }


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current Logged-in User",
    description="Retrieve profile details for the bearer of the provided access token.",
)
async def get_me(
    current_user: User = Depends(get_current_active_user),
) -> UserResponse:
    return UserResponse.model_validate(current_user)


# Role-protected verification endpoints
@router.get(
    "/citizen-only",
    response_model=dict,
    summary="Citizen Role Protected Test Route",
    dependencies=[Depends(require_roles("CITIZEN"))],
)
async def citizen_only_route(current_user: User = Depends(get_current_active_user)):
    return {"message": "Welcome Citizen", "user": current_user.full_name, "role": current_user.role}


@router.get(
    "/advocate-only",
    response_model=dict,
    summary="Advocate Role Protected Test Route",
    dependencies=[Depends(require_roles("ADVOCATE"))],
)
async def advocate_only_route(current_user: User = Depends(get_current_active_user)):
    return {"message": "Welcome Learned Advocate", "user": current_user.full_name, "role": current_user.role}


@router.get(
    "/admin-only",
    response_model=dict,
    summary="Admin Role Protected Test Route",
    dependencies=[Depends(require_roles("ADMIN"))],
)
async def admin_only_route(current_user: User = Depends(get_current_active_user)):
    return {"message": "Welcome Administrator", "user": current_user.full_name, "role": current_user.role}
