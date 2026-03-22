"""
Risk Management Engine.

Responsibilities:
  - Pre-trade checks: position sizing, daily loss limit, max open positions
  - Post-fill tracking: stop loss, take profit, trailing stop
  - Kelly criterion sizing
  - Daily P&L reset at midnight UTC
"""
import logging
from datetime import datetime, timezone, date
from dataclasses import dataclass, field
from typing import Dict, Optional

from config.settings import RiskConfig, STARTING_CAPITAL

logger = logging.getLogger(__name__)


@dataclass
class Position:
    product_id:     str
    side:           str           # "BUY" or "SELL"
    entry_price:    float
    quantity:       float         # in base currency (BTC, ETH)
    size_usd:       float         # notional at entry
    stop_loss:      Optional[float] = None
    take_profit:    Optional[float] = None
    trailing_stop:  Optional[float] = None  # set after entry
    highest_price:  float = 0.0   # for trailing stop tracking
    lowest_price:   float = float("inf")
    opened_at:      datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    order_id:       str = ""


@dataclass
class DailyStats:
    date:        date
    realized_pnl: float = 0.0
    trades:       int   = 0
    wins:         int   = 0
    losses:       int   = 0


class RiskEngine:
    """
    Stateful risk engine. One instance per bot run.
    """

    def __init__(self, cfg: RiskConfig = None,
                 starting_capital: float = STARTING_CAPITAL):
        self.cfg      = cfg or RiskConfig()
        self.capital  = starting_capital   # tracks available USD
        self.positions: Dict[str, Position] = {}  # product_id → Position
        self._today   = DailyStats(date=datetime.now(timezone.utc).date())
        self._history: list = []

    # ─── Pre-trade checks ────────────────────────────────────────────────────

    def can_trade(self, product_id: str, signal_confidence: float) -> tuple[bool, str]:
        """Return (allowed, reason)."""
        self._roll_day_if_needed()

        # Daily loss limit
        if self._today.realized_pnl <= -self.cfg.daily_loss_limit:
            return False, f"Daily loss limit hit (${self._today.realized_pnl:.2f})"

        # Max open positions
        if len(self.positions) >= self.cfg.max_open_positions:
            return False, f"Max open positions ({self.cfg.max_open_positions}) reached"

        # Already have a position in this product
        if product_id in self.positions:
            return False, f"Already have open position in {product_id}"

        # Minimum confidence
        if signal_confidence < 0.3:
            return False, f"Confidence too low ({signal_confidence:.3f} < 0.30)"

        return True, "ok"

    def size_position(self, price: float, atr: float,
                      confidence: float) -> float:
        """
        Return USD amount to trade using Kelly-adjusted, ATR-scaled sizing.

        Kelly fraction = edge / odds
        We approximate edge from confidence and use 2:1 R/R assumption.
        ATR-based volatility scaling reduces size in choppy markets.
        """
        # Fractional Kelly
        # win_prob ~ confidence, odds = take_profit/stop_loss ~ 2
        win_prob  = min(0.65, max(0.35, confidence))
        loss_frac = self.cfg.stop_loss_pct
        win_frac  = self.cfg.take_profit_pct
        kelly     = (win_prob * win_frac - (1 - win_prob) * loss_frac) / win_frac
        kelly     = max(0.0, kelly) * self.cfg.kelly_fraction

        # ATR volatility scalar: higher ATR → reduce size
        vol_norm  = min(2.0, (atr / price) / 0.02)   # normalize to 2% baseline
        vol_scale = 1.0 / max(0.5, vol_norm)

        size_usd = self.capital * kelly * vol_scale

        # Hard caps
        size_usd = min(size_usd, self.cfg.max_trade_usd)
        size_usd = min(size_usd, self.capital * self.cfg.max_position_pct)
        size_usd = max(size_usd, self.cfg.min_trade_usd)

        return round(size_usd, 2)

    # ─── Position lifecycle ──────────────────────────────────────────────────

    def open_position(self, product_id: str, side: str, entry_price: float,
                      quantity: float, size_usd: float,
                      stop_loss: float = None, take_profit: float = None,
                      order_id: str = "") -> Position:
        trailing = entry_price * (1 - self.cfg.trailing_stop_pct) \
                   if side == "BUY" else entry_price * (1 + self.cfg.trailing_stop_pct)

        pos = Position(
            product_id   = product_id,
            side         = side,
            entry_price  = entry_price,
            quantity     = quantity,
            size_usd     = size_usd,
            stop_loss    = stop_loss,
            take_profit  = take_profit,
            trailing_stop= trailing,
            highest_price= entry_price,
            lowest_price = entry_price,
            order_id     = order_id,
        )
        self.positions[product_id] = pos
        self.capital -= size_usd
        logger.info(f"Position opened: {side} {product_id} @ {entry_price:.2f} "
                    f"qty={quantity:.6f} size=${size_usd:.2f}")
        return pos

    def close_position(self, product_id: str, exit_price: float,
                       reason: str = "") -> float:
        """Close position, update P&L, return realized P&L."""
        pos = self.positions.pop(product_id, None)
        if not pos:
            return 0.0

        if pos.side == "BUY":
            pnl = (exit_price - pos.entry_price) * pos.quantity
        else:
            pnl = (pos.entry_price - exit_price) * pos.quantity

        proceeds      = pos.size_usd + pnl
        self.capital += proceeds
        self._today.realized_pnl += pnl
        self._today.trades += 1
        if pnl > 0:
            self._today.wins   += 1
        else:
            self._today.losses += 1

        logger.info(f"Position closed: {product_id} @ {exit_price:.2f} "
                    f"P&L={pnl:+.2f} ({reason})")
        return pnl

    def update_trailing_stop(self, product_id: str, current_price: float):
        """Ratchet trailing stop up (for longs) or down (for shorts)."""
        pos = self.positions.get(product_id)
        if not pos:
            return

        if pos.side == "BUY":
            if current_price > pos.highest_price:
                pos.highest_price = current_price
                new_stop = current_price * (1 - self.cfg.trailing_stop_pct)
                if new_stop > (pos.trailing_stop or 0):
                    pos.trailing_stop = new_stop
        else:
            if current_price < pos.lowest_price:
                pos.lowest_price = current_price
                new_stop = current_price * (1 + self.cfg.trailing_stop_pct)
                if new_stop < (pos.trailing_stop or float("inf")):
                    pos.trailing_stop = new_stop

    def check_exit_conditions(self, product_id: str,
                               current_price: float) -> Optional[str]:
        """
        Returns exit reason string if position should be closed, else None.
        Call this on every price tick for open positions.
        """
        pos = self.positions.get(product_id)
        if not pos:
            return None

        self.update_trailing_stop(product_id, current_price)

        if pos.side == "BUY":
            if pos.stop_loss and current_price <= pos.stop_loss:
                return f"stop_loss @ {current_price:.2f}"
            if pos.trailing_stop and current_price <= pos.trailing_stop:
                return f"trailing_stop @ {current_price:.2f}"
            if pos.take_profit and current_price >= pos.take_profit:
                return f"take_profit @ {current_price:.2f}"
        else:
            if pos.stop_loss and current_price >= pos.stop_loss:
                return f"stop_loss @ {current_price:.2f}"
            if pos.trailing_stop and current_price >= pos.trailing_stop:
                return f"trailing_stop @ {current_price:.2f}"
            if pos.take_profit and current_price <= pos.take_profit:
                return f"take_profit @ {current_price:.2f}"

        return None

    # ─── Stats ───────────────────────────────────────────────────────────────

    def daily_summary(self) -> Dict:
        s = self._today
        win_rate = s.wins / s.trades if s.trades else 0
        return {
            "date":         str(s.date),
            "realized_pnl": round(s.realized_pnl, 2),
            "trades":       s.trades,
            "wins":         s.wins,
            "losses":       s.losses,
            "win_rate":     round(win_rate, 3),
            "capital":      round(self.capital, 2),
        }

    def unrealized_pnl(self, prices: Dict[str, float]) -> float:
        total = 0.0
        for pid, pos in self.positions.items():
            p = prices.get(pid, 0)
            if p:
                if pos.side == "BUY":
                    total += (p - pos.entry_price) * pos.quantity
                else:
                    total += (pos.entry_price - p) * pos.quantity
        return round(total, 2)

    def _roll_day_if_needed(self):
        today = datetime.now(timezone.utc).date()
        if today != self._today.date:
            self._history.append(self._today)
            self._today = DailyStats(date=today)
            logger.info("Daily stats reset.")
