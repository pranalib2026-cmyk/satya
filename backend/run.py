"""Application Entry Point for Local Development."""

import uvicorn
from app.core.config import settings


def main() -> None:
    """Launch the Uvicorn ASGI server using configuration settings."""
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG and settings.is_development,
        log_level=settings.LOG_LEVEL.lower(),
    )


if __name__ == "__main__":
    main()
