"""
Risk management — position sizing, daily loss limits, cooldowns.
"""

import time
from datetime import datetime

from config import RiskConfig
from utils.types import Signal, Bias, OrderSide, OrderPreview
from utils.logger import get_logger

logger = get_logger("risk")

# Estimated taker fee on Coinbase Advanced Trade
ESTIMATED_FEE_RATE = 0.006  # 0.6% (conservative estimate)


class RiskManager:
    def __init__(self, risk_config: RiskConfig) -> None:
        self._config = risk_config
        self._last_stop_loss_time: float = 0.0
        self._daily_pnl: float = 0.0
        self._daily_pnl_date: str = ""

    def record_stop_loss_hit(self) -> None:
        self._last_stop_loss_time = time.time()
        logger.info(
            "Stop loss hit — cooldown active for %d seconds",
            self._config.cooldown_after_stop_loss_seconds,
        )

    def is_in_cooldown(self) -> bool:
        if self._last_stop_loss_time == 0:
            return False
        elapsed = time.time() - self._last_stop_loss_time
        return elapsed < self._config.cooldown_after_stop_loss_seconds

    def update_daily_pnl(self, pnl: float) -> None:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        if self._daily_pnl_date != today:
            self._daily_pnl = 0.0
            self._daily_pnl_date = today
        self._daily_pnl += pnl

    def is_daily_loss_limit_hit(self, account_equity: float) -> bool:
        if account_equity <= 0:
            return True
        limit = account_equity * (self._config.daily_loss_limit_pct / 100.0)
        return self._daily_pnl <= -limit

    def compute_position_size(
        self,
        signal: Signal,
        account_equity: float,
    ) -> OrderPreview | None:
        """
        Compute position size based on risk percentage and signal levels.
        Returns None if the trade fails risk checks.
        """
        if signal.bias == Bias.NO_TRADE:
            return None

        if signal.confidence < self._config.confidence_threshold:
            logger.info(
                "%s: confidence %.1f below threshold %.1f",
                signal.asset, signal.confidence, self._config.confidence_threshold,
            )
            return None

        if signal.risk_reward < self._config.min_risk_reward:
            logger.info(
                "%s: R:R %.2f below minimum %.2f",
                signal.asset, signal.risk_reward, self._config.min_risk_reward,
            )
            return None

        if self.is_in_cooldown():
            logger.info("%s: in cooldown after stop loss", signal.asset)
            return None

        if self.is_daily_loss_limit_hit(account_equity):
            logger.warning("%s: daily loss limit reached", signal.asset)
            return None

        # Position sizing: risk X% of equity
        risk_amount = account_equity * (self._config.risk_per_trade_pct / 100.0)
        risk_per_unit = abs(signal.entry - signal.stop_loss)

        if risk_per_unit <= 0:
            return None

        size = risk_amount / risk_per_unit
        notional = size * signal.entry

        # Cap notional
        if notional > self._config.max_notional_per_trade:
            notional = self._config.max_notional_per_trade
            size = notional / signal.entry

        # Cap to available equity minus fees
        max_notional_from_equity = account_equity * 0.95  # leave 5% buffer
        if notional > max_notional_from_equity:
            notional = max_notional_from_equity
            size = notional / signal.entry

        estimated_fee = notional * ESTIMATED_FEE_RATE

        side = OrderSide.BUY if signal.bias == Bias.LONG else OrderSide.SELL

        preview = OrderPreview(
            asset=signal.asset,
            side=side,
            size=round(size, 8),
            price=signal.entry,
            notional=round(notional, 2),
            estimated_fee=round(estimated_fee, 2),
            stop_loss=signal.stop_loss,
            target=signal.target,
        )

        logger.info(
            "%s preview: %s %.8f @ %.2f (notional=%.2f, fee=~%.2f)",
            signal.asset, side.value, preview.size, preview.price,
            preview.notional, preview.estimated_fee,
        )

        return preview
