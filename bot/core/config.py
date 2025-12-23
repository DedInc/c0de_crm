"""Bot configuration settings."""

import os

from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/crm_bot")


def _build_crm_url(host: str) -> str:
    """
    Build the full CRM URL from a host specification.

    Supports various formats:
    - Just domain: "crm.example.com" -> "https://crm.example.com"
    - Domain with port: "localhost:5173" -> "http://localhost:5173"
    - Full URL: "https://crm.example.com" -> "https://crm.example.com"

    Automatically uses HTTPS for domains, HTTP for localhost/IP with port.
    """
    host = host.strip()

    # Already has protocol
    if host.startswith("http://") or host.startswith("https://"):
        return host.rstrip("/")

    # Check if it's localhost or has a port (development)
    is_localhost = host.startswith("localhost") or host.startswith("127.0.0.1")
    has_port = ":" in host

    if is_localhost or has_port:
        # Development: use HTTP
        return f"http://{host}"
    else:
        # Production domain: use HTTPS
        return f"https://{host}"


# CRM host - just specify the domain or host:port
# Examples:
#   - Production: "crm.example.com" (automatically uses HTTPS)
#   - Development: "localhost:5173" (automatically uses HTTP)
#   - Full URL also works: "https://crm.example.com"
CRM_HOST = os.getenv("CRM_HOST", "localhost:5173")

# Derived URLs (no need to configure these separately)
CRM_BASE_URL = _build_crm_url(CRM_HOST)
CRM_API_URL = f"{CRM_BASE_URL}/api/trpc"

# Webhook server configuration (for receiving messages from CRM)
WEBHOOK_HOST = os.getenv("WEBHOOK_HOST", "0.0.0.0")
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", "8081"))

# Supported languages
SUPPORTED_LANGUAGES = ["en", "ru"]
DEFAULT_LANGUAGE = "en"
