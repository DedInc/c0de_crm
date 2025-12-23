"""Utility functions for webhook handlers."""

import logging
from collections.abc import Awaitable, Callable
from functools import wraps

from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError
from aiohttp import web

from locales import load_user_language
from utils.validation import is_valid_telegram_id

logger = logging.getLogger(__name__)

# Error codes for i18n on the CRM side
ERROR_BOT_BLOCKED = "BOT_BLOCKED"
ERROR_INVALID_TELEGRAM_ID_OR_NOT_STARTED = "INVALID_TELEGRAM_ID_OR_NOT_STARTED"
ERROR_INVALID_TELEGRAM_ID_FORMAT = "INVALID_TELEGRAM_ID_FORMAT"

# Global bot instance reference
_bot = None


def get_bot():
    """Get the bot instance."""
    return _bot


def set_bot(bot):
    """Set the bot instance for sending messages."""
    global _bot
    _bot = bot


def is_valid_external_url(url: str) -> bool:
    """Check if URL is valid for Telegram inline buttons (not localhost)."""
    if not url:
        return False
    lower_url = url.lower()
    return "localhost" not in lower_url and "127.0.0.1" not in lower_url


def error_response(error: str, error_code: str | None = None, status: int = 400) -> web.Response:
    """Create a standardized error response."""
    response = {"success": False, "error": error}
    if error_code:
        response["errorCode"] = error_code
    return web.json_response(response, status=status)


def handle_telegram_exception(e: Exception, telegram_id: str | None, context: str) -> web.Response:
    """Handle Telegram exceptions with standardized responses."""
    if isinstance(e, TelegramForbiddenError):
        logger.warning(f"Bot blocked by user {telegram_id}")
        return error_response(ERROR_BOT_BLOCKED, ERROR_BOT_BLOCKED)

    if isinstance(e, TelegramBadRequest):
        error_message = str(e)
        logger.error(f"{context} for {telegram_id}: {error_message}")
        if "chat not found" in error_message.lower() or "user not found" in error_message.lower():
            return error_response(
                ERROR_INVALID_TELEGRAM_ID_OR_NOT_STARTED, ERROR_INVALID_TELEGRAM_ID_OR_NOT_STARTED
            )
        return error_response(error_message, "TELEGRAM_ERROR")

    if isinstance(e, ValueError):
        logger.error(f"Invalid telegram_id {telegram_id}: {e}")
        return error_response("Invalid telegram ID")

    logger.error(f"{context}: {e}")
    return error_response(str(e), status=500)


def require_bot(
    handler: Callable[[web.Request], Awaitable[web.Response]],
) -> Callable[[web.Request], Awaitable[web.Response]]:
    """Decorator to check if bot is initialized."""

    @wraps(handler)
    async def wrapper(request: web.Request) -> web.Response:
        if _bot is None:
            logger.error("Bot instance not set")
            return error_response("Bot not initialized", status=500)
        return await handler(request)

    return wrapper


async def validate_and_load_user(telegram_id: str | None) -> tuple[int | None, web.Response | None]:
    """Validate telegram ID and load user language. Returns (user_id, error_response)."""
    if not telegram_id:
        return None, error_response("Missing telegramId")

    if not is_valid_telegram_id(telegram_id):
        logger.warning(f"Invalid Telegram ID format: {telegram_id}")
        return None, error_response(
            ERROR_INVALID_TELEGRAM_ID_FORMAT, ERROR_INVALID_TELEGRAM_ID_FORMAT
        )

    user_id = int(telegram_id)
    await load_user_language(user_id)
    return user_id, None
