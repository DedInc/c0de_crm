"""Order creation flow handlers."""

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from core.api_client import api_client
from core.message_manager import delete_last_message, set_last_message_id
from core.states import OrderCreation, clear_active_chat
from locales import get_text
from ui.keyboards import (
    cancel_keyboard,
    confirm_keyboard,
    markers_keyboard,
    payment_keyboard,
)
from utils.validation import parse_cost

from .helpers import (
    build_confirmation_text,
    check_order_limit,
    fetch_markers,
    fetch_payment_methods,
)

router = Router()


@router.message(F.text.in_(["📝 New Order", "📝 Новый заказ"]))
async def start_order_creation(message: Message, state: FSMContext):
    """Start order creation flow."""
    user_id = message.from_user.id

    clear_active_chat(user_id)
    await delete_last_message(message.bot, user_id)

    if await check_order_limit(user_id):
        sent = await message.answer(get_text("order_limit", user_id))
        set_last_message_id(user_id, sent.message_id)
        return

    await state.set_state(OrderCreation.title)
    sent = await message.answer(
        get_text("order_create_title", user_id), reply_markup=cancel_keyboard(user_id)
    )
    set_last_message_id(user_id, sent.message_id)


@router.message(OrderCreation.title)
async def process_title(message: Message, state: FSMContext):
    """Process order title."""
    user_id = message.from_user.id

    await delete_last_message(message.bot, user_id)
    await state.update_data(title=message.text)
    await state.set_state(OrderCreation.description)

    sent = await message.answer(
        get_text("order_create_description", user_id), reply_markup=cancel_keyboard(user_id)
    )
    set_last_message_id(user_id, sent.message_id)


@router.message(OrderCreation.description)
async def process_description(message: Message, state: FSMContext):
    """Process order description."""
    user_id = message.from_user.id

    await delete_last_message(message.bot, user_id)
    await state.update_data(description=message.text)
    await state.set_state(OrderCreation.cost)

    sent = await message.answer(
        get_text("order_create_cost", user_id), reply_markup=cancel_keyboard(user_id)
    )
    set_last_message_id(user_id, sent.message_id)


@router.message(OrderCreation.cost)
async def process_cost(message: Message, state: FSMContext):
    """Process order cost."""
    user_id = message.from_user.id

    await delete_last_message(message.bot, user_id)

    cost = parse_cost(message.text)
    if cost is None:
        sent = await message.answer(get_text("order_create_cost", user_id))
        set_last_message_id(user_id, sent.message_id)
        return

    await state.update_data(cost=cost, selected_markers=[], markers_page=0)
    await state.set_state(OrderCreation.markers)

    markers = await fetch_markers(state)

    sent = await message.answer(
        get_text("order_create_markers", user_id),
        reply_markup=markers_keyboard(markers, [], user_id, page=0),
    )
    set_last_message_id(user_id, sent.message_id)


@router.callback_query(F.data.startswith("marker:"), OrderCreation.markers)
async def process_marker_selection(callback: CallbackQuery, state: FSMContext):
    """Process marker selection."""
    user_id = callback.from_user.id
    marker_id = callback.data.split(":")[1]

    data = await state.get_data()
    selected = data.get("selected_markers", [])
    markers = data.get("available_markers", [])
    page = data.get("markers_page", 0)

    if marker_id in selected:
        selected.remove(marker_id)
    else:
        selected.append(marker_id)

    await state.update_data(selected_markers=selected)

    await callback.message.edit_reply_markup(
        reply_markup=markers_keyboard(markers, selected, user_id, page=page)
    )
    set_last_message_id(user_id, callback.message.message_id)
    await callback.answer()


@router.callback_query(F.data.startswith("markers_page:"), OrderCreation.markers)
async def process_markers_pagination(callback: CallbackQuery, state: FSMContext):
    """Process markers pagination."""
    user_id = callback.from_user.id
    page = int(callback.data.split(":")[1])

    data = await state.get_data()
    selected = data.get("selected_markers", [])
    markers = data.get("available_markers", [])

    await state.update_data(markers_page=page)

    await callback.message.edit_reply_markup(
        reply_markup=markers_keyboard(markers, selected, user_id, page=page)
    )
    await callback.answer()


@router.callback_query(F.data == "markers_page_info", OrderCreation.markers)
async def process_markers_page_info(callback: CallbackQuery):
    """Handle click on page info button (do nothing)."""
    await callback.answer()


@router.callback_query(F.data == "markers_done", OrderCreation.markers)
async def process_markers_done(callback: CallbackQuery, state: FSMContext):
    """Process markers selection done."""
    user_id = callback.from_user.id

    await state.set_state(OrderCreation.payment)

    # Fetch payment methods from API
    payment_methods = await fetch_payment_methods(state)

    if not payment_methods:
        # No payment methods configured, skip to confirmation
        await state.update_data(payment_method=None)
        await state.set_state(OrderCreation.confirm)

        data = await state.get_data()
        confirmation_text = build_confirmation_text(data, user_id)

        await callback.message.edit_text(
            confirmation_text,
            reply_markup=confirm_keyboard(user_id),
            parse_mode="HTML",
        )
    else:
        await callback.message.edit_text(
            get_text("order_create_payment", user_id),
            reply_markup=payment_keyboard(payment_methods, user_id),
        )

    set_last_message_id(user_id, callback.message.message_id)
    await callback.answer()


@router.callback_query(F.data.startswith("payment:"), OrderCreation.payment)
async def process_payment(callback: CallbackQuery, state: FSMContext):
    """Process payment method selection."""
    user_id = callback.from_user.id
    payment_method = callback.data.split(":")[1]

    await state.update_data(payment_method=payment_method)
    await state.set_state(OrderCreation.confirm)

    data = await state.get_data()
    confirmation_text = build_confirmation_text(data, user_id)

    await callback.message.edit_text(
        confirmation_text,
        reply_markup=confirm_keyboard(user_id),
        parse_mode="HTML",
    )
    set_last_message_id(user_id, callback.message.message_id)
    await callback.answer()


@router.callback_query(F.data == "confirm", OrderCreation.confirm)
async def process_confirm(callback: CallbackQuery, state: FSMContext):
    """Process order confirmation."""
    user_id = callback.from_user.id

    data = await state.get_data()

    try:
        await api_client.create_order(
            title=data["title"],
            description=data["description"],
            cost=data["cost"],
            customer_telegram_id=str(user_id),
            customer_name=callback.from_user.full_name,
            marker_ids=data.get("selected_markers", []),
            payment_method=data.get("payment_method"),
        )

        await callback.message.edit_text(get_text("order_created", user_id))
        set_last_message_id(user_id, callback.message.message_id)
    except Exception as e:
        await callback.message.edit_text(get_text("error", user_id) + f"\n\n{e!s}")
        set_last_message_id(user_id, callback.message.message_id)

    await state.clear()
    await callback.answer()


@router.callback_query(F.data == "cancel")
async def process_cancel(callback: CallbackQuery, state: FSMContext):
    """Process cancel action."""
    user_id = callback.from_user.id

    await state.clear()
    clear_active_chat(user_id)
    await callback.message.edit_text(get_text("order_cancelled", user_id))
    set_last_message_id(user_id, callback.message.message_id)
    await callback.answer()
