"""Chat entry and exit handlers."""

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery

from core.message_manager import set_last_message_id
from core.states import ChatState, clear_active_chat, set_active_chat
from locales import get_text
from ui.keyboards import chat_keyboard

router = Router()


@router.callback_query(F.data.startswith("chat:"))
async def start_chat(callback: CallbackQuery, state: FSMContext):
    """Start chat for an order."""
    from core.api_client import api_client

    user_id = callback.from_user.id
    order_id = callback.data.split(":")[1]

    try:
        orders = await api_client.get_customer_orders(str(user_id))
        order = next((o for o in orders if o["id"] == order_id), None)

        if not order:
            await callback.answer(get_text("error", user_id))
            return

        await state.set_state(ChatState.chatting)
        await state.update_data(order_id=order_id, order_title=order["title"])

        # Track that user is now in chat for this order
        set_active_chat(user_id, order_id)

        await callback.message.edit_text(
            get_text("chat_start", user_id, title=order["title"]),
            reply_markup=chat_keyboard(order_id, user_id),
            parse_mode="HTML",
        )
        # Track this message for potential cleanup
        set_last_message_id(user_id, callback.message.message_id)
    except Exception:
        await callback.answer(get_text("error", user_id))

    await callback.answer()


@router.callback_query(F.data.startswith("exit_chat:"))
async def exit_chat(callback: CallbackQuery, state: FSMContext):
    """Exit chat and go back to order details."""
    user_id = callback.from_user.id
    order_id = callback.data.split(":")[1]

    # Clear chat state
    await state.clear()
    clear_active_chat(user_id)

    # Redirect to order details
    try:
        from handlers.orders.helpers import build_order_detail_text, get_order_by_id
        from ui.keyboards import order_detail_keyboard

        order = await get_order_by_id(user_id, order_id)

        if order:
            detail_text = build_order_detail_text(order, user_id)
            await callback.message.edit_text(
                detail_text,
                reply_markup=order_detail_keyboard(order_id, user_id, order["status"]),
                parse_mode="HTML",
            )
            set_last_message_id(user_id, callback.message.message_id)
    except Exception:
        await callback.answer(get_text("error", user_id))

    await callback.answer()
