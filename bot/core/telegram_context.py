"""Typed helpers for aiogram handler context."""

from aiogram import Bot
from aiogram.types import CallbackQuery, Message


def get_message_context(message: Message) -> tuple[int, Bot] | None:
    """Return sender id and bot when both are available."""
    if message.from_user is None or message.bot is None:
        return None
    return message.from_user.id, message.bot


def get_callback_message(callback: CallbackQuery) -> Message | None:
    """Return an editable callback message, excluding inaccessible messages."""
    if isinstance(callback.message, Message):
        return callback.message
    return None


def get_callback_data(callback: CallbackQuery) -> str | None:
    """Return callback data when present."""
    return callback.data
