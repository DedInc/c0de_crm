"""Validation utilities for the bot."""


def is_valid_telegram_id(telegram_id: str | None) -> bool:
    """
    Validate that a Telegram ID is in the correct format.

    Telegram IDs are 7-15 digit numbers.

    Args:
        telegram_id: The Telegram ID to validate

    Returns:
        True if valid, False otherwise
    """
    if not telegram_id:
        return False
    return telegram_id.isdigit() and 7 <= len(telegram_id) <= 15


def parse_cost(text: str) -> float | None:
    """
    Parse cost from user input.

    Accepts various formats:
    - Plain numbers: "500", "500.00"
    - With comma: "500,00"
    - With dollar sign: "$500"
    - Combinations: "$500.00", "$500,00"

    Args:
        text: User input text

    Returns:
        Parsed cost as float (0 or positive), or None if invalid
    """
    try:
        cost = float(text.replace(",", ".").replace("$", "").strip())
        return cost if cost >= 0 else None
    except ValueError:
        return None
