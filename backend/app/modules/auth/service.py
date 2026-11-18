"""Authentication Service handling registration, credential verification, and token rotation."""

import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple
import jwt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import BadRequestException, ConflictException, ForbiddenException, UnauthorizedException
from app.core.logging import logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_jwt,
    hash_password,
    hash_token,
    verify_password,
)
from app.modules.advocates.models import AdvocateProfile
from app.modules.auth.models import RefreshToken
from app.modules.auth.schemas import (
    AdvocateRegisterRequest,
    CitizenRegisterRequest,
    TokenResponse,
    UniversalRegisterRequest,
    UserResponse,
)
from app.modules.users.models import User


class AuthService:
    """Core domain logic for authentication and token lifecycle."""

    @staticmethod
    async def register_citizen(
        db: AsyncSession,
        req: CitizenRegisterRequest,
    ) -> User:
        """Register a new citizen account with role strictly set to CITIZEN."""
        # 1. Duplicate check by email or phone
        dup_query = select(User).where((User.email == req.email.lower().strip()) | (User.phone == req.phone.strip()))
        result = await db.execute(dup_query)
        existing = result.scalar_one_or_none()
        if existing:
            field = "email" if existing.email == req.email.lower().strip() else "phone"
            raise ConflictException(
                message=f"An account with this {field} is already registered.",
                details={"duplicate_field": field},
            )

        # 2. Hash password with Argon2
        hashed_pwd = hash_password(req.password)

        # 3. Create user entity (role is immutable and strictly enforced as CITIZEN)
        user = User(
            full_name=req.full_name.strip(),
            email=req.email.lower().strip(),
            phone=req.phone.strip(),
            password_hash=hashed_pwd,
            role="CITIZEN",
            preferred_language=req.preferred_language or "en",
        )
        db.add(user)
        await db.flush()
        return user

    @staticmethod
    async def register_advocate(
        db: AsyncSession,
        req: AdvocateRegisterRequest,
    ) -> User:
        """Register an advocate account and initialize their Bar Council profile."""
        # 1. Duplicate check on email, phone, and bar_council_id
        dup_user = await db.execute(
            select(User).where((User.email == req.email.lower().strip()) | (User.phone == req.phone.strip()))
        )
        if dup_user.scalar_one_or_none():
            raise ConflictException(
                message="An account with this email or phone is already registered.",
            )

        dup_bar = await db.execute(
            select(AdvocateProfile).where(AdvocateProfile.bar_council_id == req.bar_council_id.strip())
        )
        if dup_bar.scalar_one_or_none():
            raise ConflictException(
                message=f"Bar Council ID '{req.bar_council_id}' is already registered in the advocate network.",
                details={"bar_council_id": req.bar_council_id},
            )

        # 2. Hash password with Argon2
        hashed_pwd = hash_password(req.password)

        # 3. Create user with role enforced as ADVOCATE
        user = User(
            full_name=req.full_name.strip(),
            email=req.email.lower().strip(),
            phone=req.phone.strip(),
            password_hash=hashed_pwd,
            role="ADVOCATE",
            preferred_language=req.preferred_language or "en",
        )
        db.add(user)
        await db.flush()

        # 4. Create advocate profile
        advocate_profile = AdvocateProfile(
            user_id=user.id,
            bar_council_id=req.bar_council_id.strip(),
            bar_council_name=req.bar_council_name.strip(),
            in_practice_years=req.in_practice_years,
            primary_practice=req.primary_practice.strip(),
            city=req.city.strip(),
            state=req.state.strip(),
            pincode=req.pincode.strip() if req.pincode else None,
        )
        db.add(advocate_profile)
        await db.flush()

        return user

    @staticmethod
    async def register_universal(
        db: AsyncSession,
        req: UniversalRegisterRequest,
    ) -> User:
        """Polymorphic entry point for POST /auth/register enforcing role boundaries."""
        account_type = req.account_type.upper().strip()

        # Strict security rule: ADMIN role cannot be self-assigned
        if account_type == "ADMIN":
            raise ForbiddenException(
                message="ADMIN role cannot be self-assigned through public registration.",
            )

        if account_type == "CITIZEN":
            citizen_req = CitizenRegisterRequest(
                full_name=req.full_name,
                email=req.email,
                phone=req.phone,
                password=req.password,
                preferred_language=req.preferred_language,
            )
            return await AuthService.register_citizen(db, citizen_req)

        elif account_type == "ADVOCATE":
            if not req.bar_council_id or not req.bar_council_name:
                raise BadRequestException(
                    message="Advocate registration requires 'bar_council_id' and 'bar_council_name'.",
                )
            advocate_req = AdvocateRegisterRequest(
                full_name=req.full_name,
                email=req.email,
                phone=req.phone,
                password=req.password,
                bar_council_id=req.bar_council_id,
                bar_council_name=req.bar_council_name,
                in_practice_years=req.in_practice_years or 0,
                primary_practice=req.primary_practice or "Trials & Disputes",
                city=req.city or "New Delhi",
                state=req.state or "Delhi",
                pincode=req.pincode,
                preferred_language=req.preferred_language,
            )
            return await AuthService.register_advocate(db, advocate_req)

        raise BadRequestException(message=f"Unsupported account_type: '{account_type}'.")

    @staticmethod
    async def authenticate_and_create_tokens(
        db: AsyncSession,
        email: str,
        password: str,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> TokenResponse:
        """Verify user credentials with Argon2 and issue fresh access/refresh tokens."""
        # 1. Lookup user by email
        result = await db.execute(select(User).where(User.email == email.lower().strip()))
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.password_hash):
            raise UnauthorizedException(
                message="Incorrect email address or password.",
                details={"auth_failed": True},
            )

        if not user.is_active:
            raise ForbiddenException(
                message="Your account has been deactivated. Please contact support.",
            )

        # 2. Issue JWT tokens
        access_token = create_access_token(subject=user.id, role=user.role)
        refresh_token, jti, expires_at = create_refresh_token(subject=user.id)

        # 3. Store refresh token fingerprint in DB
        db_token = RefreshToken(
            user_id=user.id,
            jti=jti,
            token_hash=hash_token(refresh_token),
            expires_at=expires_at,
            user_agent=user_agent[:255] if user_agent else None,
            ip_address=ip_address,
        )
        db.add(db_token)
        await db.flush()

        logger.info(f"User {user.email} (role: {user.role}) successfully authenticated.")

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user),
        )

    @staticmethod
    async def rotate_refresh_token(
        db: AsyncSession,
        old_refresh_token: str,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> TokenResponse:
        """Validate refresh token, detect reuse, revoke old token, and issue rotated key pair."""
        try:
            payload = decode_jwt(old_refresh_token)
        except jwt.ExpiredSignatureError:
            raise UnauthorizedException(
                message="Refresh token has expired. Please log in again.",
            )
        except jwt.InvalidTokenError as exc:
            raise UnauthorizedException(
                message="Invalid refresh token format or signature.",
                details={"error": str(exc)},
            )

        if payload.get("type") != "refresh":
            raise UnauthorizedException(message="Invalid token type: refresh token expected.")

        jti = payload.get("jti")
        user_id_str = payload.get("sub")
        if not jti or not user_id_str:
            raise UnauthorizedException(message="Malformed refresh token claims.")

        user_uuid = uuid.UUID(user_id_str)

        # Lookup token in database
        result = await db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
        token_record = result.scalar_one_or_none()

        if not token_record:
            raise UnauthorizedException(message="Refresh token not recognized or already invalidated.")

        # Token Reuse Mitigation (OWASP standard):
        # If an already revoked token is used, assume breach and revoke ALL active tokens for this user
        if token_record.is_revoked:
            logger.warning(
                f"SECURITY ALERT: Revoked refresh token reuse attempted for user {user_uuid}. Revoking all sessions."
            )
            await db.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == user_uuid)
                .values(is_revoked=True, revoked_at=datetime.now(timezone.utc))
            )
            await db.flush()
            raise UnauthorizedException(
                message="Security violation: previously revoked token used. All active sessions terminated.",
            )

        # Check expiration against DB (normalize timezone offset)
        token_expiry = token_record.expires_at
        if token_expiry.tzinfo is None:
            token_expiry = token_expiry.replace(tzinfo=timezone.utc)

        if token_expiry < datetime.now(timezone.utc):
            raise UnauthorizedException(message="Refresh token has expired.")

        # 1. Invalidate current token (Rotation)
        token_record.is_revoked = True
        token_record.revoked_at = datetime.now(timezone.utc)

        # 2. Fetch user
        user_res = await db.execute(select(User).where(User.id == user_uuid))
        user = user_res.scalar_one_or_none()
        if not user or not user.is_active:
            raise UnauthorizedException(message="User account no longer active.")

        # 3. Issue fresh rotated pair
        new_access_token = create_access_token(subject=user.id, role=user.role)
        new_refresh_token, new_jti, new_expires_at = create_refresh_token(subject=user.id)

        # 4. Save new refresh token record
        new_db_token = RefreshToken(
            user_id=user.id,
            jti=new_jti,
            token_hash=hash_token(new_refresh_token),
            expires_at=new_expires_at,
            user_agent=user_agent[:255] if user_agent else None,
            ip_address=ip_address,
        )
        db.add(new_db_token)
        await db.flush()

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user),
        )

    @staticmethod
    async def logout(
        db: AsyncSession,
        user_id: uuid.UUID,
        refresh_token_str: Optional[str] = None,
    ) -> None:
        """Revoke refresh token(s) upon user logout."""
        if refresh_token_str:
            try:
                payload = decode_jwt(refresh_token_str)
                jti = payload.get("jti")
                if jti:
                    await db.execute(
                        update(RefreshToken)
                        .where(RefreshToken.jti == jti)
                        .values(is_revoked=True, revoked_at=datetime.now(timezone.utc))
                    )
            except Exception:
                pass

        # Invalidate all active refresh tokens for this user
        await db.execute(
            update(RefreshToken)
            .where((RefreshToken.user_id == user_id) & (RefreshToken.is_revoked == False))
            .values(is_revoked=True, revoked_at=datetime.now(timezone.utc))
        )
        await db.flush()
        logger.info(f"User {user_id} logged out; refresh tokens revoked.")
