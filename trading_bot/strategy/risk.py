"""
Risk management: position sizing, exposure limits, drawdown guards, kill switches.
This is the most critical module. Every trade must pass through here.
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict
from utils.types import Position, Side, TradeLog
from config import RiskConfig, LeverageConfig


class RiskManager:
    def __init__(self, config: RiskConfig, leverage_config: LeverageConfig):
        self.config = config
        self.lev_config = leverage_config

        self.equity = config.starting_balance
        self.cash = config.starting_balance
        self.peak_equity = config.starting_balance
        self.daily_start_equity = config.starting_balance
        self.weekly_start_equity = config.starting_balance
        self.daily_pnl = 0.0

        self.last_loss_time: Optional[datetime] = None
        self.consecutive_losses = 0
        self.total_trades = 0
        self.total_wins = 0
        self.total_losses = 0
        self.kill_switch_active = False

        self._day_marker = datetime.now(timezone.utc).date()
        self._week_marker = datetime.now(timezone.utc).isocalendar()[1]

    def update_equity(self, cash: float, unrealized_pnl: float,
                      margin_in_positions: float = 0.0):
        """Update equity and check drawdown thresholds."""
        self.cash = cash
        self.equity = cash + margin_in_positions + unrealized_pnl

        # Track peaks
        if self.equity > self.peak_equity:
            self.peak_equity = self.equity

        # Day/week rollover
        now = datetime.now(timezone.utc)
        if now.date() != self._day_marker:
            self._day_marker = now.date()
            self.daily_pnl = 0.0
            self.daily_start_equity = self.equity

        week_num = now.isocalendar()[1]
        if week_num != self._week_marker:
            self._week_marker = week_num
            self.weekly_start_equity = self.equity

        # Kill switch check
        dd = self.drawdown_pct
        if dd >= self.config.max_total_drawdown_pct:
            self.kill_switch_active = True

    @property
    def drawdown_pct(self) -> float:
        if self.peak_equity <= 0:
            return 0.0
        return (self.peak_equity - self.equity) / self.peak_equity * 100

    @property
    def daily_loss_pct(self) -> float:
        if self.daily_start_equity <= 0:
            return 0.0
        return max(0, (self.daily_start_equity - self.equity) / self.daily_start_equity * 100)

    @property
    def weekly_drawdown_pct(self) -> float:
        if self.weekly_start_equity <= 0:
            return 0.0
        return max(0, (self.weekly_start_equity - self.equity) / self.weekly_start_equity * 100)

    def can_trade(self, open_positions: List[Position]) -> tuple:
        """
        Check all risk gates. Returns (allowed: bool, reason: str).
        """
        if self.kill_switch_active:
            return False, f"KILL SWITCH: drawdown {self.drawdown_pct:.1f}% exceeds {self.config.max_total_drawdown_pct}%"

        if self.daily_loss_pct >= self.config.max_daily_loss_pct:
            return False, f"Daily loss limit: {self.daily_loss_pct:.1f}% >= {self.config.max_daily_loss_pct}%"

        if self.weekly_drawdown_pct >= self.config.max_weekly_drawdown_pct:
            return False, f"Weekly drawdown limit: {self.weekly_drawdown_pct:.1f}% >= {self.config.max_weekly_drawdown_pct}%"

        if len(open_positions) >= self.config.max_concurrent_positions:
            return False, f"Max concurrent positions ({self.config.max_concurrent_positions}) reached"

        # Cooldown after stop loss
        now = datetime.now(timezone.utc)
        if self.last_loss_time:
            cooldown = timedelta(seconds=self.config.cooldown_after_stop_seconds)
            if now - self.last_loss_time < cooldown:
                remaining = (self.last_loss_time + cooldown - now).seconds
                return False, f"Stop loss cooldown: {remaining}s remaining"

        # Cooldown after consecutive losses
        if self.consecutive_losses >= self.config.cooldown_after_consecutive_losses:
            if self.last_loss_time:
                cooldown = timedelta(seconds=self.config.cooldown_consecutive_loss_seconds)
                if now - self.last_loss_time < cooldown:
                    remaining = (self.last_loss_time + cooldown - now).seconds
                    return False, f"Consecutive loss cooldown ({self.consecutive_losses} losses): {remaining}s remaining"
                else:
                    # Cooldown expired, reset
                    self.consecutive_losses = 0

        return True, "OK"

    def check_exposure(self, new_notional: float, symbol: str,
                       open_positions: List[Position]) -> tuple:
        """Check notional exposure limits. Returns (allowed, reason)."""
        total_notional = sum(p.notional for p in open_positions) + new_notional
        if total_notional > self.config.max_notional_exposure:
            return False, f"Total notional ${total_notional:.0f} exceeds max ${self.config.max_notional_exposure:.0f}"

        asset_notional = sum(p.notional for p in open_positions if p.symbol == symbol) + new_notional
        if asset_notional > self.config.max_exposure_per_asset:
            return False, f"{symbol} notional ${asset_notional:.0f} exceeds max ${self.config.max_exposure_per_asset:.0f}"

        return True, "OK"

    def calculate_position_size(self, equity: float, entry_price: float,
                                stop_loss: float, leverage: float,
                                side: Side,
                                contract_size: float = 0.0) -> tuple:
        """
        Size position based on:
        - Risk per trade (% of equity)
        - Stop distance
        - Leverage
        - Contract size (for futures)

        Returns (notional, quantity, margin, contracts).
        contracts = 0 for spot, >= 1 for futures.
        """
        # Risk amount in USD
        risk_usd = equity * (self.config.risk_per_trade_pct / 100.0)

        # Stop distance as fraction of entry
        if side == Side.LONG:
            stop_distance = (entry_price - stop_loss) / entry_price
        else:
            stop_distance = (stop_loss - entry_price) / entry_price

        if stop_distance <= 0:
            return 0, 0, 0, 0

        # Position size: risk / (stop_distance) — this is the notional
        # With leverage, the margin = notional / leverage
        notional = risk_usd / stop_distance
        margin = notional / leverage

        # Cap margin at 40% of equity per trade (diversification)
        max_margin_per_trade = equity * 0.40
        if margin > max_margin_per_trade:
            margin = max_margin_per_trade
            notional = margin * leverage

        # Cap by available cash
        if margin > self.cash * 0.90:  # Keep 10% reserve
            margin = self.cash * 0.90
            notional = margin * leverage

        # Cap by max notional
        notional = min(notional, self.config.max_notional_exposure)
        notional = min(notional, self.config.max_exposure_per_asset)

        quantity = notional / entry_price
        margin = notional / leverage

        # Convert to contracts for futures
        contracts = 0
        if contract_size > 0:
            contracts = max(1, int(quantity / contract_size))
            # Snap quantity and notional to whole contracts
            quantity = contracts * contract_size
            notional = quantity * entry_price
            margin = notional / leverage

        return notional, quantity, margin, contracts

    def record_trade_result(self, pnl: float, is_win: bool):
        """Update risk state after a trade closes."""
        self.total_trades += 1
        self.daily_pnl += pnl

        if is_win:
            self.total_wins += 1
            self.consecutive_losses = 0
        else:
            self.total_losses += 1
            self.consecutive_losses += 1
            self.last_loss_time = datetime.now(timezone.utc)

    @property
    def win_rate(self) -> float:
        if self.total_trades == 0:
            return 0.0
        return self.total_wins / self.total_trades * 100
