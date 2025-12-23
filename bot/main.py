"""Main entry point for the Telegram bot."""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from aiogram import BaseMiddleware, Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import TelegramObject, Update

from core import api_client
from core.config import BOT_TOKEN, WEBHOOK_HOST, WEBHOOK_PORT
from handlers import setup_routers
from locales import load_user_language
from webhook import set_bot, start_webhook_server

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class LanguageMiddleware(BaseMiddleware):
    """Middleware to load user language preference on every update."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        # Extract user_id from the event
        user_id = None
        if isinstance(event, Update):
            if event.message and event.message.from_user:
                user_id = event.message.from_user.id
            elif event.callback_query and event.callback_query.from_user:
                user_id = event.callback_query.from_user.id

        # Load user language if we have a user_id
        if user_id:
            await load_user_language(user_id)

        return await handler(event, data)


async def on_startup(bot: Bot):
    """Actions to perform on bot startup."""
    logger.info("Bot is starting...")

    # Set bot instance for webhook server
    set_bot(bot)

    # Get bot info
    bot_info = await bot.get_me()
    logger.info(f"Bot started: @{bot_info.username}")


async def on_shutdown(bot: Bot):
    """Actions to perform on bot shutdown."""
    logger.info("Bot is shutting down...")

    # Close API client session
    await api_client.close()

    logger.info("Bot stopped")


async def main():
    """Main function to run the bot."""
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN is not set!")
        return

    # Initialize bot and dispatcher
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))

    storage = MemoryStorage()
    dp = Dispatcher(storage=storage)

    # Add language middleware to load user preferences
    dp.update.middleware(LanguageMiddleware())

    # Setup routers
    dp.include_router(setup_routers())

    # Register startup and shutdown handlers
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    # Start webhook server for receiving messages from CRM
    webhook_runner = await start_webhook_server(WEBHOOK_HOST, WEBHOOK_PORT)

    # Start polling
    try:
        logger.info("Starting bot polling...")
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        await webhook_runner.cleanup()
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Bot crashed: {e}")
