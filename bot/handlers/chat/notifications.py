"""Customer notification functions for order events."""

import logging

from aiogram import Bot

from locales import get_text

logger = logging.getLogger(__name__)


async def notify_order_approved(bot: Bot, telegram_id: str, order_title: str, user_id: int) -> None:
    """Notify customer that order was approved."""
    try:
        await bot.send_message(
            chat_id=int(telegram_id),
            text=get_text("notify_order_approved", user_id, title=order_title),
            parse_mode="HTML",
        )
    except Exception as e:
        logger.error("Failed to notify %s about order approval: %s", telegram_id, e)


async def notify_order_rejected(bot: Bot, telegram_id: str, order_title: str, user_id: int) -> None:
    """Notify customer that order was rejected."""
    try:
        await bot.send_message(
            chat_id=int(telegram_id),
            text=get_text("notify_order_rejected", user_id, title=order_title),
            parse_mode="HTML",
        )
    except Exception as e:
        logger.error("Failed to notify %s about order rejection: %s", telegram_id, e)


async def notify_order_assigned(bot: Bot, telegram_id: str, order_title: str, user_id: int) -> None:
    """Notify customer that a developer was assigned."""
    try:
        await bot.send_message(
            chat_id=int(telegram_id),
            text=get_text("notify_order_assigned", user_id, title=order_title),
            parse_mode="HTML",
        )
    except Exception as e:
        logger.error("Failed to notify %s about order assignment: %s", telegram_id, e)


async def notify_order_status_change(
    bot: Bot, telegram_id: str, order_title: str, status: str, user_id: int
) -> None:
    """Notify customer about order status change."""
    try:
        from locales import get_status_text

        status_text = get_status_text(status, user_id)

        await bot.send_message(
            chat_id=int(telegram_id),
            text=get_text("notify_order_status", user_id, title=order_title, status=status_text),
            parse_mode="HTML",
        )
    except Exception as e:
        logger.error("Failed to notify %s about status change: %s", telegram_id, e)
