"""Centralized Application Configuration Module."""

from typing import List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application Meta
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    APP_NAME: str = "NyayaSetu Backend API"
    APP_VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"

    # Server Bindings
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Cross-Origin Resource Sharing (CORS)
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, value: Union[str, List[str]]) -> List[str]:
        if isinstance(value, str):
            if not value.strip():
                return ["*"]
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        elif isinstance(value, list):
            return value
        return ["*"]

    # Database Configuration (PostgreSQL with Psycopg 3)
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/nyayasetu"
    DATABASE_URL_SYNC: Optional[str] = None
    TEST_DATABASE_URL: str = "sqlite+aiosqlite:///./test.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_database_url(cls, value: str) -> str:
        """Ensure the async URL uses the psycopg dialect if postgresql:// is provided."""
        if not value:
            return "postgresql+psycopg://postgres:postgres@localhost:5432/nyayasetu"
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql+asyncpg://"):
            return value.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
        return value

    @property
    def sync_database_url(self) -> str:
        """Derive synchronous URL for Alembic migrations using psycopg."""
        if self.DATABASE_URL_SYNC and self.DATABASE_URL_SYNC.strip():
            url = self.DATABASE_URL_SYNC
            if url.startswith("postgresql+asyncpg://"):
                return url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
            if url.startswith("postgresql://"):
                return url.replace("postgresql://", "postgresql+psycopg://", 1)
            return url
        return self.DATABASE_URL.replace("postgresql+psycopg://", "postgresql+psycopg://", 1)

    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_ECHO: bool = False

    # Supabase Integration
    SUPABASE_URL: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = "sb_publishable_AghcSMNgQd1JlABKevbIGA_wROA32fu"

    # AI & Legal Embeddings Configuration
    EMBEDDING_VECTOR_DIMENSION: int = 768
    GEMINI_API_KEY: str = ""

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    # Security, JWT & Authentication Tokens
    SECRET_KEY: str = "local-dev-secret-key-nyayasetu-2026-development-only-min32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Advocate Matching Engine Configurable Weights
    MATCHING_WEIGHT_PRACTICE: float = 0.35
    MATCHING_WEIGHT_JURISDICTION: float = 0.25
    MATCHING_WEIGHT_LANGUAGE: float = 0.20
    MATCHING_WEIGHT_PROXIMITY: float = 0.10
    MATCHING_WEIGHT_AVAILABILITY: float = 0.10

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT.lower() == "development"


settings = Settings()
