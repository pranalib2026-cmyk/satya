"""Security, Argon2 Password Hashing, and JWT Token Management."""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import settings
from app.core.logging import logger

# Initialize Argon2 Password Hasher with OWASP recommended parameters
_password_hasher = PasswordHasher(
    time_cost=3,  # 3 iterations
    memory_cost=65536,  # 64 MiB
    parallelism=4,  # 4 lanes/threads
    hash_len=32,  # 32 bytes output
    salt_len=16,  # 16 bytes salt
)


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using Argon2id with automatic salt generation."""
    if not plain_password:
        raise ValueError("Password cannot be empty.")
    return _password_hasher.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2 hash.
    
    Returns False on mismatch or corrupted hash without raising exceptions.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return _password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    except Exception as exc:
        logger.error(f"Unexpected error during Argon2 password verification: {exc}")
        return False


def hash_token(raw_token: str) -> str:
    """Generate SHA-256 fingerprint of a token for safe indexing in database."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_access_token(
    subject: Union[str, uuid.UUID],
    role: str,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Generate signed JWT access token for authentication."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    claims: Dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "iss": settings.APP_NAME,
    }

    if extra_claims:
        claims.update(extra_claims)

    encoded_jwt = jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(
    subject: Union[str, uuid.UUID],
    jti: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> tuple[str, str, datetime]:
    """Generate signed JWT refresh token with unique jti identifier.
    
    Returns: (refresh_token_string, jti, expiry_datetime)
    """
    now = datetime.now(timezone.utc)
    token_jti = jti or str(uuid.uuid4())
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    claims: Dict[str, Any] = {
        "sub": str(subject),
        "jti": token_jti,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "iss": settings.APP_NAME,
    }

    encoded_jwt = jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt, token_jti, expire


def decode_jwt(token: str) -> Dict[str, Any]:
    """Decode and validate signature and expiry of a JWT token.
    
    Raises:
        jwt.ExpiredSignatureError: Token has expired.
        jwt.InvalidTokenError: Token signature or format is invalid.
    """
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        issuer=settings.APP_NAME,
        options={"require": ["exp", "iat", "sub", "type"]},
    )
