"""Customer message sending handlers."""

import logging

from aiogram.types import BufferedInputFile
from aiohttp import web

from core.states import is_user_in_chat
from locales import get_text
from ui.keyboards import enter_chat_keyboard

from ..utils import get_bot, handle_telegram_exception, require_bot, validate_and_load_user
from .helpers import parse_base64_image

logger = logging.getLogger(__name__)


@require_bot
async def handle_send_message(request: web.Request) -> web.Response:
    """Handle incoming message from CRM to send to customer."""
    telegram_id = None
    try:
        data = await request.json()
        telegram_id = data.get("telegramId")
        message = data.get("message", "")
        order_title = data.get("orderTitle", "")
        order_id = data.get("orderId", "")
        image_urls = data.get("imageUrls", [])

        if not message and not image_urls:
            from ..utils import error_response

            return error_response("Missing message or image")

        user_id, error = await validate_and_load_user(telegram_id)
        if error:
            return error

        # Format message with order context if provided
        formatted_message = _format_support_message(message, order_title, user_id)

        # Only include "Enter Chat" button if order_id provided and user not in chat
        reply_markup = (
            enter_chat_keyboard(order_id, user_id)
            if order_id and not is_user_in_chat(user_id, order_id)
            else None
        )

        bot = get_bot()

        # Send images if provided
        if image_urls:
            await _send_images_with_message(
                bot, user_id, image_urls, formatted_message, reply_markup
            )
        elif formatted_message:
            await bot.send_message(
                chat_id=user_id,
                text=formatted_message,
                parse_mode="HTML",
                reply_markup=reply_markup,
            )

        logger.info(f"Message sent to {telegram_id}")
        return web.json_response({"success": True})

    except Exception as e:
        return handle_telegram_exception(e, telegram_id, "Failed to send message")


def _format_support_message(message: str, order_title: str, user_id: int) -> str | None:
    """Format support message with order context."""
    if not message:
        return None

    if order_title:
        return get_text("chat_support_message", user_id, title=order_title, message=message)

    return f"💬 <b>Support:</b>\n\n{message}"


async def _send_images_with_message(
    bot, user_id: int, image_urls: list, message: str | None, reply_markup
):
    """Send images with optional message caption and reply markup."""
    for i, image_url in enumerate(image_urls):
        # Only add caption to the first image
        caption = message if i == 0 and message else None
        # Only add reply markup to the last image
        markup = reply_markup if i == len(image_urls) - 1 else None

        # Check if it's a base64 data URL
        base64_result = parse_base64_image(image_url)
        if base64_result:
            image_bytes, filename = base64_result
            photo = BufferedInputFile(image_bytes, filename=filename)
            await bot.send_photo(
                chat_id=user_id,
                photo=photo,
                caption=caption,
                parse_mode="HTML" if caption else None,
                reply_markup=markup,
            )
        else:
            # It's a regular URL (e.g., Telegram file URL)
            await bot.send_photo(
                chat_id=user_id,
                photo=image_url,
                caption=caption,
                parse_mode="HTML" if caption else None,
                reply_markup=markup,
            )
