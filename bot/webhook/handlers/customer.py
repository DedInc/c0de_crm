"""Customer message sending handlers."""

import logging

from aiogram import Bot
from aiogram.types import BufferedInputFile, InlineKeyboardMarkup, URLInputFile
from aiohttp import web

from core.states import is_user_in_chat
from locales import get_text
from ui.keyboards import enter_chat_keyboard

from ..utils import (
    error_response,
    get_bot,
    handle_telegram_exception,
    require_bot,
    validate_and_load_user,
)
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
        file_urls = data.get("fileUrls", [])

        if not message and not image_urls and not file_urls:
            return error_response("Missing message, image, or file")

        user_id, error = await validate_and_load_user(telegram_id)
        if error:
            return error
        if user_id is None:
            return error_response("Missing telegramId")

        # Format message with order context if provided
        formatted_message = _format_support_message(message, order_title, user_id)

        # Only include "Enter Chat" button if order_id provided and user not in chat
        reply_markup = (
            enter_chat_keyboard(order_id, user_id)
            if order_id and not is_user_in_chat(user_id, order_id)
            else None
        )

        bot = get_bot()
        if bot is None:
            return error_response("Bot not initialized", status=500)

        has_images = bool(image_urls)
        has_files = bool(file_urls)

        # Send images if provided
        if has_images:
            file_markup = reply_markup if not has_files else None
            await _send_images_with_message(
                bot, user_id, image_urls, formatted_message, file_markup
            )

        # Send documents if provided
        if has_files:
            doc_message = formatted_message if not has_images else None
            await _send_documents_with_message(bot, user_id, file_urls, doc_message, reply_markup)

        # Send text-only message if no media
        if not has_images and not has_files and formatted_message:
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
    bot: Bot,
    user_id: int,
    image_urls: list,
    message: str | None,
    reply_markup: InlineKeyboardMarkup | None,
) -> None:
    """Send images with optional message caption and reply markup."""
    for i, image_url in enumerate(image_urls):
        # Only add caption to the first image
        caption = message if i == 0 and message else None
        # Only add reply markup to the last image
        markup = reply_markup if i == len(image_urls) - 1 else None

        # Resolve tg-file: references back to full Telegram URLs
        if image_url.startswith("tg-file:"):
            file_path = image_url[len("tg-file:") :]
            image_url = f"https://api.telegram.org/file/bot{bot.token}/{file_path}"

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
            # It's a regular URL (presigned R2 URL or Telegram file URL)
            await bot.send_photo(
                chat_id=user_id,
                photo=image_url,
                caption=caption,
                parse_mode="HTML" if caption else None,
                reply_markup=markup,
            )


async def _send_documents_with_message(
    bot: Bot,
    user_id: int,
    file_urls: list[dict],
    message: str | None,
    reply_markup: InlineKeyboardMarkup | None,
) -> None:
    """Send documents with optional message caption and reply markup."""
    for i, file_info in enumerate(file_urls):
        caption = message if i == 0 and message else None
        markup = reply_markup if i == len(file_urls) - 1 else None

        file_url = file_info.get("url", "")
        file_name = file_info.get("name", "document")

        if file_url.startswith("tg-file:"):
            file_path = file_url[len("tg-file:") :]
            file_url = f"https://api.telegram.org/file/bot{bot.token}/{file_path}"

        document = URLInputFile(file_url, filename=file_name)
        await bot.send_document(
            chat_id=user_id,
            document=document,
            caption=caption,
            parse_mode="HTML" if caption else None,
            reply_markup=markup,
        )
