"""Start and menu command handlers."""

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from core.message_manager import delete_last_message, set_last_message_id
from core.states import clear_active_chat
from locales import get_text, is_new_user, load_user_language
from ui.keyboards import language_keyboard, main_menu_keyboard

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    """Handle /start command."""
    user_id = message.from_user.id

    # Clear any previous state
    await state.clear()
    clear_active_chat(user_id)

    # Delete previous bot message for clean UI
    await delete_last_message(message.bot, user_id)

    # Check if this is a new user who hasn't selected a language yet
    if await is_new_user(user_id):
        # Show language selection first for new users
        sent = await message.answer(
            get_text("welcome_select_language", user_id), reply_markup=language_keyboard(user_id)
        )
        set_last_message_id(user_id, sent.message_id)
    else:
        # Load user's language preference from database
        await load_user_language(user_id)
        sent = await message.answer(
            get_text("welcome", user_id), reply_markup=main_menu_keyboard(user_id)
        )
        set_last_message_id(user_id, sent.message_id)


@router.message(Command("menu"))
async def cmd_menu(message: Message, state: FSMContext):
    """Handle /menu command."""
    user_id = message.from_user.id

    # Clear any previous state
    await state.clear()
    clear_active_chat(user_id)

    # Delete previous bot message for clean UI
    await delete_last_message(message.bot, user_id)

    sent = await message.answer(
        get_text("main_menu", user_id), reply_markup=main_menu_keyboard(user_id)
    )
    set_last_message_id(user_id, sent.message_id)


@router.message(F.text.in_(["❓ Help", "❓ Помощь"]))
async def help_handler(message: Message):
    """Handle help button."""
    user_id = message.from_user.id

    # Delete previous bot message for clean UI
    await delete_last_message(message.bot, user_id)

    sent = await message.answer(get_text("help_text", user_id), parse_mode="HTML")
    set_last_message_id(user_id, sent.message_id)
