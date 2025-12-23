"""Text message handlers for chat."""

import asyncio

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from core.api_client import api_client
from core.states import ChatState, clear_active_chat
from locales import get_text

from .utils import delete_message_after_delay

router = Router()


@router.message(ChatState.chatting, F.text)
async def process_chat_message(message: Message, state: FSMContext):
    """Process text message from customer in chat."""
    user_id = message.from_user.id

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
        _background_tasks: set = getattr(process_chat_message, "_tasks", set())
        task = asyncio.create_task(delete_message_after_delay(confirmation_msg, 0.33))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
        process_chat_message._tasks = _background_tasks
    except Exception:
        await message.answer(get_text("error", user_id))


async def send_message_to_customer(bot, telegram_id: str, message: str):
    """Send a message to a customer from CRM."""
    try:
        await bot.send_message(chat_id=int(telegram_id), text=message, parse_mode="HTML")
        return True
    except Exception as e:
        print(f"Failed to send message to {telegram_id}: {e}")
        return False
