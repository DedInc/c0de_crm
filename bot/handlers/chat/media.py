"""Media message handlers for chat (photos and media groups)."""

import asyncio
import logging

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from core.api_client import api_client
from core.states import ChatState, clear_active_chat
from locales import get_text

from .utils import delete_message_after_delay

router = Router()
logger = logging.getLogger(__name__)


@router.message(ChatState.chatting, F.photo)
async def process_chat_photo(message: Message, state: FSMContext):
    """Process photo message from customer in chat."""
    user_id = message.from_user.id

    data = await state.get_data()
    order_id = data.get("order_id")

    if not order_id:
        await state.clear()
        clear_active_chat(user_id)
        return

    try:
        # Get the largest photo (last in the list)
        photo = message.photo[-1]
        file = await message.bot.get_file(photo.file_id)

        # Construct the Telegram file URL
        bot_token = message.bot.token
        image_url = f"https://api.telegram.org/file/bot{bot_token}/{file.file_path}"

        # Get caption if any
        caption = message.caption or ""

        await api_client.send_customer_message(
            order_id=order_id,
            customer_telegram_id=str(user_id),
            message=caption,
            image_urls=[image_url],
        )

        # Send confirmation and auto-delete after 330ms
        confirmation_msg = await message.answer(get_text("chat_message_sent", user_id))

        # Schedule deletion
        _background_tasks: set = getattr(process_chat_photo, "_tasks", set())
        task = asyncio.create_task(delete_message_after_delay(confirmation_msg, 0.33))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
        process_chat_photo._tasks = _background_tasks
    except Exception as e:
        logger.error(f"Failed to send photo message: {e}")
        await message.answer(get_text("error", user_id))


@router.message(ChatState.chatting, F.media_group_id)
async def process_chat_media_group(message: Message, state: FSMContext):
    """Process media group (multiple photos) from customer in chat."""
    user_id = message.from_user.id

    data = await state.get_data()
    order_id = data.get("order_id")

    if not order_id:
        await state.clear()
        clear_active_chat(user_id)
        return

    # Get or create media group tracking
    media_group_id = message.media_group_id
    pending_groups = data.get("pending_media_groups", {})

    if media_group_id not in pending_groups:
        pending_groups[media_group_id] = {"image_urls": [], "caption": message.caption or ""}

    try:
        if message.photo:
            # Get the largest photo
            photo = message.photo[-1]
            file = await message.bot.get_file(photo.file_id)
            bot_token = message.bot.token
            image_url = f"https://api.telegram.org/file/bot{bot_token}/{file.file_path}"
            pending_groups[media_group_id]["image_urls"].append(image_url)

            # Update caption if this message has one
            if message.caption:
                pending_groups[media_group_id]["caption"] = message.caption

        await state.update_data(pending_media_groups=pending_groups)

        # Schedule sending after a short delay to collect all images in the group
        _background_tasks: set = getattr(process_chat_media_group, "_tasks", set())
        task = asyncio.create_task(
            _send_media_group_after_delay(user_id, order_id, media_group_id, state, message)
        )
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
        process_chat_media_group._tasks = _background_tasks

    except Exception as e:
        logger.error(f"Failed to process media group: {e}")


async def _send_media_group_after_delay(
    user_id: int, order_id: str, media_group_id: str, state: FSMContext, message: Message
):
    """Send media group after collecting all images."""
    await asyncio.sleep(1.0)  # Wait for all images to be collected

    try:
        data = await state.get_data()
        pending_groups = data.get("pending_media_groups", {})

        if media_group_id not in pending_groups:
            return

        group_data = pending_groups.pop(media_group_id)
        await state.update_data(pending_media_groups=pending_groups)

        if group_data["image_urls"]:
            await api_client.send_customer_message(
                order_id=order_id,
                customer_telegram_id=str(user_id),
                message=group_data["caption"],
                image_urls=group_data["image_urls"],
            )

            # Send confirmation
            confirmation_msg = await message.answer(get_text("chat_message_sent", user_id))
            await asyncio.sleep(0.33)
            try:
                await confirmation_msg.delete()
            except Exception:
                pass
    except Exception as e:
        logger.error(f"Failed to send media group: {e}")
