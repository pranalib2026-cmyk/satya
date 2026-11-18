"""FastAPI Dependencies for JWT Authentication and Role-Based Authorization."""

import uuid
from typing import Callable, Sequence
import jwt
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.errors import ForbiddenException, UnauthorizedException
from app.core.security import decode_jwt
from app.modules.users.models import User

# OAuth2 scheme for extracting bearer token from Authorization header
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/login",
    auto_error=False,
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate JWT access token and retrieve current user entity from database."""
    if not token:
        raise UnauthorizedException(
            message="Authentication credentials were not provided.",
            details={"scheme": "Bearer"},
        )

    try:
        payload = decode_jwt(token)
    except jwt.ExpiredSignatureError:
        raise UnauthorizedException(
            message="Authentication token has expired. Please log in or refresh your session.",
            details={"token_status": "expired"},
        )
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedException(
            message="Invalid authentication token signature or payload.",
            details={"error": str(exc)},
        )

    token_type = payload.get("type")
    if token_type != "access":
        raise UnauthorizedException(
            message="Invalid token type: access token required.",
            details={"provided_type": token_type},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedException(message="Token missing subject identifier.")

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise UnauthorizedException(message="Malformed subject identifier in token.")

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedException(
            message="The user associated with this token no longer exists.",
            details={"user_id": user_id_str},
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure current authenticated user account is active."""
    if not current_user.is_active:
        raise ForbiddenException(
            message="User account is deactivated. Contact administration.",
            details={"user_id": str(current_user.id)},
        )
    return current_user


def require_roles(*allowed_roles: str) -> Callable:
    """Enforce backend role-based authorization for protected endpoints.
    
    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_roles("ADMIN"))])
    """
    async def role_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if current_user.role not in allowed_roles:
            raise ForbiddenException(
                message=f"Access forbidden: requires one of roles [{', '.join(allowed_roles)}].",
                details={
                    "current_role": current_user.role,
                    "required_roles": list(allowed_roles),
                },
            )
        return current_user

    return role_checker
