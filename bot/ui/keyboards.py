"""Telegram keyboard builders for the bot."""

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder

from locales import get_text
from utils.pagination import build_pagination_buttons, paginate_items


def main_menu_keyboard(user_id: int) -> ReplyKeyboardMarkup:
    """Create main menu keyboard."""
    builder = ReplyKeyboardBuilder()
    builder.row(
        KeyboardButton(text=get_text("btn_new_order", user_id)),
        KeyboardButton(text=get_text("btn_my_orders", user_id)),
    )
    builder.row(
        KeyboardButton(text=get_text("btn_language", user_id)),
        KeyboardButton(text=get_text("btn_help", user_id)),
    )
    return builder.as_markup(resize_keyboard=True)


def language_keyboard(user_id: int) -> InlineKeyboardMarkup:
    """Create language selection keyboard."""
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text="🇬🇧 English", callback_data="lang:en"),
        InlineKeyboardButton(text="🇷🇺 Русский", callback_data="lang:ru"),
    )
    return builder.as_markup()


def cancel_keyboard(user_id: int) -> InlineKeyboardMarkup:
    """Create cancel keyboard."""
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text=get_text("cancel", user_id), callback_data="cancel"))
    return builder.as_markup()


def markers_keyboard(
    markers: list[dict], selected: list[str], user_id: int, page: int = 0, page_size: int = 5
) -> InlineKeyboardMarkup:
    """Create markers selection keyboard with pagination."""
    builder = InlineKeyboardBuilder()

    page_markers, total_pages, _, _ = paginate_items(markers, page, page_size)

    for marker in page_markers:
        is_selected = marker["id"] in selected
        text = f"{'✅ ' if is_selected else ''}{marker['name']}"
        builder.row(InlineKeyboardButton(text=text, callback_data=f"marker:{marker['id']}"))

    nav_buttons = build_pagination_buttons(page, total_pages, "markers_page", "markers_page_info")
    if nav_buttons:
        builder.row(*nav_buttons)

    builder.row(
        InlineKeyboardButton(
            text=get_text("order_create_markers_done", user_id), callback_data="markers_done"
        )
    )
    builder.row(InlineKeyboardButton(text=get_text("cancel", user_id), callback_data="cancel"))

    return builder.as_markup()


def payment_keyboard(payment_methods: list[dict], user_id: int) -> InlineKeyboardMarkup:
    """Create payment method selection keyboard with dynamic methods from API."""
    builder = InlineKeyboardBuilder()

    for method in payment_methods:
        builder.row(
            InlineKeyboardButton(text=method["name"], callback_data=f"payment:{method['id']}")
        )

    builder.row(InlineKeyboardButton(text=get_text("cancel", user_id), callback_data="cancel"))
    return builder.as_markup()


def confirm_keyboard(user_id: int) -> InlineKeyboardMarkup:
    """Create confirmation keyboard."""
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text=get_text("confirm", user_id), callback_data="confirm"),
        InlineKeyboardButton(text=get_text("cancel", user_id), callback_data="cancel"),
    )
    return builder.as_markup()


def orders_keyboard(
    orders: list[dict], user_id: int, page: int = 0, page_size: int = 5
) -> InlineKeyboardMarkup:
    """Create orders list keyboard with pagination."""
    builder = InlineKeyboardBuilder()

    page_orders, total_pages, _, _ = paginate_items(orders, page, page_size)

    status_emojis = {
        "pending_moderation": "⏳",
        "rejected": "❌",
        "approved": "✅",
        "in_progress": "🔄",
        "testing": "🧪",
        "completed": "✅",
        "delivered": "📦",
    }

    for order in page_orders:
        status_emoji = status_emojis.get(order["status"], "📋")
        text = f"{status_emoji} {order['title'][:30]}..."
        builder.row(InlineKeyboardButton(text=text, callback_data=f"order:{order['id']}"))

    nav_buttons = build_pagination_buttons(page, total_pages, "orders_page", "orders_page_info")
    if nav_buttons:
        builder.row(*nav_buttons)

    return builder.as_markup()


def order_detail_keyboard(order_id: str, user_id: int, status: str = "") -> InlineKeyboardMarkup:
    """Create order detail keyboard."""
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text=get_text("order_chat", user_id), callback_data=f"chat:{order_id}")
    )
    # Only show delete button for pending_moderation or rejected orders
    if status in ["pending_moderation", "rejected"]:
        builder.row(
            InlineKeyboardButton(
                text=get_text("order_delete", user_id), callback_data=f"delete_order:{order_id}"
            )
        )
    builder.row(
        InlineKeyboardButton(text=get_text("back", user_id), callback_data="back_to_orders")
    )
    return builder.as_markup()


def delete_confirm_keyboard(order_id: str, user_id: int) -> InlineKeyboardMarkup:
    """Create delete confirmation keyboard."""
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(
            text=get_text("delete_confirm_yes", user_id), callback_data=f"confirm_delete:{order_id}"
        ),
        InlineKeyboardButton(
            text=get_text("delete_confirm_no", user_id), callback_data=f"order:{order_id}"
        ),
    )
    return builder.as_markup()


def chat_keyboard(order_id: str, user_id: int) -> InlineKeyboardMarkup:
    """Create chat keyboard with exit button."""
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(
            text=get_text("exit_chat", user_id), callback_data=f"exit_chat:{order_id}"
        )
    )
    return builder.as_markup()


def enter_chat_keyboard(order_id: str, user_id: int) -> InlineKeyboardMarkup:
    """Create keyboard with button to enter chat (for incoming support messages)."""
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text=get_text("enter_chat", user_id), callback_data=f"chat:{order_id}")
    )
    return builder.as_markup()


def staff_order_link_keyboard(
    order_id: str, user_id: int, crm_base_url: str
) -> InlineKeyboardMarkup:
    """Create keyboard with button to open order in CRM."""
    builder = InlineKeyboardBuilder()
    order_url = f"{crm_base_url}/orders/{order_id}"
    builder.row(InlineKeyboardButton(text=get_text("open_order", user_id), url=order_url))
    return builder.as_markup()
