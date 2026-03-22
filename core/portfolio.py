"""
Portfolio tracker — wraps RiskEngine and provides high-level P&L views.
"""
import logging
from typing import Dict, List
from datetime import datetime, timezone

from core.risk import RiskEngine, Position
from config.settings import STARTING_CAPITAL, RiskConfig

logger = logging.getLogger(__name__)


class Portfolio:
    def __init__(self, starting_capital: float = STARTING_CAPITAL,
                 risk_cfg: RiskConfig = None):
        self.starting_capital = starting_capital
        self.risk = RiskEngine(risk_cfg or RiskConfig(), starting_capital)
        self._total_pnl: float = 0.0  # cumulative closed P&L

    # ─── Delegation helpers ──────────────────────────────────────────────────

    @property
    def capital(self) -> float:
        return self.risk.capital

    @property
    def positions(self) -> Dict[str, Position]:
        return self.risk.positions

    def can_trade(self, product_id: str, confidence: float):
        return self.risk.can_trade(product_id, confidence)

    def size_position(self, price: float, atr: float, confidence: float) -> float:
        return self.risk.size_position(price, atr, confidence)

    def open_position(self, product_id: str, side: str, entry_price: float,
                      quantity: float, size_usd: float,
                      stop_loss: float = None, take_profit: float = None,
                      order_id: str = "") -> Position:
        return self.risk.open_position(
            product_id, side, entry_price, quantity, size_usd,
            stop_loss, take_profit, order_id
        )

    def close_position(self, product_id: str, exit_price: float,
                       reason: str = "") -> float:
        pnl = self.risk.close_position(product_id, exit_price, reason)
        self._total_pnl += pnl
        return pnl

    def check_exits(self, product_id: str, price: float):
        return self.risk.check_exit_conditions(product_id, price)

    # ─── Summary ─────────────────────────────────────────────────────────────

    def snapshot(self, live_prices: Dict[str, float] = None) -> Dict:
        prices    = live_prices or {}
        unrealzd  = self.risk.unrealized_pnl(prices)
        total_val = self.capital + sum(
            pos.size_usd for pos in self.positions.values()
        )
        return {
            "capital_free":    round(self.capital, 2),
            "capital_deployed": round(sum(p.size_usd for p in self.positions.values()), 2),
            "portfolio_value": round(total_val, 2),
            "starting_capital": round(self.starting_capital, 2),
            "total_return_pct": round((total_val - self.starting_capital)
                                       / self.starting_capital * 100, 2),
            "unrealized_pnl":  unrealzd,
            "total_pnl":       round(self._total_pnl, 2),
            "open_positions":  len(self.positions),
            "daily":           self.risk.daily_summary(),
        }

    def positions_summary(self, live_prices: Dict[str, float] = None) -> List[Dict]:
        prices = live_prices or {}
        rows = []
        for pid, pos in self.positions.items():
            price = prices.get(pid, pos.entry_price)
            pnl   = (price - pos.entry_price) * pos.quantity \
                    if pos.side == "BUY" \
                    else (pos.entry_price - price) * pos.quantity
            rows.append({
                "product":     pid,
                "side":        pos.side,
                "entry":       round(pos.entry_price, 2),
                "current":     round(price, 2),
                "qty":         round(pos.quantity, 6),
                "size_usd":    round(pos.size_usd, 2),
                "pnl":         round(pnl, 2),
                "stop_loss":   round(pos.stop_loss, 2) if pos.stop_loss else None,
                "take_profit": round(pos.take_profit, 2) if pos.take_profit else None,
                "trailing":    round(pos.trailing_stop, 2) if pos.trailing_stop else None,
                "opened_at":   pos.opened_at.isoformat(),
            })
        return rows
