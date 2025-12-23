"""CRM API client for communicating with the backend."""

from typing import Any

import aiohttp

from .config import CRM_API_URL


class CRMApiClient:
    """Client for communicating with the CRM API."""

    def __init__(self):
        self.base_url = CRM_API_URL
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def _call(
        self, procedure: str, input_data: dict | None = None, method: str = "query"
    ) -> Any:
        """Call a tRPC procedure."""
        session = await self._get_session()

        url = f"{self.base_url}/{procedure}"

        try:
            if method == "query":
                # For queries, send input as query parameter
                params = {}
                if input_data:
                    import json

                    params["input"] = json.dumps(input_data)
                async with session.get(url, params=params) as response:
                    data = await response.json()
                    if "error" in data:
                        raise Exception(data["error"].get("message", "Unknown error"))
                    return data.get("result", {}).get("data")
            else:
                # For mutations, send input as JSON body
                async with session.post(url, json=input_data or {}) as response:
                    data = await response.json()
                    if "error" in data:
                        raise Exception(data["error"].get("message", "Unknown error"))
                    return data.get("result", {}).get("data")
        except aiohttp.ClientError as e:
            raise Exception(f"API request failed: {e!s}")

    # Bot API methods
    async def get_markers(self) -> list[dict]:
        """Get all available stack markers."""
        return await self._call("bot.getMarkers")

    async def get_payment_methods(self) -> list[dict]:
        """Get all active payment methods."""
        return await self._call("bot.getPaymentMethods")

    async def create_order(
        self,
        title: str,
        description: str,
        cost: float,
        customer_telegram_id: str,
        customer_name: str | None = None,
        marker_ids: list[str] | None = None,
        payment_method: str | None = None,
    ) -> dict:
        """Create a new order."""
        return await self._call(
            "bot.createOrder",
            {
                "title": title,
                "description": description,
                "cost": cost,
                "customerTelegramId": customer_telegram_id,
                "customerName": customer_name,
                "markerIds": marker_ids or [],
                "paymentMethod": payment_method,
            },
            method="mutation",
        )

    async def get_customer_orders(self, customer_telegram_id: str) -> list[dict]:
        """Get all orders for a customer."""
        return await self._call(
            "bot.getCustomerOrders", {"customerTelegramId": customer_telegram_id}
        )

    async def send_customer_message(
        self,
        order_id: str,
        customer_telegram_id: str,
        message: str,
        image_urls: list[str] | None = None,
    ) -> dict:
        """Send a message from customer to CRM."""
        data = {
            "orderId": order_id,
            "customerTelegramId": customer_telegram_id,
            "message": message,
        }
        if image_urls and len(image_urls) > 0:
            data["imageUrls"] = image_urls
        return await self._call(
            "bot.sendCustomerMessage",
            data,
            method="mutation",
        )

    async def get_programmers_for_notification(self) -> list[dict]:
        """Get programmers with telegram IDs for notifications."""
        return await self._call("bot.getProgrammersForNotification")

    async def delete_order(self, order_id: str, customer_telegram_id: str) -> dict:
        """Delete an order (only pending or rejected orders can be deleted)."""
        return await self._call(
            "bot.deleteOrder",
            {"orderId": order_id, "customerTelegramId": customer_telegram_id},
            method="mutation",
        )


# Global client instance
api_client = CRMApiClient()
