"""Webhook server setup and startup."""

import logging

from aiohttp import web

from .handlers.customer import handle_send_message
from .handlers.health import handle_health
from .handlers.notifications import handle_notify
from .handlers.staff import handle_notify_staff
from .handlers.verification import handle_verify_telegram
from .utils import set_bot

logger = logging.getLogger(__name__)


def create_app() -> web.Application:
    """Create the webhook server application."""
    app = web.Application()
    app.router.add_post("/send-message", handle_send_message)
    app.router.add_post("/notify", handle_notify)
    app.router.add_post("/verify-telegram", handle_verify_telegram)
    app.router.add_post("/notify-staff", handle_notify_staff)
    app.router.add_get("/health", handle_health)
    return app


async def start_webhook_server(host: str = "0.0.0.0", port: int = 8081):
    """Start the webhook server."""
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    logger.info(f"Webhook server started on {host}:{port}")
    return runner


# Re-export set_bot for convenience
__all__ = ["create_app", "set_bot", "start_webhook_server"]
