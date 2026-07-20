"""Health check handler."""

from aiohttp import web


async def handle_health(_request: web.Request) -> web.Response:
    """Health check endpoint."""
    return web.json_response({"status": "ok"})
