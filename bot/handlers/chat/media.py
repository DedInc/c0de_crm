"""Media message handlers for chat (photos, documents, and media groups)."""

import asyncio
import logging

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from core.api_client import api_client
from core.r2_storage import upload_to_r2 as r2_upload
from core.states import ChatState, clear_active_chat
from core.telegram_context import get_message_context
from locales import get_text

from .utils import delete_message_after_delay

router = Router()
logger = logging.getLogger(__name__)

ALLOWED_DOCUMENT_MIMES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "application/zip",
    "application/x-rar-compressed",
    "application/vnd.rar",
    "application/x-7z-compressed",
    "application/gzip",
    "application/x-tar",
}


async def _upload_photo_to_r2(message: Message, order_id: str) -> str:
    """Download photo from Telegram and upload to R2.

    Tries direct R2 upload first, falls back to CRM proxy, then tg-file reference.
    """
    context = get_message_context(message)
    if context is None or message.photo is None:
        raise ValueError("Photo message has no sender, bot, or photo")
    _user_id, bot = context

    photo = message.photo[-1]
    file = await bot.get_file(photo.file_id)
    if file.file_path is None:
        raise ValueError("Telegram photo file path is missing")

    file_bytes = await bot.download_file(file.file_path)
    if not file_bytes:
        return f"tg-file:{file.file_path}"

    raw_bytes = file_bytes.read()
    ext = file.file_path.rsplit(".", 1)[-1] if "." in file.file_path else "jpg"
    content_type = f"image/{ext}" if ext in ("jpeg", "jpg", "png", "gif", "webp") else "image/jpeg"

    # Try direct R2 upload (skips SvelteKit middleman)
    r2_key = await r2_upload(raw_bytes, order_id, ext, content_type)
    if r2_key:
        return r2_key

    # Fallback: upload via SvelteKit proxy
    r2_key = await api_client.upload_file(
        file_bytes=raw_bytes,
        filename=f"photo.{ext}",
        order_id=order_id,
        content_type=content_type,
    )
    if r2_key:
        return r2_key

    # Last resort: Telegram file reference
    return f"tg-file:{file.file_path}"


@router.message(ChatState.chatting, F.photo)
async def process_chat_photo(message: Message, state: FSMContext) -> None:
    """Process photo message from customer in chat."""
    context = get_message_context(message)
    if context is None:
        return
    user_id, _bot = context

    data = await state.get_data()
    order_id = data.get("order_id")

    if not order_id:
        await state.clear()
        clear_active_chat(user_id)
        return

    try:
        image_ref = await _upload_photo_to_r2(message, order_id)
        caption = message.caption or ""

        await api_client.send_customer_message(
            order_id=order_id,
            customer_telegram_id=str(user_id),
            message=caption,
            image_urls=[image_ref],
        )

        confirmation_msg = await message.answer(get_text("chat_message_sent", user_id))

        _background_tasks: set[asyncio.Task[None]] = set()
        task = asyncio.create_task(delete_message_after_delay(confirmation_msg, 0.33))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
    except Exception as e:
        logger.error(f"Failed to send photo message: {e}")
        await message.answer(get_text("error", user_id))


@router.message(ChatState.chatting, F.media_group_id)
async def process_chat_media_group(message: Message, state: FSMContext) -> None:
    """Process media group (multiple photos) from customer in chat."""
    context = get_message_context(message)
    if context is None or message.media_group_id is None:
        return
    user_id, _bot = context

    data = await state.get_data()
    order_id = data.get("order_id")

    if not order_id:
        await state.clear()
        clear_active_chat(user_id)
        return

    media_group_id = message.media_group_id
    pending_groups = data.get("pending_media_groups", {})

    if media_group_id not in pending_groups:
        pending_groups[media_group_id] = {"image_urls": [], "caption": message.caption or ""}

    try:
        if message.photo:
            image_ref = await _upload_photo_to_r2(message, order_id)
            pending_groups[media_group_id]["image_urls"].append(image_ref)

            if message.caption:
                pending_groups[media_group_id]["caption"] = message.caption

        await state.update_data(pending_media_groups=pending_groups)

        _background_tasks: set[asyncio.Task[None]] = set()
        task = asyncio.create_task(
            _send_media_group_after_delay(user_id, order_id, media_group_id, state, message)
        )
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)

    except Exception as e:
        logger.error(f"Failed to process media group: {e}")


async def _send_media_group_after_delay(
    user_id: int, order_id: str, media_group_id: str, state: FSMContext, message: Message
) -> None:
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


async def _upload_document_to_r2(message: Message, order_id: str) -> tuple[str, str, str]:
    """Download document from Telegram and upload to R2.

    Returns (url_ref, filename, mime_type).
    """
    context = get_message_context(message)
    if context is None or message.document is None:
        raise ValueError("Document message has no sender, bot, or document")
    _user_id, bot = context

    doc = message.document
    file = await bot.get_file(doc.file_id)
    if file.file_path is None:
        raise ValueError("Telegram document file path is missing")
    filename = doc.file_name or "document"
    mime_type = doc.mime_type or "application/octet-stream"

    file_bytes = await bot.download_file(file.file_path)
    if not file_bytes:
        return f"tg-file:{file.file_path}", filename, mime_type

    raw_bytes = file_bytes.read()
    ext = filename.rsplit(".", 1)[-1] if "." in filename else ""

    r2_key = await r2_upload(raw_bytes, order_id, ext, mime_type)
    if r2_key:
        return r2_key, filename, mime_type

    r2_key = await api_client.upload_file(
        file_bytes=raw_bytes,
        filename=filename,
        order_id=order_id,
        content_type=mime_type,
    )
    if r2_key:
        return r2_key, filename, mime_type

    return f"tg-file:{file.file_path}", filename, mime_type


@router.message(ChatState.chatting, F.document)
async def process_chat_document(message: Message, state: FSMContext) -> None:
    """Process document message from customer in chat."""
    context = get_message_context(message)
    if context is None or message.document is None:
        return
    user_id, _bot = context

    data = await state.get_data()
    order_id = data.get("order_id")

    if not order_id:
        await state.clear()
        clear_active_chat(user_id)
        return

    doc = message.document
    mime_type = doc.mime_type or "application/octet-stream"

    if mime_type not in ALLOWED_DOCUMENT_MIMES:
        await message.answer(get_text("chat_unsupported_file", user_id))
        return

    if doc.file_size and doc.file_size > 10 * 1024 * 1024:
        await message.answer(get_text("chat_file_too_large", user_id))
        return

    try:
        file_ref, filename, file_mime = await _upload_document_to_r2(message, order_id)
        caption = message.caption or ""

        await api_client.send_customer_message(
            order_id=order_id,
            customer_telegram_id=str(user_id),
            message=caption,
            file_urls=[{"url": file_ref, "name": filename, "type": file_mime}],
        )

        confirmation_msg = await message.answer(get_text("chat_message_sent", user_id))

        _background_tasks: set[asyncio.Task[None]] = set()
        task = asyncio.create_task(delete_message_after_delay(confirmation_msg, 0.33))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
    except Exception as e:
        logger.error(f"Failed to send document message: {e}")
        await message.answer(get_text("error", user_id))
