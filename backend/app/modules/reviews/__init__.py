"""Advocate Evaluation and Client Review Module."""

from app.modules.reviews.models import Review
from app.modules.reviews.router import router
from app.modules.reviews.service import ReviewService

__all__ = [
    "Review",
    "ReviewService",
    "router",
]
