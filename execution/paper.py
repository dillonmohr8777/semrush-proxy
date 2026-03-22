"""
Paper trading executor.
Simulates order fills using current market price.
No real API calls for orders — used for testing and validation.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

from strategies.base import Signal, StrategyResult
from core.portfolio import Portfolio
from config.settings import RiskConfig

logger = logging.getLogger(__name__)


class PaperExecutor:
    """
    Simulated order execution. Fills immediately at the signal price
    (or slightly worse for realism: adds 0.05% slippage + 0.6% fee).
    """
    SLIPPAGE = 0.0005   # 0.05%
    FEE_RATE = 0.006    # 0.6% Coinbase taker fee (worst case)

    def __init__(self, portfolio: Portfolio):
        self.portfolio  = portfolio
        self.fill_log: list = []

    def execute(self, result: StrategyResult,
                live_prices: Dict[str, float] = None) -> Optional[Dict]:
        """
        Attempt to execute the strategy signal.
        Returns fill dict on success, None if blocked.
        """
        price = (live_prices or {}).get(result.product_id, result.price)

        if result.signal == Signal.HOLD:
            return None

        # ── BUY ─────────────────────────────────────────────────────────────
        if result.signal == Signal.BUY:
            allowed, reason = self.portfolio.can_trade(
                result.product_id, result.confidence
            )
            if not allowed:
                logger.debug(f"Paper BUY blocked: {reason}")
                return None

            # Get ATR from meta if available, else estimate
            atr_val = result.meta.get("atr", price * 0.02)
            size_usd = self.portfolio.size_position(
                price, atr_val, result.confidence
            )

            fill_price = price * (1 + self.SLIPPAGE)
            fee        = size_usd * self.FEE_RATE
            quantity   = (size_usd - fee) / fill_price

            order_id = f"paper_{uuid.uuid4().hex[:8]}"

            pos = self.portfolio.open_position(
                product_id  = result.product_id,
                side        = "BUY",
                entry_price = fill_price,
                quantity    = quantity,
                size_usd    = size_usd,
                stop_loss   = result.stop_loss,
                take_profit = result.take_profit,
                order_id    = order_id,
            )

            fill = {
                "order_id":   order_id,
                "product_id": result.product_id,
                "side":       "BUY",
                "price":      round(fill_price, 2),
                "quantity":   round(quantity, 6),
                "size_usd":   round(size_usd, 2),
                "fee":        round(fee, 2),
                "strategy":   result.strategy,
                "reason":     result.reason,
                "stop_loss":  result.stop_loss,
                "take_profit":result.take_profit,
                "timestamp":  datetime.now(timezone.utc).isoformat(),
                "mode":       "paper",
            }
            self.fill_log.append(fill)
            logger.info(f"[PAPER] BUY {result.product_id} @ {fill_price:.2f} "
                        f"qty={quantity:.6f} size=${size_usd:.2f} fee=${fee:.2f}")
            return fill

        # ── SELL (close existing long position) ──────────────────────────────
        if result.signal == Signal.SELL:
            pos = self.portfolio.positions.get(result.product_id)
            if not pos:
                logger.debug(f"Paper SELL: no open position for {result.product_id}")
                return None

            fill_price = price * (1 - self.SLIPPAGE)
            fee        = pos.size_usd * self.FEE_RATE
            pnl        = self.portfolio.close_position(
                result.product_id, fill_price, reason=result.reason
            )

            fill = {
                "order_id":   f"paper_{uuid.uuid4().hex[:8]}",
                "product_id": result.product_id,
                "side":       "SELL",
                "price":      round(fill_price, 2),
                "quantity":   round(pos.quantity, 6),
                "size_usd":   round(pos.size_usd, 2),
                "fee":        round(fee, 2),
                "pnl":        round(pnl, 2),
                "strategy":   result.strategy,
                "reason":     result.reason,
                "timestamp":  datetime.now(timezone.utc).isoformat(),
                "mode":       "paper",
            }
            self.fill_log.append(fill)
            logger.info(f"[PAPER] SELL {result.product_id} @ {fill_price:.2f} "
                        f"P&L={pnl:+.2f}")
            return fill

        return None

    def check_and_exit(self, product_id: str, current_price: float) -> Optional[Dict]:
        """Check stop/take-profit for open position and exit if triggered."""
        reason = self.portfolio.check_exits(product_id, current_price)
        if not reason:
            return None

        pos = self.portfolio.positions.get(product_id)
        if not pos:
            return None

        fill_price = current_price * (1 - self.SLIPPAGE) \
                     if pos.side == "BUY" else current_price * (1 + self.SLIPPAGE)
        pnl = self.portfolio.close_position(product_id, fill_price, reason=reason)

        fill = {
            "order_id":   f"paper_{uuid.uuid4().hex[:8]}",
            "product_id": product_id,
            "side":       "SELL",
            "price":      round(fill_price, 2),
            "pnl":        round(pnl, 2),
            "reason":     reason,
            "timestamp":  datetime.now(timezone.utc).isoformat(),
            "mode":       "paper",
        }
        self.fill_log.append(fill)
        logger.info(f"[PAPER] AUTO-EXIT {product_id} @ {fill_price:.2f} "
                    f"({reason}) P&L={pnl:+.2f}")
        return fill
