"""Pagination utilities for keyboard builders."""

from typing import TypeVar

from aiogram.types import InlineKeyboardButton

T = TypeVar("T")


def paginate_items(
    items: list[T], page: int = 0, page_size: int = 5
) -> tuple[list[T], int, int, int]:
    """
    Paginate a list of items.

    Args:
        items: List of items to paginate
        page: Current page (0-indexed)
        page_size: Number of items per page

    Returns:
        Tuple of (page_items, total_pages, start_idx, end_idx)
    """
    total_pages = max(1, (len(items) + page_size - 1) // page_size)
    start_idx = page * page_size
    end_idx = min(start_idx + page_size, len(items))
    page_items = items[start_idx:end_idx]

    return page_items, total_pages, start_idx, end_idx


def build_pagination_buttons(
    page: int,
    total_pages: int,
    callback_prefix: str,
    info_callback: str = "page_info",
) -> list[InlineKeyboardButton]:
    """
    Build pagination navigation buttons.

    Args:
        page: Current page (0-indexed)
        total_pages: Total number of pages
        callback_prefix: Prefix for callback data (e.g., "markers_page", "orders_page")
        info_callback: Callback data for the page info button

    Returns:
        List of navigation buttons (empty if only one page)
    """
    if total_pages <= 1:
        return []

    nav_buttons = []

    if page > 0:
        nav_buttons.append(
            InlineKeyboardButton(text="◀️", callback_data=f"{callback_prefix}:{page - 1}")
        )

    nav_buttons.append(
        InlineKeyboardButton(text=f"{page + 1}/{total_pages}", callback_data=info_callback)
    )

    if page < total_pages - 1:
        nav_buttons.append(
            InlineKeyboardButton(text="▶️", callback_data=f"{callback_prefix}:{page + 1}")
        )

    return nav_buttons
