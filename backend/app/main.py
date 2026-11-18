"""FastAPI Application Initialization and Lifecycle Management."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import logger, setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and graceful shutdown lifecycle handler."""
    setup_logging()
    logger.info(
        f"Starting {settings.APP_NAME} v{settings.APP_VERSION} in [{settings.ENVIRONMENT}] mode",
        extra={
            "debug": settings.DEBUG,
            "cors_origins": settings.CORS_ORIGINS,
            "api_prefix": settings.API_V1_PREFIX,
        },
    )
    yield
    logger.info(f"Shutting down {settings.APP_NAME}")


def create_application() -> FastAPI:
    """Factory creating and configuring the FastAPI instance."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="NyayaSetu (न्यायसेतु) — AI-Powered Legal Advisor & Advocate Matching Platform API",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # 1. CORS Configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 2. Centralized Error Handlers
    register_exception_handlers(app)

    # 3. Mount Versioned API Routes (/api/v1)
    app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

    # 4. Root Welcome Endpoint
    @app.get("/", include_in_schema=False)
    async def root_overview():
        return JSONResponse(
            content={
                "service": settings.APP_NAME,
                "version": settings.APP_VERSION,
                "environment": settings.ENVIRONMENT,
                "docs": "/docs" if settings.DEBUG else "disabled",
                "health": f"{settings.API_V1_PREFIX}/health",
            }
        )

    return app


app = create_application()
