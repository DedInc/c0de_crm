"""Order handlers package."""

from aiogram import Router

from .creation import router as creation_router
from .helpers import (
    build_confirmation_text,
    build_order_detail_text,
    check_order_limit,
    fetch_markers,
    get_order_by_id,
)
from .viewing import router as viewing_router

router = Router()
router.include_router(creation_router)
router.include_router(viewing_router)

__all__ = [
    "build_confirmation_text",
    "build_order_detail_text",
    "check_order_limit",
    "fetch_markers",
    "get_order_by_id",
    "router",
]
