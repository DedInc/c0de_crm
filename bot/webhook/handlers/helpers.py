"""Helper utilities for webhook handlers."""

import base64
import logging

logger = logging.getLogger(__name__)


def parse_base64_image(data_url: str) -> tuple[bytes, str] | None:
    """Parse a base64 data URL and return (bytes, filename) or None if invalid."""
    try:
        # Check if it's a data URL
        if not data_url.startswith("data:"):
            return None

        # Parse the data URL: data:image/png;base64,xxxxx
        header, encoded = data_url.split(",", 1)

        # Extract mime type
        mime_part = header.split(";")[0]  # data:image/png
        mime_type = mime_part.split(":")[1] if ":" in mime_part else "image/png"

        # Determine file extension
        ext_map = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/jpg": "jpg",
            "image/gif": "gif",
            "image/webp": "webp",
        }
        ext = ext_map.get(mime_type, "png")

        # Decode base64
        image_bytes = base64.b64decode(encoded)

        return image_bytes, f"image.{ext}"
    except Exception as e:
        logger.error(f"Failed to parse base64 image: {e}")
        return None
