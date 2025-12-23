"""Telegram verification handlers."""

import logging

from aiohttp import web

from locales import get_text

from ..utils import get_bot, handle_telegram_exception, require_bot, validate_and_load_user

logger = logging.getLogger(__name__)


@require_bot
async def handle_verify_telegram(request: web.Request) -> web.Response:
    """Handle Telegram verification request from CRM."""
    telegram_id = None
    try:
        data = await request.json()
        telegram_id = data.get("telegramId")

        user_id, error = await validate_and_load_user(telegram_id)
        if error:
            return error

        verification_message = get_text("telegram_verification", user_id)
        bot = get_bot()
        await bot.send_message(chat_id=user_id, text=verification_message, parse_mode="HTML")

        logger.info(f"Verification message sent to {telegram_id}")
        return web.json_response({"success": True})

    except Exception as e:
        return handle_telegram_exception(e, telegram_id, "Failed to send verification")
