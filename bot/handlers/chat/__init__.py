"""Chat module for customer-support communication."""

from aiogram import Router

from .handlers import router as handlers_router
from .media import router as media_router
from .messages import router as messages_router
from .notifications import (
    notify_order_approved,
    notify_order_assigned,
    notify_order_rejected,
    notify_order_status_change,
)
from .staff_notifications import notify_programmers_new_order

# Main router combining all chat-related routers
router = Router()
router.include_router(handlers_router)
router.include_router(media_router)
router.include_router(messages_router)

__all__ = [
    "notify_order_approved",
    "notify_order_assigned",
    "notify_order_rejected",
    "notify_order_status_change",
    "notify_programmers_new_order",
    "router",
]
