"""
Order preview layer — calls the Coinbase preview endpoint before any
real order would be placed. This is a safety gate.
"""

import uuid

from clients.advanced_trade_client import AdvancedTradeClient
from utils.types import OrderPreview, OrderSide
from utils.logger import get_logger

logger = get_logger("order_preview")


def preview_limit_order(
    client: AdvancedTradeClient,
    preview: OrderPreview,
) -> dict | None:
    """
    Call the Coinbase order preview endpoint.
    Returns the preview response or None on failure.
    """
    side = "BUY" if preview.side == OrderSide.BUY else "SELL"

    order_body = {
        "product_id": preview.asset,
        "side": side,
        "order_configuration": {
            "limit_limit_gtc": {
                "base_size": str(preview.size),
                "limit_price": str(preview.price),
            }
        },
    }

    try:
        result = client.preview_order(order_body)
        logger.info(
            "Order preview for %s %s %s: %s",
            side, preview.size, preview.asset, result,
        )
        return result
    except Exception as e:
        logger.error("Order preview failed for %s: %s", preview.asset, e)
        return None
