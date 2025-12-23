"""Language selection handlers."""

from aiogram import F, Router
from aiogram.types import CallbackQuery, Message

from core.message_manager import delete_last_message, set_last_message_id
from locales import get_text, set_user_language, set_user_language_sync
from ui.keyboards import language_keyboard, main_menu_keyboard

router = Router()


@router.message(F.text.in_(["🌐 Language", "🌐 Язык"]))
async def language_menu(message: Message):
    """Show language selection menu."""
    user_id = message.from_user.id

    # Delete previous bot message for clean UI
    await delete_last_message(message.bot, user_id)

    sent = await message.answer(
        get_text("language_select", user_id), reply_markup=language_keyboard(user_id)
    )
    set_last_message_id(user_id, sent.message_id)


@router.callback_query(F.data.startswith("lang:"))
async def set_language_handler(callback: CallbackQuery):
    """Set user language."""
    user_id = callback.from_user.id
    language = callback.data.split(":")[1]

    # Set language in cache immediately for instant UI update
    set_user_language_sync(user_id, language)

    # Save to database asynchronously
    await set_user_language(user_id, language)

    # Edit the current message to show confirmation, then show main menu
    await callback.message.edit_text(get_text("language_changed", user_id))

    sent = await callback.message.answer(
        get_text("main_menu", user_id), reply_markup=main_menu_keyboard(user_id)
    )
    set_last_message_id(user_id, sent.message_id)

    await callback.answer()
