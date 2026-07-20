"""FSM states and active chat tracking."""

from aiogram.fsm.state import State, StatesGroup


class OrderCreation(StatesGroup):
    """States for order creation flow."""

    title = State()
    description = State()
    cost = State()
    markers = State()
    payment = State()
    confirm = State()


class ChatState(StatesGroup):
    """States for chat flow."""

    chatting = State()


# Global storage for active chat sessions (user_id -> order_id)
# This tracks which order a user is currently chatting about
_active_chats: dict[int, str] = {}


def set_active_chat(user_id: int, order_id: str) -> None:
    """Set the active chat order for a user."""
    _active_chats[user_id] = order_id


def get_active_chat(user_id: int) -> str | None:
    """Get the active chat order for a user."""
    return _active_chats.get(user_id)


def clear_active_chat(user_id: int) -> None:
    """Clear the active chat for a user."""
    _active_chats.pop(user_id, None)


def is_user_in_chat(user_id: int, order_id: str) -> bool:
    """Check if user is currently in chat for a specific order."""
    return _active_chats.get(user_id) == order_id
