"""CRM API client for communicating with the backend."""

from typing import Any, cast

import aiohttp

from .config import CRM_API_URL, INTERNAL_API_KEY


class CRMApiClient:
    """Client for communicating with the CRM API."""

    def __init__(self) -> None:
        self.base_url = CRM_API_URL
        self._session: aiohttp.ClientSession | None = None

    def _headers(self) -> dict[str, str]:
        return {"x-internal-api-key": INTERNAL_API_KEY}

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(headers=self._headers())
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    async def _call(
        self, procedure: str, input_data: dict[str, Any] | None = None, method: str = "query"
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
    async def get_markers(self) -> list[dict[str, Any]]:
        """Get all available stack markers."""
        return cast("list[dict[str, Any]]", await self._call("bot.getMarkers"))

    async def get_payment_methods(self) -> list[dict[str, Any]]:
        """Get all active payment methods."""
        return cast("list[dict[str, Any]]", await self._call("bot.getPaymentMethods"))

    async def create_order(
        self,
        title: str,
        description: str,
        cost: float,
        customer_telegram_id: str,
        customer_name: str | None = None,
        marker_ids: list[str] | None = None,
        payment_method: str | None = None,
    ) -> dict[str, Any]:
        """Create a new order."""
        return cast(
            "dict[str, Any]",
            await self._call(
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
            ),
        )

    async def get_customer_orders(self, customer_telegram_id: str) -> list[dict[str, Any]]:
        """Get all orders for a customer."""
        return cast(
            "list[dict[str, Any]]",
            await self._call("bot.getCustomerOrders", {"customerTelegramId": customer_telegram_id}),
        )

    async def send_customer_message(
        self,
        order_id: str,
        customer_telegram_id: str,
        message: str,
        image_urls: list[str] | None = None,
        file_urls: list[dict[str, str]] | None = None,
    ) -> dict[str, Any]:
        """Send a message from customer to CRM."""
        data: dict[str, Any] = {
            "orderId": order_id,
            "customerTelegramId": customer_telegram_id,
            "message": message,
        }
        if image_urls and len(image_urls) > 0:
            data["imageUrls"] = image_urls
        if file_urls and len(file_urls) > 0:
            data["fileUrls"] = file_urls
        return cast(
            "dict[str, Any]",
            await self._call(
                "bot.sendCustomerMessage",
                data,
                method="mutation",
            ),
        )

    async def get_programmers_for_notification(self) -> list[dict[str, Any]]:
        """Get programmers with telegram IDs for notifications."""
        return cast("list[dict[str, Any]]", await self._call("bot.getProgrammersForNotification"))

    async def delete_order(self, order_id: str, customer_telegram_id: str) -> dict[str, Any]:
        """Delete an order (only pending or rejected orders can be deleted)."""
        return cast(
            "dict[str, Any]",
            await self._call(
                "bot.deleteOrder",
                {"orderId": order_id, "customerTelegramId": customer_telegram_id},
                method="mutation",
            ),
        )

    async def upload_file(
        self,
        file_bytes: bytes,
        filename: str,
        order_id: str,
        content_type: str = "image/jpeg",
    ) -> str | None:
        """Upload a file to R2 via the CRM upload endpoint.

        Returns the r2: key reference or None if upload fails.
        """
        session = await self._get_session()
        url = self.base_url.replace("/api/trpc", "/api/upload")

        try:
            import aiohttp

            form = aiohttp.FormData()
            form.add_field(
                "file",
                file_bytes,
                filename=filename,
                content_type=content_type,
            )
            form.add_field("orderId", order_id)

            async with session.post(url, data=form) as response:
                if response.status == 503:
                    # R2 not configured — fall back to tg-file
                    return None
                data = await response.json()
                if response.status != 200:
                    raise Exception(data.get("error", "Upload failed"))
                return data.get("key")
        except Exception as e:
            import logging

            logging.getLogger(__name__).error(f"File upload failed: {e}")
            return None


# Global client instance
api_client = CRMApiClient()
