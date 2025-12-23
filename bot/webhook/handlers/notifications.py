"""Customer notification handlers."""

import logging
from typing import Any

from aiohttp import web

from locales import get_status_text, get_text

from ..utils import get_bot, handle_telegram_exception, require_bot, validate_and_load_user

logger = logging.getLogger(__name__)


@require_bot
async def handle_notify(request: web.Request) -> web.Response:
    """Handle notification from CRM to send to customer (status changes, etc.)."""
    telegram_id = None
    try:
        data = await request.json()
        telegram_id = data.get("telegramId")
        notification_type = data.get("type")
        order_title = data.get("orderTitle", "")
        status = data.get("status", "")

        user_id, error = await validate_and_load_user(telegram_id)
        if error:
            return error

        message = _get_notification_message(notification_type, user_id, order_title, status, data)
        if message is None:
            from ..utils import error_response

            return error_response("Missing notification type or message")

        bot = get_bot()
        await bot.send_message(chat_id=user_id, text=message, parse_mode="HTML")

        logger.info(f"Notification sent to {telegram_id}")
        return web.json_response({"success": True})

    except Exception as e:
        return handle_telegram_exception(e, telegram_id, "Failed to send notification")


def _get_notification_message(
    notification_type: str | None, user_id: int, order_title: str, status: str, data: dict[str, Any]
) -> str | None:
    """Get notification message based on type."""
    if notification_type == "order_approved":
        return get_text("notify_order_approved", user_id, title=order_title)
    if notification_type == "order_rejected":
        return get_text("notify_order_rejected", user_id, title=order_title)
    if notification_type == "order_assigned":
        return get_text("notify_order_assigned", user_id, title=order_title)
    if notification_type == "order_status_changed":
        status_text = get_status_text(status, user_id)
        return get_text("notify_order_status", user_id, title=order_title, status=status_text)
    if notification_type == "payment_info_received":
        payment_method = data.get("paymentMethodName", "")
        payment_details = data.get("paymentDetails", "")
        total_amount = data.get("totalAmount", 0)
        return get_text(
            "notify_payment_info",
            user_id,
            title=order_title,
            payment_method=payment_method,
            details=payment_details,
            amount=total_amount,
        )
    # Fallback for legacy plain message format
    return data.get("message") or None
