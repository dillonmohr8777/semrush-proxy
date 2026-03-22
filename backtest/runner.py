"""
Backtesting engine.
Replays historical OHLCV data through the full strategy + risk stack.
Produces trade log, equity curve, and performance metrics.
"""
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime, timezone

import pandas as pd
import numpy as np

from data.indicators import compute_all
from strategies.ensemble import EnsembleStrategy
from strategies.base import Signal
from config.settings import StrategyConfig, RiskConfig, STARTING_CAPITAL

logger = logging.getLogger(__name__)


@dataclass
class BacktestTrade:
    product_id:  str
    side:        str
    entry_price: float
    exit_price:  float
    quantity:    float
    size_usd:    float
    pnl:         float
    pnl_pct:     float
    strategy:    str
    reason_open: str
    reason_close:str
    entry_time:  datetime
    exit_time:   datetime
    bars_held:   int


@dataclass
class BacktestResult:
    product_id:      str
    granularity:     str
    start_date:      str
    end_date:        str
    starting_capital:float
    ending_capital:  float
    total_return_pct:float
    trades:          List[BacktestTrade]
    equity_curve:    List[float]    # capital at each bar
    metrics:         Dict = field(default_factory=dict)

    def summary(self) -> Dict:
        closed = [t for t in self.trades]
        wins   = [t for t in closed if t.pnl > 0]
        losses = [t for t in closed if t.pnl <= 0]
        pnls   = [t.pnl for t in closed]

        max_dd  = self._max_drawdown()
        sharpe  = self._sharpe()

        return {
            "product_id":        self.product_id,
            "period":            f"{self.start_date} → {self.end_date}",
            "starting_capital":  self.starting_capital,
            "ending_capital":    round(self.ending_capital, 2),
            "total_return_pct":  round(self.total_return_pct, 2),
            "total_trades":      len(closed),
            "win_rate":          round(len(wins) / max(len(closed), 1) * 100, 1),
            "avg_pnl":           round(np.mean(pnls) if pnls else 0, 2),
            "max_win":           round(max(pnls) if pnls else 0, 2),
            "max_loss":          round(min(pnls) if pnls else 0, 2),
            "profit_factor":     self._profit_factor(wins, losses),
            "max_drawdown_pct":  round(max_dd, 2),
            "sharpe_ratio":      round(sharpe, 3),
            "total_pnl":         round(sum(pnls), 2),
        }

    def _max_drawdown(self) -> float:
        curve = np.array(self.equity_curve)
        if len(curve) < 2:
            return 0.0
        peak  = np.maximum.accumulate(curve)
        dd    = (curve - peak) / np.where(peak > 0, peak, 1) * 100
        return float(abs(dd.min()))

    def _sharpe(self, risk_free: float = 0.05) -> float:
        curve = np.array(self.equity_curve)
        if len(curve) < 2:
            return 0.0
        returns = np.diff(curve) / np.where(curve[:-1] > 0, curve[:-1], 1)
        if returns.std() == 0:
            return 0.0
        annualized = returns.mean() * 365 - risk_free
        return annualized / (returns.std() * np.sqrt(365))

    def _profit_factor(self, wins, losses) -> float:
        gross_win  = sum(t.pnl for t in wins)
        gross_loss = abs(sum(t.pnl for t in losses))
        return round(gross_win / gross_loss, 2) if gross_loss > 0 else float("inf")


class Backtester:
    FEE_RATE = 0.006   # 0.6% round-trip per leg
    SLIPPAGE = 0.0005  # 0.05% per fill

    def __init__(self, strategy_cfg: StrategyConfig = None,
                 risk_cfg: RiskConfig = None,
                 starting_capital: float = STARTING_CAPITAL,
                 min_votes: int = 2):
        self.strategy_cfg = strategy_cfg or StrategyConfig()
        self.risk_cfg     = risk_cfg or RiskConfig()
        self.capital      = starting_capital
        self.starting     = starting_capital
        self.min_votes    = min_votes
        self.ensemble     = EnsembleStrategy(self.strategy_cfg, min_votes)

    def run(self, df: pd.DataFrame, product_id: str,
            granularity: str = "1h") -> BacktestResult:
        """
        df: raw OHLCV DataFrame (index=DatetimeIndex, cols: open/high/low/close/volume)
        """
        logger.info(f"Backtesting {product_id} over {len(df)} bars…")
        df = compute_all(df.copy(), **self._indicator_kwargs())
        df = df.dropna()

        trades:       List[BacktestTrade] = []
        equity_curve: List[float]         = [self.capital]
        open_pos: Optional[Dict]          = None
        self.capital = self.starting

        for i in range(50, len(df)):
            window    = df.iloc[:i + 1]
            row       = df.iloc[i]
            price     = float(row["close"])
            high      = float(row["high"])
            low       = float(row["low"])
            atr_val   = float(row.get("atr", price * 0.02))
            bar_time  = df.index[i]

            # ── Check exit conditions ────────────────────────────────────────
            if open_pos:
                exit_reason = self._check_exit(open_pos, high, low, price)
                if exit_reason:
                    exit_price = self._exit_price(open_pos, high, low, price)
                    trade = self._close_trade(open_pos, exit_price, bar_time,
                                              i - open_pos["bar"], exit_reason)
                    trades.append(trade)
                    self.capital += open_pos["size_usd"] + trade.pnl
                    open_pos = None

            # ── Check entry signals ──────────────────────────────────────────
            if open_pos is None:
                result = self.ensemble.evaluate(window, product_id)
                if result and result.signal != Signal.HOLD:
                    # Risk checks
                    if self.capital < self.risk_cfg.min_trade_usd:
                        continue
                    if self._daily_loss_exceeded():
                        continue

                    fill_price = price * (
                        1 + self.SLIPPAGE if result.signal == Signal.BUY
                        else 1 - self.SLIPPAGE
                    )
                    size_usd = min(
                        self.capital * self.risk_cfg.max_position_pct,
                        self.risk_cfg.max_trade_usd,
                        self._kelly_size(result.confidence, price, atr_val),
                    )
                    size_usd = max(size_usd, self.risk_cfg.min_trade_usd)
                    fee      = size_usd * self.FEE_RATE
                    quantity = (size_usd - fee) / fill_price

                    self.capital -= size_usd

                    open_pos = {
                        "product_id":  product_id,
                        "side":        result.signal.value,
                        "entry_price": fill_price,
                        "quantity":    quantity,
                        "size_usd":    size_usd,
                        "stop_loss":   result.stop_loss,
                        "take_profit": result.take_profit,
                        "trailing":    (fill_price * (1 - self.risk_cfg.trailing_stop_pct)
                                        if result.signal == Signal.BUY
                                        else fill_price * (1 + self.risk_cfg.trailing_stop_pct)),
                        "highest":     fill_price,
                        "lowest":      fill_price,
                        "strategy":    result.strategy,
                        "reason":      result.reason,
                        "entry_time":  bar_time,
                        "bar":         i,
                    }

            # Update trailing stop
            if open_pos:
                self._update_trailing(open_pos, high, low)

            equity_curve.append(self.capital + (
                (price - open_pos["entry_price"]) * open_pos["quantity"]
                if open_pos else 0
            ))

        # Close any remaining position at end of data
        if open_pos:
            last_price = float(df.iloc[-1]["close"])
            trade = self._close_trade(open_pos, last_price, df.index[-1],
                                      len(df) - 1 - open_pos["bar"], "end_of_data")
            trades.append(trade)
            self.capital += open_pos["size_usd"] + trade.pnl

        total_ret = (self.capital - self.starting) / self.starting * 100
        return BacktestResult(
            product_id       = product_id,
            granularity      = granularity,
            start_date       = str(df.index[0])[:10],
            end_date         = str(df.index[-1])[:10],
            starting_capital = self.starting,
            ending_capital   = self.capital,
            total_return_pct = total_ret,
            trades           = trades,
            equity_curve     = equity_curve,
        )

    # ─── Helpers ─────────────────────────────────────────────────────────────

    def _check_exit(self, pos: Dict, high: float, low: float, close: float) -> Optional[str]:
        if pos["side"] == "BUY":
            if pos["stop_loss"] and low <= pos["stop_loss"]:
                return "stop_loss"
            if pos.get("trailing") and low <= pos["trailing"]:
                return "trailing_stop"
            if pos["take_profit"] and high >= pos["take_profit"]:
                return "take_profit"
        else:
            if pos["stop_loss"] and high >= pos["stop_loss"]:
                return "stop_loss"
            if pos.get("trailing") and high >= pos["trailing"]:
                return "trailing_stop"
            if pos["take_profit"] and low <= pos["take_profit"]:
                return "take_profit"
        return None

    def _exit_price(self, pos: Dict, high: float, low: float, close: float) -> float:
        if pos["side"] == "BUY":
            if pos["stop_loss"] and low <= pos["stop_loss"]:
                return pos["stop_loss"] * (1 - self.SLIPPAGE)
            if pos["take_profit"] and high >= pos["take_profit"]:
                return pos["take_profit"] * (1 - self.SLIPPAGE)
        else:
            if pos["stop_loss"] and high >= pos["stop_loss"]:
                return pos["stop_loss"] * (1 + self.SLIPPAGE)
            if pos["take_profit"] and low <= pos["take_profit"]:
                return pos["take_profit"] * (1 + self.SLIPPAGE)
        return close * (1 - self.SLIPPAGE if pos["side"] == "BUY" else 1 + self.SLIPPAGE)

    def _close_trade(self, pos: Dict, exit_price: float,
                     exit_time, bars_held: int, reason: str) -> BacktestTrade:
        fee = pos["size_usd"] * self.FEE_RATE
        if pos["side"] == "BUY":
            pnl = (exit_price - pos["entry_price"]) * pos["quantity"] - fee
        else:
            pnl = (pos["entry_price"] - exit_price) * pos["quantity"] - fee
        pnl_pct = pnl / pos["size_usd"] * 100
        return BacktestTrade(
            product_id   = pos["product_id"],
            side         = pos["side"],
            entry_price  = pos["entry_price"],
            exit_price   = exit_price,
            quantity     = pos["quantity"],
            size_usd     = pos["size_usd"],
            pnl          = pnl,
            pnl_pct      = pnl_pct,
            strategy     = pos["strategy"],
            reason_open  = pos["reason"],
            reason_close = reason,
            entry_time   = pos["entry_time"],
            exit_time    = exit_time,
            bars_held    = bars_held,
        )

    def _update_trailing(self, pos: Dict, high: float, low: float):
        if pos["side"] == "BUY":
            if high > pos["highest"]:
                pos["highest"] = high
                new_trail = high * (1 - self.risk_cfg.trailing_stop_pct)
                if new_trail > pos["trailing"]:
                    pos["trailing"] = new_trail
        else:
            if low < pos["lowest"]:
                pos["lowest"] = low
                new_trail = low * (1 + self.risk_cfg.trailing_stop_pct)
                if new_trail < pos["trailing"]:
                    pos["trailing"] = new_trail

    def _kelly_size(self, confidence: float, price: float, atr: float) -> float:
        win_prob  = min(0.65, max(0.35, confidence))
        kelly     = max(0, (win_prob * self.risk_cfg.take_profit_pct
                            - (1 - win_prob) * self.risk_cfg.stop_loss_pct)
                        / self.risk_cfg.take_profit_pct)
        kelly    *= self.risk_cfg.kelly_fraction
        vol_scale = 1.0 / max(0.5, min(2.0, (atr / price) / 0.02))
        return self.capital * kelly * vol_scale

    def _daily_loss_exceeded(self) -> bool:
        return False  # simplified for backtester (no intra-day tracking)

    def _indicator_kwargs(self) -> Dict:
        c = self.strategy_cfg
        return dict(
            rsi_period       = c.rsi_period,
            macd_fast        = c.macd_fast,
            macd_slow        = c.macd_slow,
            macd_signal      = c.macd_signal,
            bb_period        = c.bb_period,
            bb_stddev        = c.bb_stddev,
            ema_short        = c.ema_short,
            ema_long         = c.ema_long,
            atr_period       = c.atr_period,
            volume_ma_period = c.volume_ma_period,
        )
