"""Direct R2/S3 storage client for file uploads."""

import logging
import os
import uuid
from importlib import import_module
from typing import Any

logger = logging.getLogger(__name__)

# R2 configuration from environment
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "")

# Reusable session singleton — avoids creating a new TLS session per upload
_session: Any = None


def _get_session() -> Any:
    global _session
    if _session is None:
        aioboto3 = import_module("aioboto3")
        _session = aioboto3.Session()
    return _session


def is_r2_configured() -> bool:
    """Check if R2 credentials are configured for direct upload."""
    return bool(R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME)


async def upload_to_r2(
    file_bytes: bytes,
    order_id: str,
    ext: str = "jpg",
    content_type: str = "image/jpeg",
) -> str | None:
    """Upload file directly to R2 via S3-compatible API.

    Returns the r2:key reference or None if upload fails.
    """
    if not is_r2_configured():
        return None

    try:
        session = _get_session()
        endpoint_url = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

        file_id = uuid.uuid4().hex[:12]
        key = f"chat/{order_id}/{file_id}.{ext}"

        async with session.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            region_name="auto",
        ) as s3:
            await s3.put_object(
                Bucket=R2_BUCKET_NAME,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )

        return f"r2:{key}"
    except ImportError:
        logger.warning("aioboto3 not installed, cannot upload directly to R2")
        return None
    except Exception as e:
        logger.error(f"Direct R2 upload failed: {e}")
        return None
