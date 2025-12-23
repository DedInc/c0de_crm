"""Staff notification handlers."""

import logging

from aiohttp import web

from core.config import CRM_BASE_URL
from locales import get_text
from ui.keyboards import staff_order_link_keyboard

from ..utils import (
    get_bot,
    handle_telegram_exception,
    is_valid_external_url,
    require_bot,
    validate_and_load_user,
)

logger = logging.getLogger(__name__)


@require_bot
async def handle_notify_staff(request: web.Request) -> web.Response:
    """Handle notification to CRM staff members (new orders, assignments, responses, chat access)."""
    telegram_id = None
    try:
        data = await request.json()
        telegram_id = data.get("telegramId")
        notification_type = data.get("type")
        order_title = data.get("orderTitle", "")
        order_id = data.get("orderId", "")
        responder_username = data.get("responderUsername", "")

        user_id, error = await validate_and_load_user(telegram_id)
        if error:
            return error

        message = _get_staff_notification_message(
            notification_type, user_id, order_title, responder_username
        )
        if message is None:
            from ..utils import error_response

            return error_response("Unknown notification type")

        # Create keyboard with order link button if order_id is provided
        reply_markup = _create_staff_reply_markup(order_id, user_id)
        if reply_markup is None and order_id:
            message += f"\n\n📋 Order ID: <code>{order_id}</code>"

        bot = get_bot()
        await bot.send_message(
            chat_id=user_id, text=message, parse_mode="HTML", reply_markup=reply_markup
        )

        logger.info(f"Staff notification sent to {telegram_id}: {notification_type}")
        return web.json_response({"success": True})

    except Exception as e:
        return handle_telegram_exception(e, telegram_id, "Failed to send staff notification")


def _get_staff_notification_message(
    notification_type: str | None, user_id: int, order_title: str, responder_username: str
) -> str | None:
    """Get staff notification message based on type."""
    messages = {
        "new_order": lambda: get_text("staff_new_order", user_id, title=order_title),
        "order_assigned": lambda: get_text("staff_order_assigned", user_id, title=order_title),
        "new_response": lambda: get_text(
            "staff_new_response", user_id, title=order_title, username=responder_username
        ),
        "new_order_moderation": lambda: get_text(
            "staff_new_order_moderation", user_id, title=order_title
        ),
        "chat_access_granted": lambda: get_text(
            "staff_chat_access_granted", user_id, title=order_title
        ),
        "payment_info_sent": lambda: get_text(
            "staff_payment_info_sent", user_id, title=order_title
        ),
    }
    handler = messages.get(notification_type)
    return handler() if handler else None


def _create_staff_reply_markup(order_id: str, user_id: int):
    """Create reply markup with order link if available."""
    if order_id and is_valid_external_url(CRM_BASE_URL):
        return staff_order_link_keyboard(order_id, user_id, CRM_BASE_URL)
    return None
