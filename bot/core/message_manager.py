"""Message manager for clean bot interactions.

This module provides utilities to manage bot messages, ensuring clean UI
by deleting or editing previous messages instead of accumulating them.
"""

import logging

from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import Message

logger = logging.getLogger(__name__)

# Store last bot message ID per user for cleanup
_last_bot_messages: dict[int, int] = {}


def get_last_message_id(user_id: int) -> int | None:
    """Get the last bot message ID for a user."""
    return _last_bot_messages.get(user_id)


def set_last_message_id(user_id: int, message_id: int) -> None:
    """Store the last bot message ID for a user."""
    _last_bot_messages[user_id] = message_id


def clear_last_message_id(user_id: int) -> None:
    """Clear the stored message ID for a user."""
    _last_bot_messages.pop(user_id, None)


async def delete_last_message(bot: Bot, user_id: int) -> bool:
    """Delete the last bot message for a user.

    Returns True if message was deleted, False otherwise.
    """
    message_id = _last_bot_messages.get(user_id)
    if not message_id:
        return False

    try:
        await bot.delete_message(chat_id=user_id, message_id=message_id)
        _last_bot_messages.pop(user_id, None)
        return True
    except TelegramBadRequest as e:
        # Message might already be deleted or too old
        logger.debug(f"Could not delete message {message_id} for user {user_id}: {e}")
        _last_bot_messages.pop(user_id, None)
        return False
    except Exception as e:
        logger.error(f"Error deleting message: {e}")
        return False


async def safe_delete_message(bot: Bot, chat_id: int, message_id: int) -> bool:
    """Safely delete a specific message.

    Returns True if message was deleted, False otherwise.
    """
    try:
        await bot.delete_message(chat_id=chat_id, message_id=message_id)
        return True
    except TelegramBadRequest:
        # Message might already be deleted or too old
        return False
    except Exception as e:
        logger.error(f"Error deleting message: {e}")
        return False


async def send_and_track(
    message: Message,
    text: str,
    reply_markup=None,
    parse_mode: str = "HTML",
    delete_previous: bool = True,
) -> Message:
    """Send a message and track it for future cleanup.

    Args:
        message: The incoming message (used to get bot and chat info)
        text: Text to send
        reply_markup: Optional keyboard markup
        parse_mode: Parse mode for the message
        delete_previous: Whether to delete the previous tracked message

    Returns:
        The sent message
    """
    user_id = message.from_user.id
    bot = message.bot

    # Delete previous message if requested
    if delete_previous:
        await delete_last_message(bot, user_id)

    # Send new message
    sent = await message.answer(text, reply_markup=reply_markup, parse_mode=parse_mode)

    # Track the new message
    set_last_message_id(user_id, sent.message_id)

    return sent


async def edit_or_send(
    message: Message, text: str, reply_markup=None, parse_mode: str = "HTML"
) -> Message:
    """Try to edit the message, or send a new one if editing fails.

    This is useful for callback handlers where we want to edit the existing message.

    Args:
        message: The message to edit (typically callback.message)
        text: New text
        reply_markup: Optional keyboard markup
        parse_mode: Parse mode for the message

    Returns:
        The edited or new message
    """
    user_id = message.chat.id

    try:
        await message.edit_text(text, reply_markup=reply_markup, parse_mode=parse_mode)
        set_last_message_id(user_id, message.message_id)
        return message
    except TelegramBadRequest as e:
        if "message is not modified" in str(e).lower():
            # Content is the same, no need to update
            return message
        # If editing fails, send a new message
        logger.debug(f"Could not edit message, sending new one: {e}")
        sent = await message.answer(text, reply_markup=reply_markup, parse_mode=parse_mode)
        set_last_message_id(user_id, sent.message_id)
        return sent
