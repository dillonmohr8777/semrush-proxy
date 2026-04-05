"""
Drawdown tracking and equity curve analysis.
"""
from typing import List
from utils.types import EquitySnapshot


class DrawdownTracker:
    def __init__(self, starting_balance: float):
        self.starting_balance = starting_balance
        self.peak = starting_balance
        self.trough = starting_balance
        self.max_drawdown_pct = 0.0
        self.current_drawdown_pct = 0.0
        self.equity_history: List[float] = [starting_balance]

    def update(self, equity: float):
        """Update drawdown tracking with new equity value."""
        self.equity_history.append(equity)

        if equity > self.peak:
            self.peak = equity
            self.trough = equity  # Reset trough on new peak

        if equity < self.trough:
            self.trough = equity

        # Current drawdown from peak
        if self.peak > 0:
            self.current_drawdown_pct = (self.peak - equity) / self.peak * 100
        else:
            self.current_drawdown_pct = 0.0

        # Max drawdown ever
        if self.current_drawdown_pct > self.max_drawdown_pct:
            self.max_drawdown_pct = self.current_drawdown_pct

    @property
    def is_in_drawdown(self) -> bool:
        return self.current_drawdown_pct > 0.5  # More than 0.5%

    @property
    def recovery_needed_pct(self) -> float:
        """% gain needed to recover from current drawdown."""
        if self.current_drawdown_pct <= 0:
            return 0.0
        current = self.equity_history[-1] if self.equity_history else self.starting_balance
        if current <= 0:
            return float("inf")
        return (self.peak - current) / current * 100
