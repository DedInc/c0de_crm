"""Helper functions for order handlers."""

from aiogram.fsm.context import FSMContext

from core.api_client import api_client
from locales import get_text


async def check_order_limit(user_id: int) -> bool:
    """
    Check if user has reached order limit.

    Users can have maximum 2 open orders at a time.

    Args:
        user_id: Telegram user ID

    Returns:
        True if limit reached, False otherwise
    """
    try:
        orders = await api_client.get_customer_orders(str(user_id))
        open_statuses = ["pending_moderation", "approved", "in_progress", "testing"]
        open_orders = [o for o in orders if o["status"] in open_statuses]
        return len(open_orders) >= 2
    except Exception:
        return False


async def fetch_markers(state: FSMContext) -> list:
    """
    Fetch markers from API and store in state.

    Args:
        state: FSM context to store markers

    Returns:
        List of markers or empty list on error
    """
    try:
        markers = await api_client.get_markers()
        await state.update_data(available_markers=markers)
        return markers
    except Exception:
        await state.update_data(available_markers=[])
        return []


async def fetch_payment_methods(state: FSMContext) -> list:
    """
    Fetch payment methods from API and store in state.

    Args:
        state: FSM context to store payment methods

    Returns:
        List of payment methods or empty list on error
    """
    try:
        payment_methods = await api_client.get_payment_methods()
        await state.update_data(available_payment_methods=payment_methods)
        return payment_methods
    except Exception:
        await state.update_data(available_payment_methods=[])
        return []


async def get_order_by_id(user_id: int, order_id: str) -> dict | None:
    """
    Get order by ID for a specific user.

    Args:
        user_id: Telegram user ID
        order_id: Order ID to find

    Returns:
        Order dict or None if not found
    """
    orders = await api_client.get_customer_orders(str(user_id))
    return next((o for o in orders if o["id"] == order_id), None)


def build_confirmation_text(data: dict, user_id: int) -> str:
    """
    Build order confirmation text.

    Args:
        data: Order data from FSM state
        user_id: Telegram user ID for localization

    Returns:
        Formatted confirmation text
    """
    markers = data.get("available_markers", [])
    selected_markers = data.get("selected_markers", [])
    marker_names = [m["name"] for m in markers if m["id"] in selected_markers]

    description = data["description"]
    if len(description) > 100:
        description = description[:100] + "..."

    # Get payment method name from available payment methods
    payment_methods = data.get("available_payment_methods", [])
    payment_method_id = data.get("payment_method")
    payment_name = get_text("payment_not_specified", user_id)

    if payment_method_id:
        for pm in payment_methods:
            if pm["id"] == payment_method_id:
                payment_name = pm["name"]
                break

    return get_text(
        "order_create_confirm",
        user_id,
        title=data["title"],
        description=description,
        cost=data["cost"],
        markers=", ".join(marker_names) if marker_names else "-",
        payment=payment_name,
    )


def build_order_detail_text(order: dict, user_id: int) -> str:
    """
    Build order detail text.

    Args:
        order: Order data dict
        user_id: Telegram user ID for localization

    Returns:
        Formatted order detail text
    """
    from locales import get_status_text

    marker_names = [m["name"] for m in order.get("markers", [])]

    description = order["description"]
    if len(description) > 200:
        description = description[:200] + "..."

    return get_text(
        "order_details",
        user_id,
        id=order["id"][:8],
        title=order["title"],
        description=description,
        cost=order["cost"],
        status=get_status_text(order["status"], user_id),
        markers=", ".join(marker_names) if marker_names else "-",
        created_at=order["createdAt"][:10],
    )


__all__ = [
    "build_confirmation_text",
    "build_order_detail_text",
    "check_order_limit",
    "fetch_markers",
    "fetch_payment_methods",
    "get_order_by_id",
]
