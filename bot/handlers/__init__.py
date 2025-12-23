from aiogram import Router

from .chat import router as chat_router
from .language import router as language_router
from .orders import router as orders_router
from .start import router as start_router


def setup_routers() -> Router:
    """Setup all routers."""
    router = Router()
    router.include_router(start_router)
    router.include_router(orders_router)
    router.include_router(language_router)
    router.include_router(chat_router)
    return router
