"""Webhook handlers module."""

from .customer import handle_send_message
from .health import handle_health
from .notifications import handle_notify
from .staff import handle_notify_staff
from .verification import handle_verify_telegram

__all__ = [
    "handle_health",
    "handle_notify",
    "handle_notify_staff",
    "handle_send_message",
    "handle_verify_telegram",
]
