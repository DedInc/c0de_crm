"""Localization module for the bot."""

import logging

from core.config import CRM_API_URL, DEFAULT_LANGUAGE

from .en import messages as en_messages
from .ru import messages as ru_messages

logger = logging.getLogger(__name__)

_locales = {
    "en": en_messages,
    "ru": ru_messages,
}

# In-memory cache for user languages (synced with database)
_user_languages: dict[int, str] = {}


async def _fetch_user_language(user_id: int) -> str | None:
    """Fetch user language from the CRM API."""
    import json

    import aiohttp

    try:
        url = f"{CRM_API_URL}/bot.getUserLanguage"
        params = {"input": json.dumps({"telegramId": str(user_id)})}

        async with aiohttp.ClientSession() as session, session.get(url, params=params) as response:
            if response.status == 200:
                data = await response.json()
                result = data.get("result", {}).get("data", {})
                return result.get("language")
    except Exception as e:
        logger.error(f"Failed to fetch user language: {e}")

    return None


async def _save_user_language(user_id: int, language: str) -> bool:
    """Save user language to the CRM API."""
    import aiohttp

    try:
        url = f"{CRM_API_URL}/bot.setUserLanguage"

        async with (
            aiohttp.ClientSession() as session,
            session.post(url, json={"telegramId": str(user_id), "language": language}) as response,
        ):
            if response.status == 200:
                return True
    except Exception as e:
        logger.error(f"Failed to save user language: {e}")

    return False


async def load_user_language(user_id: int) -> str:
    """Load user language from database and cache it."""
    if user_id in _user_languages:
        return _user_languages[user_id]

    lang = await _fetch_user_language(user_id)
    if lang:
        _user_languages[user_id] = lang
        return lang

    return DEFAULT_LANGUAGE


def get_text(key: str, user_id: int, **kwargs) -> str:
    """Get localized text for a user (sync version, uses cached language)."""
    lang = _user_languages.get(user_id, DEFAULT_LANGUAGE)
    messages = _locales.get(lang, _locales[DEFAULT_LANGUAGE])
    text = messages.get(key, _locales[DEFAULT_LANGUAGE].get(key, key))

    if kwargs:
        try:
            text = text.format(**kwargs)
        except KeyError:
            pass

    return text


def get_text_by_lang(key: str, lang: str, **kwargs) -> str:
    """Get localized text for a specific language."""
    messages = _locales.get(lang, _locales[DEFAULT_LANGUAGE])
    text = messages.get(key, _locales[DEFAULT_LANGUAGE].get(key, key))

    if kwargs:
        try:
            text = text.format(**kwargs)
        except KeyError:
            pass

    return text


async def set_user_language(user_id: int, language: str) -> None:
    """Set user's preferred language (saves to database)."""
    if language in _locales:
        _user_languages[user_id] = language
        await _save_user_language(user_id, language)


def set_user_language_sync(user_id: int, language: str) -> None:
    """Set user's preferred language synchronously (cache only, for immediate use)."""
    if language in _locales:
        _user_languages[user_id] = language


def get_user_language(user_id: int) -> str:
    """Get user's preferred language from cache."""
    return _user_languages.get(user_id, DEFAULT_LANGUAGE)


def get_status_text(status: str, user_id: int) -> str:
    """Get localized status text."""
    return get_text(f"status_{status}", user_id)


async def is_new_user(user_id: int) -> bool:
    """Check if user is new (hasn't set a language preference yet)."""
    # First check cache
    if user_id in _user_languages:
        return False

    # Then check database
    lang = await _fetch_user_language(user_id)
    if lang:
        _user_languages[user_id] = lang
        return False

    return True
