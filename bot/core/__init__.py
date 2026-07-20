"""Core bot components."""

from .api_client import CRMApiClient, api_client
from .config import (
    BOT_TOKEN,
    CRM_API_URL,
    CRM_BASE_URL,
    CRM_HOST,
    DATABASE_URL,
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    WEBHOOK_HOST,
    WEBHOOK_PORT,
)
from .message_manager import (
    clear_last_message_id,
    delete_last_message,
    edit_or_send,
    get_last_message_id,
    safe_delete_message,
    send_and_track,
    set_last_message_id,
)
from .states import (
    ChatState,
    OrderCreation,
    clear_active_chat,
    get_active_chat,
    is_user_in_chat,
    set_active_chat,
)

__all__ = [
    "BOT_TOKEN",
    "CRM_API_URL",
    "CRM_BASE_URL",
    "CRM_HOST",
    "DATABASE_URL",
    "DEFAULT_LANGUAGE",
    "SUPPORTED_LANGUAGES",
    "WEBHOOK_HOST",
    "WEBHOOK_PORT",
    "CRMApiClient",
    "ChatState",
    "OrderCreation",
    "api_client",
    "clear_active_chat",
    "clear_last_message_id",
    "delete_last_message",
    "edit_or_send",
    "get_active_chat",
    "get_last_message_id",
    "is_user_in_chat",
    "safe_delete_message",
    "send_and_track",
    "set_active_chat",
    "set_last_message_id",
]
