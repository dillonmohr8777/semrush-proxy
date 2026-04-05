"""
Real trading engine — places actual orders on Coinbase.

SAFETY:
  This module is completely disabled unless ENABLE_REAL_TRADING=true
  AND PAPER_TRADING=false in the environment configuration.

  Every order goes through:
    1. Risk manager validation
    2. Order preview (Coinbase preview endpoint)
    3. Confirmation check
    4. Order placement with full logging (no secrets)
"""

import uuid

from clients.advanced_trade_client import AdvancedTradeClient
from config import BotConfig
from execution.order_preview import preview_limit_order
from strategy.risk import RiskManager
from utils.types import Signal, Bias, OrderPreview, OrderSide
from utils.logger import get_logger

logger = get_logger("real_engine")


class RealTradingDisabledError(Exception):
    pass


class RealEngine:
    def __init__(self, client: AdvancedTradeClient, config: BotConfig) -> None:
        self._client = client
        self._config = config
        self.risk_manager = RiskManager(config.risk)

    def _assert_enabled(self) -> None:
        if not self._config.is_real_trading_active:
            raise RealTradingDisabledError(
                "Real trading is DISABLED. Set ENABLE_REAL_TRADING=true and "
                "PAPER_TRADING=false to activate."
            )

    def execute_signal(self, signal: Signal, account_equity: float) -> dict | None:
        """
        Full order workflow:
          1. Validate signal through risk manager
          2. Preview the order via Coinbase API
          3. Place the order
        """
        self._assert_enabled()

        if signal.bias == Bias.NO_TRADE:
            return None

        # Step 1: Risk check and position sizing
        preview = self.risk_manager.compute_position_size(signal, account_equity)
        if preview is None:
            logger.info("%s: risk manager rejected the trade", signal.asset)
            return None

        # Step 2: Preview order through Coinbase
        logger.info(
            "REAL ORDER PREVIEW: %s %s %.8f @ %.2f",
            preview.side.value, preview.asset, preview.size, preview.price,
        )
        preview_result = preview_limit_order(self._client, preview)
        if preview_result is None:
            logger.error("%s: order preview failed, aborting", signal.asset)
            return None

        # Step 3: Place the order
        return self._place_order(preview)

    def _place_order(self, preview: OrderPreview) -> dict | None:
        """Place a limit GTC order on Coinbase."""
        self._assert_enabled()

        side = "BUY" if preview.side == OrderSide.BUY else "SELL"
        client_order_id = str(uuid.uuid4())

        order_body = {
            "client_order_id": client_order_id,
            "product_id": preview.asset,
            "side": side,
            "order_configuration": {
                "limit_limit_gtc": {
                    "base_size": str(preview.size),
                    "limit_price": str(preview.price),
                }
            },
        }

        logger.info(
            "PLACING REAL ORDER: %s %s %.8f %s @ %.2f (id=%s)",
            side, preview.size, preview.size, preview.asset,
            preview.price, client_order_id,
        )

        try:
            result = self._client.create_order(order_body)
            order_id = result.get("success_response", {}).get("order_id", "unknown")
            logger.info(
                "ORDER PLACED: %s %s — order_id=%s",
                side, preview.asset, order_id,
            )
            return result
        except Exception as e:
            logger.error(
                "ORDER FAILED: %s %s — %s", side, preview.asset, e,
            )
            return None
