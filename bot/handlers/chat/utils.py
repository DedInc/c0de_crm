"""Utility functions for chat handlers."""

import asyncio

from aiogram.types import Message


async def delete_message_after_delay(message: Message, delay: float):
    """Delete a message after a specified delay in seconds."""
    await asyncio.sleep(delay)
    try:
        await message.delete()
    except Exception:
        pass  # Ignore errors if message already deleted or can't be deleted
