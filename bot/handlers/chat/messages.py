"""Text message handlers for chat."""

import asyncio
import logging

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from core.api_client import api_client
from core.states import ChatState, clear_active_chat
from core.telegram_context import get_message_context
from locales import get_text

from .utils import delete_message_after_delay

router = Router()
logger = logging.getLogger(__name__)


@router.message(ChatState.chatting, F.text)
async def process_chat_message(message: Message, state: FSMContext) -> None:
    """Process text message from customer in chat."""
    context = get_message_context(message)
    if context is None or message.text is None:
        return
    user_id, _bot = context

    data = await state.get_data()
    order_id = data.get("order_id")

    if not order_id:
        await state.clear()
        clear_active_chat(user_id)
        return

    try:
        await api_client.send_customer_message(
            order_id=order_id, customer_telegram_id=str(user_id), message=message.text
        )

        # Send confirmation and auto-delete after 330ms
        confirmation_msg = await message.answer(get_text("chat_message_sent", user_id))

        # Schedule deletion
        _background_tasks: set[asyncio.Task[None]] = set()
        task = asyncio.create_task(delete_message_after_delay(confirmation_msg, 0.33))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
    except Exception:
        await message.answer(get_text("error", user_id))


async def send_message_to_customer(bot: Bot, telegram_id: str, message: str) -> bool:
    """Send a message to a customer from CRM."""
    try:
        await bot.send_message(chat_id=int(telegram_id), text=message, parse_mode="HTML")
        return True
    except Exception as e:
        logger.error("Failed to send message to %s: %s", telegram_id, e)
        return False
