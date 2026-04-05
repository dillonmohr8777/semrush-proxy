"""
Position tracking for paper trading.
"""

from datetime import datetime
from utils.types import PaperPosition, PaperTrade, OrderSide, Candle
from utils.logger import get_logger

logger = get_logger("positions")


class PositionManager:
    """Tracks open paper positions and closed trade history."""

    def __init__(self) -> None:
        self.open_positions: dict[str, PaperPosition] = {}
        self.trade_history: list[PaperTrade] = []

    def has_position(self, asset: str) -> bool:
        return asset in self.open_positions

    def open_position(self, position: PaperPosition) -> None:
        if asset := position.asset:
            self.open_positions[asset] = position
            logger.info(
                "Opened %s position: %s @ %.2f (size=%.6f, SL=%.2f, TP=%.2f)",
                position.side.value, asset, position.entry_price,
                position.size, position.stop_loss, position.target,
            )

    def close_position(self, asset: str, exit_price: float, reason: str) -> PaperTrade | None:
        pos = self.open_positions.pop(asset, None)
        if pos is None:
            return None

        if pos.side == OrderSide.BUY:
            pnl = (exit_price - pos.entry_price) * pos.size - pos.estimated_fee * 2
        else:
            pnl = (pos.entry_price - exit_price) * pos.size - pos.estimated_fee * 2

        trade = PaperTrade(
            asset=asset,
            side=pos.side,
            entry_price=pos.entry_price,
            exit_price=exit_price,
            size=pos.size,
            pnl=pnl,
            entry_time=pos.entry_time,
            exit_time=datetime.utcnow(),
            reason=reason,
        )
        self.trade_history.append(trade)

        logger.info(
            "Closed %s %s @ %.2f (entry=%.2f, PnL=%.2f, reason=%s)",
            pos.side.value, asset, exit_price,
            pos.entry_price, pnl, reason,
        )
        return trade

    def check_stop_and_target(self, asset: str, current_price: float) -> PaperTrade | None:
        """Check if current price hits stop loss or target for an open position."""
        pos = self.open_positions.get(asset)
        if pos is None:
            return None

        if pos.side == OrderSide.BUY:
            if current_price <= pos.stop_loss:
                return self.close_position(asset, pos.stop_loss, "stop_loss")
            if current_price >= pos.target:
                return self.close_position(asset, pos.target, "target")
        else:  # SELL / SHORT
            if current_price >= pos.stop_loss:
                return self.close_position(asset, pos.stop_loss, "stop_loss")
            if current_price <= pos.target:
                return self.close_position(asset, pos.target, "target")

        return None

    def total_realized_pnl(self) -> float:
        return sum(t.pnl for t in self.trade_history)

    def today_realized_pnl(self) -> float:
        today = datetime.utcnow().date()
        return sum(
            t.pnl for t in self.trade_history
            if t.exit_time.date() == today
        )

    def unrealized_pnl(self, prices: dict[str, float]) -> float:
        total = 0.0
        for asset, pos in self.open_positions.items():
            price = prices.get(asset, pos.entry_price)
            if pos.side == OrderSide.BUY:
                total += (price - pos.entry_price) * pos.size
            else:
                total += (pos.entry_price - price) * pos.size
        return total
