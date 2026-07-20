"""Order viewing and management handlers."""

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from core.api_client import api_client
from core.message_manager import delete_last_message, set_last_message_id
from core.states import clear_active_chat
from core.telegram_context import get_callback_data, get_callback_message, get_message_context
from locales import get_text
from ui.keyboards import (
    delete_confirm_keyboard,
    main_menu_keyboard,
    order_detail_keyboard,
    orders_keyboard,
)

from .helpers import build_order_detail_text, get_order_by_id

router = Router()


@router.message(F.text.in_(["📋 My Orders", "📋 Мои заказы"]))
async def view_orders(message: Message, state: FSMContext) -> None:
    """View user's orders."""
    context = get_message_context(message)
    if context is None:
        return
    user_id, bot = context

    clear_active_chat(user_id)
    await delete_last_message(bot, user_id)

    try:
        orders = await api_client.get_customer_orders(str(user_id))

        if not orders:
            sent = await message.answer(
                get_text("orders_empty", user_id), reply_markup=main_menu_keyboard(user_id)
            )
            set_last_message_id(user_id, sent.message_id)
            return

        await state.update_data(cached_orders=orders, orders_page=0)

        sent = await message.answer(
            get_text("orders_title", user_id), reply_markup=orders_keyboard(orders, user_id, page=0)
        )
        set_last_message_id(user_id, sent.message_id)
    except Exception:
        await message.answer(get_text("error", user_id))


@router.callback_query(F.data.startswith("orders_page:"))
async def handle_orders_pagination(callback: CallbackQuery, state: FSMContext) -> None:
    """Handle orders pagination."""
    user_id = callback.from_user.id
    callback_data = get_callback_data(callback)
    callback_message = get_callback_message(callback)
    if callback_data is None or callback_message is None:
        await callback.answer()
        return
    page = int(callback_data.split(":")[1])

    try:
        data = await state.get_data()
        orders = data.get("cached_orders", [])

        if not orders:
            orders = await api_client.get_customer_orders(str(user_id))
            await state.update_data(cached_orders=orders)

        await state.update_data(orders_page=page)

        await callback_message.edit_reply_markup(
            reply_markup=orders_keyboard(orders, user_id, page=page)
        )
    except Exception:
        await callback.answer(get_text("error", user_id))

    await callback.answer()


@router.callback_query(F.data == "orders_page_info")
async def handle_orders_page_info(callback: CallbackQuery) -> None:
    """Handle click on page info button (do nothing)."""
    await callback.answer()


@router.callback_query(F.data.startswith("order:"))
async def view_order_detail(callback: CallbackQuery, state: FSMContext) -> None:
    """View order details."""
    user_id = callback.from_user.id
    callback_data = get_callback_data(callback)
    callback_message = get_callback_message(callback)
    if callback_data is None or callback_message is None:
        await callback.answer()
        return
    order_id = callback_data.split(":")[1]

    clear_active_chat(user_id)
    await state.clear()

    try:
        order = await get_order_by_id(user_id, order_id)

        if not order:
            await callback.answer(get_text("error", user_id))
            return

        detail_text = build_order_detail_text(order, user_id)

        await callback_message.edit_text(
            detail_text,
            reply_markup=order_detail_keyboard(order_id, user_id, order["status"]),
            parse_mode="HTML",
        )
        set_last_message_id(user_id, callback_message.message_id)
    except Exception:
        await callback.answer(get_text("error", user_id))

    await callback.answer()


@router.callback_query(F.data.startswith("delete_order:"))
async def delete_order_prompt(callback: CallbackQuery) -> None:
    """Show delete confirmation prompt."""
    user_id = callback.from_user.id
    callback_data = get_callback_data(callback)
    callback_message = get_callback_message(callback)
    if callback_data is None or callback_message is None:
        await callback.answer()
        return
    order_id = callback_data.split(":")[1]

    try:
        order = await get_order_by_id(user_id, order_id)

        if not order:
            await callback.answer(get_text("error", user_id))
            return

        await callback_message.edit_text(
            get_text("order_delete_confirm", user_id, title=order["title"]),
            reply_markup=delete_confirm_keyboard(order_id, user_id),
            parse_mode="HTML",
        )
        set_last_message_id(user_id, callback_message.message_id)
    except Exception:
        await callback.answer(get_text("error", user_id))

    await callback.answer()


@router.callback_query(F.data.startswith("confirm_delete:"))
async def confirm_delete_order(callback: CallbackQuery, _state: FSMContext) -> None:
    """Confirm and delete the order."""
    user_id = callback.from_user.id
    callback_data = get_callback_data(callback)
    callback_message = get_callback_message(callback)
    if callback_data is None or callback_message is None:
        await callback.answer()
        return
    order_id = callback_data.split(":")[1]

    try:
        await api_client.delete_order(order_id, str(user_id))
        await callback_message.edit_text(get_text("order_deleted", user_id))
        set_last_message_id(user_id, callback_message.message_id)
    except Exception as e:
        error_msg = str(e)
        if "Cannot delete" in error_msg or "current status" in error_msg:
            await callback_message.edit_text(get_text("order_delete_error", user_id))
        else:
            await callback_message.edit_text(get_text("error", user_id))
        set_last_message_id(user_id, callback_message.message_id)

    await callback.answer()


@router.callback_query(F.data == "back_to_orders")
async def back_to_orders(callback: CallbackQuery, state: FSMContext) -> None:
    """Go back to orders list."""
    user_id = callback.from_user.id
    callback_message = get_callback_message(callback)
    if callback_message is None:
        await callback.answer()
        return

    clear_active_chat(user_id)

    try:
        data = await state.get_data()
        page = data.get("orders_page", 0)
        orders = await api_client.get_customer_orders(str(user_id))
        await state.update_data(cached_orders=orders)

        await callback_message.edit_text(
            get_text("orders_title", user_id),
            reply_markup=orders_keyboard(orders, user_id, page=page),
        )
        set_last_message_id(user_id, callback_message.message_id)
    except Exception:
        await callback.answer(get_text("error", user_id))

    await callback.answer()
