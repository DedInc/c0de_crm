"""Staff notification functions for programmer alerts."""

from core.api_client import api_client


async def notify_programmers_new_order(bot, order_title: str):
    """Notify all programmers about a new approved order."""
    try:
        programmers = await api_client.get_programmers_for_notification()

        for programmer in programmers:
            if programmer.get("telegramId"):
                try:
                    await bot.send_message(
                        chat_id=int(programmer["telegramId"]),
                        text=f"📋 New order available: <b>{order_title}</b>\n\nCheck the CRM for details.",
                        parse_mode="HTML",
                    )
                except Exception as e:
                    print(f"Failed to notify programmer {programmer['telegramId']}: {e}")
    except Exception as e:
        print(f"Failed to get programmers for notification: {e}")
