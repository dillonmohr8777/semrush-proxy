"""
Paper trading engine — simulates trade execution without touching real funds.

Tracks a virtual balance, opens/closes positions, and records PnL.
"""

from datetime import datetime

from config import BotConfig
from portfolio.positions import PositionManager
from strategy.risk import RiskManager
from utils.types import (
    Signal, Bias, OrderPreview, OrderSide,
    PaperPosition, PaperTrade,
)
from utils.logger import get_logger

logger = get_logger("paper_engine")


class PaperEngine:
    def __init__(self, config: BotConfig) -> None:
        self._config = config
        self.equity = config.trading.paper_starting_balance
        self.positions = PositionManager()
        self.risk_manager = RiskManager(config.risk)

    def manage_open_positions(self, prices: dict[str, float]) -> None:
        """Check all open positions against current prices for SL/TP hits."""
        for asset in list(self.positions.open_positions.keys()):
            price = prices.get(asset)
            if price is None:
                continue

            trade = self.positions.check_stop_and_target(asset, price)
            if trade is not None:
                self.equity += trade.pnl
                self.risk_manager.update_daily_pnl(trade.pnl)

                if trade.reason == "stop_loss":
                    self.risk_manager.record_stop_loss_hit()

                logger.info(
                    "PAPER CLOSE %s: PnL=%.2f, equity=%.2f, reason=%s",
                    asset, trade.pnl, self.equity, trade.reason,
                )

    def execute_signal(self, signal: Signal) -> PaperPosition | None:
        """
        Evaluate a signal and open a paper position if risk checks pass.
        """
        if signal.bias == Bias.NO_TRADE:
            return None

        if self.positions.has_position(signal.asset):
            logger.debug("%s: already have open position, skipping", signal.asset)
            return None

        preview = self.risk_manager.compute_position_size(signal, self.equity)
        if preview is None:
            return None

        # Check we have enough paper equity
        total_cost = preview.notional + preview.estimated_fee
        if total_cost > self.equity:
            logger.info(
                "%s: insufficient paper equity (need %.2f, have %.2f)",
                signal.asset, total_cost, self.equity,
            )
            return None

        position = PaperPosition(
            asset=signal.asset,
            side=preview.side,
            entry_price=preview.price,
            size=preview.size,
            stop_loss=preview.stop_loss,
            target=preview.target,
            entry_time=datetime.utcnow(),
            notional=preview.notional,
            estimated_fee=preview.estimated_fee,
        )

        self.positions.open_position(position)

        # Deduct estimated entry fee from equity
        self.equity -= preview.estimated_fee

        logger.info(
            "PAPER ENTRY %s %s @ %.2f (size=%.8f, notional=%.2f, fee=%.2f)",
            preview.side.value, signal.asset, preview.price,
            preview.size, preview.notional, preview.estimated_fee,
        )

        return position

    def get_equity(self) -> float:
        return self.equity

    def get_unrealized_pnl(self, prices: dict[str, float]) -> float:
        return self.positions.unrealized_pnl(prices)

    def get_summary(self, prices: dict[str, float]) -> dict:
        unrealized = self.get_unrealized_pnl(prices)
        return {
            "equity": round(self.equity, 2),
            "unrealized_pnl": round(unrealized, 2),
            "total_equity": round(self.equity + unrealized, 2),
            "realized_pnl": round(self.positions.total_realized_pnl(), 2),
            "today_pnl": round(self.positions.today_realized_pnl(), 2),
            "open_positions": len(self.positions.open_positions),
            "total_trades": len(self.positions.trade_history),
        }
