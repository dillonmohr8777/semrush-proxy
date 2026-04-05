"""
Paper trading execution engine.
Simulates order fills, tracks positions, calculates PnL.
Designed to mirror real execution interface for easy swap later.
"""
import uuid
from datetime import datetime
from typing import List, Optional, Dict
from utils.types import (
    Position, Signal, Side, Action, TradeLog, ExitReason, EquitySnapshot
)
from strategy.risk import RiskManager
from execution.trade_manager import TradeManager
from config import RiskConfig
from utils.logger import Logger


class PaperEngine:
    def __init__(self, risk_manager: RiskManager, trade_manager: TradeManager,
                 logger: Logger, fee_pct: float = 0.06):
        self.risk_mgr = risk_manager
        self.trade_mgr = trade_manager
        self.logger = logger
        self.fee_pct = fee_pct

        self.positions: List[Position] = []
        self.closed_trades: List[TradeLog] = []

        # Running stats
        self.total_fees = 0.0
        self.total_realized_pnl = 0.0
        self.winners: List[float] = []
        self.losers: List[float] = []

    def execute_signal(self, signal: Signal) -> Optional[Position]:
        """Open a paper position from a signal."""
        if signal.action == Action.NO_TRADE:
            return None

        side = signal.side
        if side is None:
            return None

        # Calculate entry fee
        entry_fee = signal.position_size_usd * (self.fee_pct / 100.0)

        position = Position(
            id=str(uuid.uuid4())[:8],
            symbol=signal.symbol,
            side=side,
            leverage=signal.leverage,
            entry_price=signal.entry_price,
            quantity=signal.position_size_qty,
            notional=signal.position_size_usd,
            margin_used=signal.position_size_usd / signal.leverage,
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
            liquidation_price=signal.liquidation_price,
            opened_at=datetime.utcnow(),
            highest_price=signal.entry_price,
            lowest_price=signal.entry_price,
            original_quantity=signal.position_size_qty,
            fees_paid=entry_fee,
            signal_confidence=signal.confidence,
            signal_reason=signal.reason,
        )

        # Deduct margin from cash
        self.risk_mgr.cash -= (position.margin_used + entry_fee)
        self.total_fees += entry_fee

        self.positions.append(position)

        self.logger.event(
            f"OPEN {side.value} {signal.symbol} | "
            f"Qty={position.quantity:.6f} @ ${signal.entry_price:.2f} | "
            f"Leverage={signal.leverage}x | Notional=${signal.position_size_usd:.2f} | "
            f"Stop=${signal.stop_loss:.2f} | TP=${signal.take_profit:.2f} | "
            f"Liq=${signal.liquidation_price:.2f} | R:R={signal.risk_reward:.2f} | "
            f"Confidence={signal.confidence:.2f}"
        )

        return position

    def update_positions(self, prices: Dict[str, float],
                         indicators: Dict[str, any]) -> List[TradeLog]:
        """
        Update all open positions with current prices.
        Returns list of closed trades this cycle.
        """
        closed_this_cycle = []
        positions_to_remove = []

        for pos in self.positions:
            price = prices.get(pos.symbol)
            if price is None:
                continue

            ind = indicators.get(pos.symbol)

            # Check for exit
            exit_reason, exit_price = self.trade_mgr.manage_position(pos, price, ind)

            if exit_reason:
                trade = self._close_position(pos, exit_price or price, exit_reason)
                closed_this_cycle.append(trade)
                positions_to_remove.append(pos)
                continue

            # Check partial TP
            if self.trade_mgr.check_partial_tp(pos, price, ind):
                self._partial_close(pos, price)

        for pos in positions_to_remove:
            self.positions.remove(pos)

        return closed_this_cycle

    def _close_position(self, pos: Position, exit_price: float,
                        exit_reason: ExitReason) -> TradeLog:
        """Close a position and record the trade."""
        # Calculate PnL
        if pos.side == Side.LONG:
            raw_pnl = (exit_price - pos.entry_price) * pos.quantity
        else:
            raw_pnl = (pos.entry_price - exit_price) * pos.quantity

        # Exit fee
        exit_notional = exit_price * pos.quantity
        exit_fee = exit_notional * (self.fee_pct / 100.0)
        total_fees = pos.fees_paid + exit_fee
        net_pnl = raw_pnl - total_fees

        # PnL as % of margin used
        pnl_pct = (net_pnl / pos.margin_used * 100) if pos.margin_used > 0 else 0

        # Return margin + PnL to cash
        self.risk_mgr.cash += pos.margin_used + net_pnl
        self.total_fees += exit_fee
        self.total_realized_pnl += net_pnl

        is_win = net_pnl > 0
        self.risk_mgr.record_trade_result(net_pnl, is_win)

        if is_win:
            self.winners.append(net_pnl)
        else:
            self.losers.append(net_pnl)

        trade = TradeLog(
            id=pos.id,
            symbol=pos.symbol,
            side=pos.side.value,
            leverage=pos.leverage,
            bias=str(pos.side.value),
            confidence=pos.signal_confidence,
            entry_price=pos.entry_price,
            exit_price=exit_price,
            stop_loss=pos.stop_loss,
            take_profit=pos.take_profit,
            liquidation_price=pos.liquidation_price,
            quantity=pos.quantity,
            notional=pos.notional,
            fees=total_fees,
            pnl=net_pnl,
            pnl_pct=pnl_pct,
            opened_at=pos.opened_at.isoformat(),
            closed_at=datetime.utcnow().isoformat(),
            candles_held=pos.candles_held,
            entry_reason=pos.signal_reason,
            exit_reason=exit_reason.value,
            regime="",
            setup_type="",
        )

        self.logger.log_trade(trade)

        self.logger.event(
            f"CLOSE {pos.side.value} {pos.symbol} | "
            f"Exit=${exit_price:.2f} | PnL=${net_pnl:.2f} ({pnl_pct:.1f}%) | "
            f"Reason={exit_reason.value} | Held={pos.candles_held} candles"
        )

        return trade

    def _partial_close(self, pos: Position, current_price: float):
        """Close a portion of the position at current price."""
        from config import StrategyConfig
        cfg = StrategyConfig()

        close_qty = pos.quantity * cfg.partial_tp_pct
        close_notional = close_qty * current_price

        if pos.side == Side.LONG:
            raw_pnl = (current_price - pos.entry_price) * close_qty
        else:
            raw_pnl = (pos.entry_price - current_price) * close_qty

        fee = close_notional * (self.fee_pct / 100.0)
        net_pnl = raw_pnl - fee

        # Return partial margin + PnL
        partial_margin = pos.margin_used * cfg.partial_tp_pct
        self.risk_mgr.cash += partial_margin + net_pnl
        self.total_fees += fee
        self.total_realized_pnl += net_pnl

        pos.quantity -= close_qty
        pos.margin_used -= partial_margin
        pos.notional = pos.quantity * pos.entry_price
        pos.fees_paid += fee
        pos.partial_tp_taken = True

        self.logger.event(
            f"PARTIAL TP {pos.side.value} {pos.symbol} | "
            f"Closed {close_qty:.6f} @ ${current_price:.2f} | "
            f"PnL=${net_pnl:.2f} | Remaining={pos.quantity:.6f}"
        )

    def get_unrealized_pnl(self, prices: Dict[str, float]) -> float:
        """Total unrealized PnL across all open positions."""
        total = 0.0
        for pos in self.positions:
            price = prices.get(pos.symbol, pos.entry_price)
            total += pos.mark_to_market(price)
        return total

    def get_equity_snapshot(self, prices: Dict[str, float]) -> EquitySnapshot:
        """Current equity state for logging."""
        unrealized = self.get_unrealized_pnl(prices)
        margin_locked = sum(p.margin_used for p in self.positions)
        self.risk_mgr.update_equity(self.risk_mgr.cash, unrealized, margin_locked)

        return EquitySnapshot(
            timestamp=datetime.utcnow().isoformat(),
            equity=self.risk_mgr.equity,
            cash=self.risk_mgr.cash,
            unrealized_pnl=unrealized,
            open_positions=len(self.positions),
            drawdown_pct=self.risk_mgr.drawdown_pct,
            daily_pnl=self.risk_mgr.daily_pnl,
            peak_equity=self.risk_mgr.peak_equity,
        )

    @property
    def profit_factor(self) -> float:
        gross_wins = sum(self.winners) if self.winners else 0
        gross_losses = abs(sum(self.losers)) if self.losers else 0
        if gross_losses == 0:
            return float("inf") if gross_wins > 0 else 0.0
        return gross_wins / gross_losses

    @property
    def avg_winner(self) -> float:
        return sum(self.winners) / len(self.winners) if self.winners else 0.0

    @property
    def avg_loser(self) -> float:
        return sum(self.losers) / len(self.losers) if self.losers else 0.0
