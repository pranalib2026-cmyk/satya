"""Structured Logging Configuration Module."""

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict
from app.core.config import settings


class JSONFormatter(logging.Formatter):
    """Custom formatter producing JSON-formatted log entries for production observability."""

    def format(self, record: logging.LogRecord) -> str:
        log_payload: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "environment": settings.ENVIRONMENT,
            "service": settings.APP_NAME,
        }

        # Include location data for error/warning traces
        if record.levelno >= logging.WARNING:
            log_payload["location"] = {
                "file": record.pathname,
                "line": record.lineno,
                "function": record.funcName,
            }

        # Include exception trace if present
        if record.exc_info:
            log_payload["exception"] = self.formatException(record.exc_info)

        # Include any extra structured context passed to logger
        if hasattr(record, "extra") and isinstance(record.extra, dict):
            log_payload["context"] = record.extra

        return json.dumps(log_payload, default=str)


def setup_logging() -> None:
    """Initialize structured logging based on application settings."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    if settings.LOG_FORMAT.lower() == "json":
        handler.setFormatter(JSONFormatter())
    else:
        # Standard human-readable console format for debugging
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d): %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers = [handler]

    # Silence overly verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("asyncio").setLevel(logging.WARNING)


logger = logging.getLogger("nyayasetu")
