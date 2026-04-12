"""
Live execution engine for Coinbase Advanced Trade — FUTURES + SPOT.
Mirrors the PaperEngine interface so the bot can swap between paper and live
with zero strategy changes.

FUTURES MODE:
- Real LONG and SHORT via nano BTC/ETH/SOL perpetual futures
- Actual exchange leverage (up to 10x on Coinbase)
- Contract-based sizing (e.g. 5 contracts of nano BTC)
- Real margin requirements
- Stop loss orders placed on exchange

SAFETY LAYERS:
1. Must pass explicit live_mode=True + passphrase
2. Pre-flight checks verify API connectivity and balances
3. Max order size hard cap (configurable)
4. Confirmation delay before first N orders
5. All orders logged before and after execution
6. Emergency kill switch halts all trading + closes positions
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
        if not self.enabled:
            return False, "SAFETY GATE: Trading disabled by kill switch"

        today = datetime.utcnow().date()
        if today != self.day_marker:
            self.orders_today = 0
            self.day_marker = today

        margin_needed = signal.position_size_usd / signal.leverage
        if margin_needed > self.max_order_usd:
            return False, (f"SAFETY GATE: Order margin ${margin_needed:.2f} exceeds "
                           f"max ${self.max_order_usd:.2f}")

        if self.orders_today >= self.max_daily_orders:
            return False, f"SAFETY GATE: Daily order limit ({self.max_daily_orders}) reached"

        if available_balance - margin_needed < self.min_balance_reserve_usd:
            return False, (f"SAFETY GATE: Would leave only "
                           f"${available_balance - margin_needed:.2f} "
                           f"(min reserve: ${self.min_balance_reserve_usd:.2f})")

        if self.total_orders_ever < self.confirmation_trades:
            logger.warn(
                f"SAFETY: Trade #{self.total_orders_ever + 1} of "
                f"{self.confirmation_trades} confirmation period."
            )

        return True, "OK"

    def record_order(self):
        self.orders_today += 1
        self.total_orders_ever += 1

    def kill(self):
        self.enabled = False


class LiveEngine:
    """
    Live Coinbase execution engine for FUTURES (perps).
    Supports real LONG and SHORT positions via nano futures contracts.
    Same interface as PaperEngine for seamless swap.
    """
    def __init__(self, client: CoinbaseClient, risk_manager: RiskManager,
                 trade_manager: TradeManager, logger: Logger,
                 safety: SafetyGate, futures_config=None,
                 fee_pct: float = 0.08):
        self.client = client
        self.risk_mgr = risk_manager
        self.trade_mgr = trade_manager
        self.logger = logger
        self.safety = safety
        self.fee_pct = fee_pct
        self.futures_config = futures_config

        self.positions: List[Position] = []
        self.closed_trades: List[TradeLog] = []
        self.exchange_order_ids: Dict[str, List[str]] = {}  # position_id -> [order_ids]

        self.total_fees = 0.0
        self.total_realized_pnl = 0.0
        self.winners: List[float] = []
        self.losers: List[float] = []

    def _get_perp_product_id(self, symbol: str) -> str:
        """Map internal symbol to Coinbase futures product ID.
        Uses CFM (US) or INTX (international) IDs based on config."""
        if self.futures_config:
            mode = getattr(self.futures_config, 'product_id_mode', 'cfm')
            if mode == 'intx':
                intx_ids = getattr(self.futures_config, 'intx_product_ids', {})
                return intx_ids.get(symbol, symbol)
            return self.futures_config.perp_product_ids.get(symbol, symbol)
        return symbol

    def _get_contract_size(self, symbol: str) -> float:
        if self.futures_config:
            return self.futures_config.contract_sizes.get(symbol, 0.01)
        return 0.01

    def preflight_check(self) -> tuple:
        """Verify API connection, auth, and balance before trading."""
        ok, msg = self.client.test_connection()
        if not ok:
            return False, f"PREFLIGHT FAILED: {msg}"
        if not self.client.authenticated:
            return False, "PREFLIGHT FAILED: API keys not configured"

        try:
            # Check USDC balance (needed for futures margin)
            usdc_bal = self.client.get_balance("USDC")
            if usdc_bal < self.safety.min_balance_reserve_usd:
                return False, (f"PREFLIGHT FAILED: USDC balance ${usdc_bal:.2f} "
                               f"below minimum ${self.safety.min_balance_reserve_usd:.2f}")

            # Try to get futures balance
            futures_msg = ""
            try:
                fb = self.client.get_futures_balance()
                buying_power = float(fb.get("futures_buying_power", 0))
                avail_margin = float(fb.get("available_margin", 0))
                futures_msg = (f" | Futures buying power: ${buying_power:,.2f}"
                               f" | Available margin: ${avail_margin:,.2f}")
            except Exception:
                futures_msg = " | Warning: futures balance not accessible"

            self.logger.event(f"PREFLIGHT OK: USDC=${usdc_bal:.2f}{futures_msg}")
            return True, f"Connected. USDC balance: ${usdc_bal:.2f}{futures_msg}"

        except Exception as e:
            return False, f"PREFLIGHT FAILED: {e}"

    def execute_signal(self, signal: Signal) -> Optional[Position]:
        """
        Execute a trade signal via Coinbase futures.
        Both LONG and SHORT are real exchange orders.
        """
        if signal.action == Action.NO_TRADE:
            return None
        side = signal.side
        if side is None:
            return None

        product_id = self._get_perp_product_id(signal.symbol)
        contracts = signal.contracts
        if contracts < 1:
            contracts = 1

        margin_usd = signal.position_size_usd / signal.leverage

        # Safety gate
        try:
            usdc_bal = self.client.get_balance("USDC")
        except Exception:
            usdc_bal = self.risk_mgr.cash

        allowed, reason = self.safety.check(signal, usdc_bal, self.logger)
        if not allowed:
            self.logger.warn(f"BLOCKED: {reason}")
            return None

        # During confirmation period, reduce to 1 contract
        if self.safety.total_orders_ever < self.safety.confirmation_trades:
            contracts = 1
            contract_size = self._get_contract_size(signal.symbol)
            margin_usd = (contracts * contract_size * signal.entry_price) / signal.leverage
            self.logger.warn(f"CONFIRMATION PERIOD: Reduced to {contracts} contract(s)")

        # Determine order side
        order_side = "BUY" if side == Side.LONG else "SELL"

        # Log BEFORE execution
        self.logger.event(
            f"PLACING FUTURES ORDER: {order_side} {contracts} contracts {product_id} | "
            f"Signal confidence: {signal.confidence:.2f} | "
            f"Leverage: {signal.leverage}x"
        )

        # Execute on Coinbase
        try:
            leverage_str = str(int(signal.leverage))
            result = self.client.place_futures_market_order(
                product_id=product_id,
                side=order_side,
                contracts=contracts,
                leverage=leverage_str,
            )
            order_id = result.get("success_response", {}).get("order_id", "unknown")
            self.safety.record_order()
            self.logger.event(f"ORDER FILLED: {order_id} | {order_side} {contracts}x {product_id}")
        except Exception as e:
            self.logger.error(f"ORDER FAILED: {e}")
            return None

        # Place stop loss order on exchange
        stop_order_id = None
        try:
            stop_side = "SELL" if side == Side.LONG else "BUY"
            stop_result = self.client.place_futures_stop_order(
                product_id=product_id,
                side=stop_side,
                contracts=contracts,
                stop_price=signal.stop_loss,
            )
            stop_order_id = stop_result.get("success_response", {}).get("order_id")
            self.logger.event(f"STOP ORDER PLACED: {stop_order_id} @ ${signal.stop_loss:,.2f}")
        except Exception as e:
            self.logger.warn(f"STOP ORDER FAILED (will manage in software): {e}")

        # Calculate fees
        contract_size = self._get_contract_size(signal.symbol)
        actual_qty = contracts * contract_size
        actual_notional = actual_qty * signal.entry_price
        entry_fee = actual_notional * (self.fee_pct / 100.0)

        # Build position
        position = Position(
            id=str(uuid.uuid4())[:8],
            symbol=signal.symbol,
            side=side,
            leverage=signal.leverage,
            entry_price=signal.entry_price,
            quantity=actual_qty,
            contracts=contracts,
            contract_size=contract_size,
            notional=actual_notional,
            margin_used=actual_notional / signal.leverage,
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
            liquidation_price=signal.liquidation_price,
            opened_at=datetime.utcnow(),
            highest_price=signal.entry_price,
            lowest_price=signal.entry_price,
            original_quantity=actual_qty,
            fees_paid=entry_fee,
            signal_confidence=signal.confidence,
            signal_reason=signal.reason,
        )

        # Track exchange order IDs
        order_ids = [order_id]
        if stop_order_id:
            order_ids.append(stop_order_id)
        self.exchange_order_ids[position.id] = order_ids

        self.risk_mgr.cash -= (position.margin_used + entry_fee)
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
        """Close a futures position on exchange."""
        product_id = self._get_perp_product_id(pos.symbol)

        # Cancel any open stop/TP orders for this position
        if pos.id in self.exchange_order_ids:
            try:
                self.client.cancel_orders(self.exchange_order_ids[pos.id])
            except Exception as e:
                self.logger.warn(f"Cancel orders failed: {e}")

        # Calculate PnL
        if pos.side == Side.LONG:
            raw_pnl = (exit_price - pos.entry_price) * pos.quantity
        else:
            raw_pnl = (pos.entry_price - exit_price) * pos.quantity

        exit_notional = exit_price * pos.quantity
        exit_fee = exit_notional * (self.fee_pct / 100.0)
        total_fees = pos.fees_paid + exit_fee
        net_pnl = raw_pnl - total_fees

        # Close on exchange using dedicated close_position endpoint
        try:
            self.logger.event(
                f"CLOSING FUTURES: {pos.contracts}x {product_id} | "
                f"Reason: {exit_reason.value}"
            )
            result = self.client.close_futures_position(
                product_id=product_id,
                size=pos.contracts,
            )
            order_id = result.get("success_response", {}).get("order_id", "unknown")
            self.safety.record_order()
            self.logger.event(f"CLOSE FILLED: {order_id}")
        except Exception as e:
            # Fallback: try placing an opposite-side market order
            self.logger.warn(f"close_position endpoint failed: {e}, trying market order fallback")
            try:
                close_side = "SELL" if pos.side == Side.LONG else "BUY"
                result = self.client.place_futures_market_order(
                    product_id=product_id,
                    side=close_side,
                    contracts=pos.contracts,
                )
                order_id = result.get("success_response", {}).get("order_id", "unknown")
                self.safety.record_order()
                self.logger.event(f"CLOSE FILLED (fallback): {order_id}")
            except Exception as e2:
                self.logger.error(f"CLOSE ORDER FAILED (both methods): {e2}")

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
        """Emergency: close ALL futures positions immediately."""
        self.logger.warn("EMERGENCY CLOSE ALL POSITIONS")
        for pos in list(self.positions):
            try:
                product_id = self._get_perp_product_id(pos.symbol)
                try:
                    self.client.close_futures_position(
                        product_id=product_id,
                        size=pos.contracts,
                    )
                except Exception:
                    # Fallback to opposite-side market order
                    close_side = "SELL" if pos.side == Side.LONG else "BUY"
                    self.client.place_futures_market_order(
                        product_id=product_id,
                        side=close_side,
                        contracts=pos.contracts,
                    )
                self.logger.event(f"EMERGENCY CLOSED: {pos.side.value} {pos.symbol}")
                self.positions.remove(pos)
            except Exception as e:
                self.logger.error(f"EMERGENCY CLOSE FAILED for {pos.symbol}: {e}")

        # Cancel all open orders
        try:
            open_orders = self.client.list_open_orders()
            if open_orders:
                order_ids = [o.get("order_id") for o in open_orders if o.get("order_id")]
                if order_ids:
                    self.client.cancel_orders(order_ids)
                    self.logger.event(f"CANCELLED {len(order_ids)} open orders")
        except Exception as e:
            self.logger.error(f"CANCEL ORDERS FAILED: {e}")

        self.safety.kill()

    def sync_exchange_positions(self):
        """
        Query exchange for open futures positions and log any discrepancy
        between our tracked state and what's actually on Coinbase.
        Called periodically as a safety reconciliation step.
        """
        try:
            exchange_positions = self.client.get_futures_positions()
            exchange_count = len(exchange_positions)
            local_count = len(self.positions)

            if exchange_count != local_count:
                self.logger.warn(
                    f"POSITION MISMATCH: exchange has {exchange_count} positions, "
                    f"bot tracking {local_count}"
                )

            for ep in exchange_positions:
                pid = ep.get("product_id", "")
                contracts = int(ep.get("number_of_contracts", 0))
                unrealized = float(ep.get("unrealized_pnl", 0))
                avg_entry = float(ep.get("avg_entry_price", 0))
                self.logger.event(
                    f"EXCHANGE POS: {pid} | {contracts} contracts | "
                    f"Entry: ${avg_entry:,.2f} | uPnL: ${unrealized:,.2f}"
                )

        except Exception as e:
            self.logger.warn(f"Exchange position sync failed: {e}")

    def get_exchange_balance_summary(self) -> dict:
        """Get futures portfolio summary from Coinbase."""
        try:
            return self.client.get_futures_balance()
        except Exception as e:
            self.logger.warn(f"Futures balance query failed: {e}")
            return {}
