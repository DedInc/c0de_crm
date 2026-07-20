"""Staff notification functions for programmer alerts."""

import logging

from aiogram import Bot

from core.api_client import api_client

logger = logging.getLogger(__name__)


async def notify_programmers_new_order(bot: Bot, order_title: str) -> None:
    """Notify all programmers about a new approved order."""
    try:
        programmers = await api_client.get_programmers_for_notification()

        for programmer in programmers:
            if programmer.get("telegramId"):
                try:
                    await bot.send_message(
                        chat_id=int(programmer["telegramId"]),
                        text=(
                            f"📋 New order available: <b>{order_title}</b>"
                            "\n\nCheck the CRM for details."
                        ),
                        parse_mode="HTML",
                    )
                except Exception as e:
                    logger.error("Failed to notify programmer %s: %s", programmer["telegramId"], e)
    except Exception as e:
        logger.error("Failed to get programmers for notification: %s", e)
