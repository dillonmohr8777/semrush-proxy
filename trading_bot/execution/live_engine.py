"""
Live execution engine for Coinbase Advanced Trade.
Mirrors the PaperEngine interface so the bot can swap between paper and live
with zero strategy changes.

SAFETY LAYERS:
1. Must pass explicit live_mode=True + passphrase
2. Pre-flight checks verify API connectivity and balances
3. Max order size hard cap
4. Confirmation delay before first N orders
5. All orders logged before and after execution
6. Emergency kill switch halts all trading
7. Position tracking mirrors paper engine exactly
"""
import uuid
import time
from datetime import datetime
from typing import List, Optional, Dict

from utils.types import (
    Position, Signal, Side, Action, TradeLog, ExitReason, EquitySnapshot
)
from strategy.risk import RiskManager
from execution.trade_manager import TradeManager
from execution.coinbase_client import CoinbaseClient
from utils.logger import Logger


class SafetyGate:
    """Multi-layer safety checks before any live trade executes."""

    def __init__(self, max_order_usd: float = 500.0,
                 max_daily_orders: int = 20,
                 confirmation_trades: int = 5,
                 min_balance_reserve_usd: float = 100.0):
        self.max_order_usd = max_order_usd
        self.max_daily_orders = max_daily_orders
        self.confirmation_trades = confirmation_trades
        self.min_balance_reserve_usd = min_balance_reserve_usd

        self.orders_today = 0
        self.total_orders_ever = 0
        self.day_marker = datetime.utcnow().date()
        self.enabled = True

    def check(self, signal: Signal, available_balance: float,
              logger: Logger) -> tuple:
        """
        Run all safety checks. Returns (allowed: bool, reason: str).
        """
        if not self.enabled:
            return False, "SAFETY GATE: Trading disabled by kill switch"

        # Day rollover
        today = datetime.utcnow().date()
        if today != self.day_marker:
            self.orders_today = 0
            self.day_marker = today

        # Max order size
        margin_needed = signal.position_size_usd / signal.leverage
        if margin_needed > self.max_order_usd:
            return False, (f"SAFETY GATE: Order margin ${margin_needed:.2f} exceeds "
                           f"max ${self.max_order_usd:.2f}")

        # Daily order limit
        if self.orders_today >= self.max_daily_orders:
            return False, f"SAFETY GATE: Daily order limit ({self.max_daily_orders}) reached"

        # Balance reserve
        if available_balance - margin_needed < self.min_balance_reserve_usd:
            return False, (f"SAFETY GATE: Would leave only "
                           f"${available_balance - margin_needed:.2f} "
                           f"(min reserve: ${self.min_balance_reserve_usd:.2f})")

        # Confirmation period for first N trades
        if self.total_orders_ever < self.confirmation_trades:
            logger.warn(
                f"SAFETY: Trade #{self.total_orders_ever + 1} of "
                f"{self.confirmation_trades} confirmation period. "
                f"Using minimum size."
            )

        return True, "OK"

    def record_order(self):
        self.orders_today += 1
        self.total_orders_ever += 1

    def kill(self):
        self.enabled = False


class LiveEngine:
    """
    Live Coinbase execution engine.
    Same interface as PaperEngine for seamless swap.

    NOTE: Coinbase spot trading does not have native leverage.
    This engine executes spot market orders. For leveraged positions,
    the bot tracks virtual leverage internally — the actual risk is
    the spot position size (margin amount), not the notional.
    """
    def __init__(self, client: CoinbaseClient, risk_manager: RiskManager,
                 trade_manager: TradeManager, logger: Logger,
                 safety: SafetyGate, fee_pct: float = 0.06):
        self.client = client
        self.risk_mgr = risk_manager
        self.trade_mgr = trade_manager
        self.logger = logger
        self.safety = safety
        self.fee_pct = fee_pct

        self.positions: List[Position] = []
        self.closed_trades: List[TradeLog] = []
        self.pending_orders: Dict[str, dict] = {}

        self.total_fees = 0.0
        self.total_realized_pnl = 0.0
        self.winners: List[float] = []
        self.losers: List[float] = []

    def preflight_check(self) -> tuple:
        """
        Run before trading starts. Verifies:
        1. API connection works
        2. Authentication is valid
        3. Account has sufficient balance
        Returns (ok: bool, message: str)
        """
        ok, msg = self.client.test_connection()
        if not ok:
            return False, f"PREFLIGHT FAILED: {msg}"

        if not self.client.authenticated:
            return False, "PREFLIGHT FAILED: API keys not configured"

        try:
            usd_balance = self.client.get_balance("USD")
            if usd_balance < self.safety.min_balance_reserve_usd:
                return False, (f"PREFLIGHT FAILED: USD balance ${usd_balance:.2f} "
                               f"below minimum ${self.safety.min_balance_reserve_usd:.2f}")

            balances = self.client.get_all_balances()
            self.logger.event(
                f"PREFLIGHT OK: USD=${usd_balance:.2f} | "
                f"Balances: {balances}"
            )
            return True, f"Connected. USD balance: ${usd_balance:.2f}"

        except Exception as e:
            return False, f"PREFLIGHT FAILED: {e}"

    def execute_signal(self, signal: Signal) -> Optional[Position]:
        """
        Execute a trade signal on Coinbase.
        For buys: places a market buy order for the margin amount.
        For sells/shorts: NOTE — Coinbase spot doesn't support shorting.
        Short signals are tracked as virtual positions for paper-like tracking,
        but actual execution only happens for longs on spot.
        """
        if signal.action == Action.NO_TRADE:
            return None

        side = signal.side
        if side is None:
            return None

        # For spot trading, we can only execute buys (longs).
        # Shorts are tracked virtually — no actual exchange order.
        is_virtual_short = (side == Side.SHORT)

        # The actual USD to spend is the margin (notional / leverage)
        margin_usd = signal.position_size_usd / signal.leverage

        if not is_virtual_short:
            # Safety gate
            usd_balance = self.client.get_balance("USD")
            allowed, reason = self.safety.check(signal, usd_balance, self.logger)
            if not allowed:
                self.logger.warn(f"BLOCKED: {reason}")
                return None

            # During confirmation period, use minimum size
            if self.safety.total_orders_ever < self.safety.confirmation_trades:
                margin_usd = min(margin_usd, 25.0)  # $25 minimum during warmup
                self.logger.warn(f"CONFIRMATION PERIOD: Reduced order to ${margin_usd:.2f}")

            # Log BEFORE execution
            self.logger.event(
                f"PLACING ORDER: BUY {signal.symbol} | "
                f"Quote size: ${margin_usd:.2f} | "
                f"Signal confidence: {signal.confidence:.2f}"
            )

            # Execute on Coinbase
            try:
                result = self.client.place_market_order(
                    product_id=signal.symbol,
                    side="BUY",
                    quote_size=f"{margin_usd:.2f}",
                )
                order_id = result.get("success_response", {}).get("order_id", "unknown")
                self.safety.record_order()

                self.logger.event(
                    f"ORDER FILLED: {order_id} | BUY {signal.symbol} ${margin_usd:.2f}"
                )
            except Exception as e:
                self.logger.error(f"ORDER FAILED: {e}")
                return None
        else:
            self.logger.event(
                f"VIRTUAL SHORT: {signal.symbol} (spot exchange, no actual order) | "
                f"Tracked for signal validation"
            )

        # Calculate entry fee
        entry_fee = margin_usd * (self.fee_pct / 100.0)

        # Build position (same structure as paper engine)
        position = Position(
            id=str(uuid.uuid4())[:8],
            symbol=signal.symbol,
            side=side,
            leverage=signal.leverage,
            entry_price=signal.entry_price,
            quantity=signal.position_size_qty,
            notional=signal.position_size_usd,
            margin_used=margin_usd,
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

        self.risk_mgr.cash -= (margin_usd + entry_fee)
        self.total_fees += entry_fee
        self.positions.append(position)

        return position

    def update_positions(self, prices: Dict[str, float],
                         indicators: Dict[str, any]) -> List[TradeLog]:
        """Update all open positions. Close those that hit exit conditions."""
        closed_this_cycle = []
        positions_to_remove = []

        for pos in self.positions:
            price = prices.get(pos.symbol)
            if price is None:
                continue

            ind = indicators.get(pos.symbol)
            exit_reason, exit_price = self.trade_mgr.manage_position(pos, price, ind)

            if exit_reason:
                trade = self._close_position(pos, exit_price or price, exit_reason)
                closed_this_cycle.append(trade)
                positions_to_remove.append(pos)

        for pos in positions_to_remove:
            self.positions.remove(pos)

        return closed_this_cycle

    def _close_position(self, pos: Position, exit_price: float,
                        exit_reason: ExitReason) -> TradeLog:
        """Close a position. For real longs, sells on Coinbase."""
        is_virtual_short = (pos.side == Side.SHORT)

        # Calculate PnL
        if pos.side == Side.LONG:
            raw_pnl = (exit_price - pos.entry_price) * pos.quantity
        else:
            raw_pnl = (pos.entry_price - exit_price) * pos.quantity

        exit_notional = exit_price * pos.quantity
        exit_fee = exit_notional * (self.fee_pct / 100.0)
        total_fees = pos.fees_paid + exit_fee
        net_pnl = raw_pnl - total_fees

        # Execute sell on exchange for real longs
        if not is_virtual_short and pos.quantity > 0:
            try:
                coin = pos.symbol.split("-")[0]
                self.logger.event(
                    f"CLOSING ORDER: SELL {pos.quantity:.8f} {coin} | "
                    f"Reason: {exit_reason.value}"
                )
                result = self.client.place_market_order(
                    product_id=pos.symbol,
                    side="SELL",
                    base_size=f"{pos.quantity:.8f}",
                )
                order_id = result.get("success_response", {}).get("order_id", "unknown")
                self.safety.record_order()
                self.logger.event(f"CLOSE FILLED: {order_id}")
            except Exception as e:
                self.logger.error(f"CLOSE ORDER FAILED: {e}")
                # Still record the trade for tracking, but flag it
                net_pnl = 0  # Don't count PnL if we couldn't actually close

        # Return margin + PnL
        self.risk_mgr.cash += pos.margin_used + net_pnl
        self.total_fees += exit_fee
        self.total_realized_pnl += net_pnl

        is_win = net_pnl > 0
        self.risk_mgr.record_trade_result(net_pnl, is_win)
        if is_win:
            self.winners.append(net_pnl)
        else:
            self.losers.append(net_pnl)

        pnl_pct = (net_pnl / pos.margin_used * 100) if pos.margin_used > 0 else 0

        trade = TradeLog(
            id=pos.id, symbol=pos.symbol, side=pos.side.value,
            leverage=pos.leverage, bias=pos.side.value,
            confidence=pos.signal_confidence,
            entry_price=pos.entry_price, exit_price=exit_price,
            stop_loss=pos.stop_loss, take_profit=pos.take_profit,
            liquidation_price=pos.liquidation_price,
            quantity=pos.quantity, notional=pos.notional,
            fees=total_fees, pnl=net_pnl, pnl_pct=pnl_pct,
            opened_at=pos.opened_at.isoformat(),
            closed_at=datetime.utcnow().isoformat(),
            candles_held=pos.candles_held,
            entry_reason=pos.signal_reason,
            exit_reason=exit_reason.value,
            regime="", setup_type="",
        )

        self.logger.log_trade(trade)
        return trade

    def get_unrealized_pnl(self, prices: Dict[str, float]) -> float:
        total = 0.0
        for pos in self.positions:
            price = prices.get(pos.symbol, pos.entry_price)
            total += pos.mark_to_market(price)
        return total

    def get_equity_snapshot(self, prices: Dict[str, float]) -> EquitySnapshot:
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

    def emergency_close_all(self):
        """Emergency: close all positions immediately."""
        self.logger.warn("EMERGENCY CLOSE ALL POSITIONS")
        for pos in list(self.positions):
            try:
                if pos.side == Side.LONG:
                    coin = pos.symbol.split("-")[0]
                    self.client.place_market_order(
                        product_id=pos.symbol,
                        side="SELL",
                        base_size=f"{pos.quantity:.8f}",
                    )
                self.positions.remove(pos)
            except Exception as e:
                self.logger.error(f"EMERGENCY CLOSE FAILED for {pos.symbol}: {e}")

        self.safety.kill()
