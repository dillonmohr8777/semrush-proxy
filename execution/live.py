"""
Live trading executor.
Places real orders via Coinbase Advanced Trade API.
Includes order confirmation, fill polling, and timeout cancellation.
"""
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

from core.exchange import CoinbaseClient, OrderSide
from strategies.base import Signal, StrategyResult
from core.portfolio import Portfolio
from config.settings import ORDER_TIMEOUT_SEC

logger = logging.getLogger(__name__)


class LiveExecutor:
    """
    Real order execution via Coinbase API.
    Uses market orders for immediate execution.
    Polls for fill confirmation before recording the position.
    """
    SLIPPAGE_EST = 0.0005   # estimated slippage for position records
    FEE_RATE     = 0.006    # Coinbase taker fee estimate

    def __init__(self, client: CoinbaseClient, portfolio: Portfolio):
        self.client    = client
        self.portfolio = portfolio

    def execute(self, result: StrategyResult,
                live_prices: Dict[str, float] = None) -> Optional[Dict]:
        price = (live_prices or {}).get(result.product_id, result.price)

        if result.signal == Signal.HOLD:
            return None

        # ── BUY ─────────────────────────────────────────────────────────────
        if result.signal == Signal.BUY:
            allowed, reason = self.portfolio.can_trade(
                result.product_id, result.confidence
            )
            if not allowed:
                logger.warning(f"Live BUY blocked: {reason}")
                return None

            atr_val  = result.meta.get("atr", price * 0.02)
            size_usd = self.portfolio.size_position(
                price, atr_val, result.confidence
            )

            logger.info(f"[LIVE] Placing MARKET BUY {result.product_id} "
                        f"${size_usd:.2f} (confidence={result.confidence:.3f})")
            try:
                resp = self.client.place_market_order(
                    result.product_id, OrderSide.BUY, quote_size=size_usd
                )
            except Exception as e:
                logger.error(f"Order placement failed: {e}")
                return None

            order_id  = resp.get("success_response", {}).get("order_id", "")
            fill_info = self._wait_for_fill(order_id)
            if not fill_info:
                logger.warning(f"Order {order_id} not filled, cancelling")
                self._cancel(order_id)
                return None

            fill_price = fill_info["avg_price"]
            quantity   = fill_info["filled_size"]
            fee        = fill_info.get("total_fees", size_usd * self.FEE_RATE)

            self.portfolio.open_position(
                product_id  = result.product_id,
                side        = "BUY",
                entry_price = fill_price,
                quantity    = float(quantity),
                size_usd    = size_usd,
                stop_loss   = result.stop_loss,
                take_profit = result.take_profit,
                order_id    = order_id,
            )

            fill = {
                "order_id":    order_id,
                "product_id":  result.product_id,
                "side":        "BUY",
                "price":       round(fill_price, 2),
                "quantity":    round(float(quantity), 6),
                "size_usd":    round(size_usd, 2),
                "fee":         round(float(fee), 2),
                "strategy":    result.strategy,
                "reason":      result.reason,
                "stop_loss":   result.stop_loss,
                "take_profit": result.take_profit,
                "timestamp":   datetime.now(timezone.utc).isoformat(),
                "mode":        "live",
            }
            logger.info(f"[LIVE] BUY FILLED {result.product_id} @ {fill_price:.2f} "
                        f"qty={quantity} fee=${fee}")
            return fill

        # ── SELL (close position) ────────────────────────────────────────────
        if result.signal == Signal.SELL:
            pos = self.portfolio.positions.get(result.product_id)
            if not pos:
                logger.debug(f"Live SELL: no open position for {result.product_id}")
                return None

            base_currency = result.product_id.split("-")[0]
            try:
                resp = self.client.place_market_order(
                    result.product_id, OrderSide.SELL, base_size=pos.quantity
                )
            except Exception as e:
                logger.error(f"Sell order failed: {e}")
                return None

            order_id  = resp.get("success_response", {}).get("order_id", "")
            fill_info = self._wait_for_fill(order_id)
            fill_price = fill_info["avg_price"] if fill_info else price
            fee        = fill_info.get("total_fees", pos.size_usd * self.FEE_RATE) \
                         if fill_info else 0.0

            pnl = self.portfolio.close_position(
                result.product_id, fill_price, reason=result.reason
            )

            fill = {
                "order_id":   order_id,
                "product_id": result.product_id,
                "side":       "SELL",
                "price":      round(fill_price, 2),
                "quantity":   round(pos.quantity, 6),
                "size_usd":   round(pos.size_usd, 2),
                "fee":        round(float(fee), 2),
                "pnl":        round(pnl, 2),
                "strategy":   result.strategy,
                "reason":     result.reason,
                "timestamp":  datetime.now(timezone.utc).isoformat(),
                "mode":       "live",
            }
            logger.info(f"[LIVE] SELL FILLED {result.product_id} @ {fill_price:.2f} "
                        f"P&L={pnl:+.2f}")
            return fill

        return None

    def check_and_exit(self, product_id: str,
                        current_price: float) -> Optional[Dict]:
        """Trigger stop/take-profit as a real sell order."""
        reason = self.portfolio.check_exits(product_id, current_price)
        if not reason:
            return None

        pos = self.portfolio.positions.get(product_id)
        if not pos:
            return None

        logger.info(f"[LIVE] Triggering exit for {product_id}: {reason}")
        result = StrategyResult(
            signal     = Signal.SELL,
            confidence = 1.0,
            strategy   = "risk_engine",
            product_id = product_id,
            price      = current_price,
            reason     = reason,
        )
        return self.execute(result, {product_id: current_price})

    def _wait_for_fill(self, order_id: str,
                        timeout: int = ORDER_TIMEOUT_SEC) -> Optional[Dict]:
        """Poll until order is filled or timeout."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                order = self.client.get_order(order_id)
                o = order.get("order", {})
                status = o.get("status")
                if status == "FILLED":
                    return {
                        "avg_price":   float(o.get("average_filled_price", 0)),
                        "filled_size": float(o.get("filled_size", 0)),
                        "total_fees":  float(o.get("total_fees", 0)),
                    }
                if status in ("CANCELLED", "EXPIRED", "FAILED"):
                    logger.warning(f"Order {order_id} terminal status: {status}")
                    return None
            except Exception as e:
                logger.warning(f"Poll error for {order_id}: {e}")
            time.sleep(1)
        return None

    def _cancel(self, order_id: str):
        try:
            self.client.cancel_order(order_id)
            logger.info(f"Order {order_id} cancelled")
        except Exception as e:
            logger.error(f"Cancel failed for {order_id}: {e}")
