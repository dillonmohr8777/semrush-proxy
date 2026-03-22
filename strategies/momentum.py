"""
Momentum strategy: RSI + MACD crossover + EMA trend filter + volume confirmation.

Entry (BUY):
  - RSI crosses up from oversold zone (<35)
  - MACD histogram turns positive (crossover)
  - Price above EMA-long (uptrend filter)
  - Volume > 1.5x 20-period average
  - ADX > 20 (trend is strong, not ranging)

Entry (SELL):
  - RSI crosses down from overbought zone (>65)
  - MACD histogram turns negative (crossunder)
  - Price below EMA-long

Confidence is scaled by RSI extremity, MACD momentum, and volume.
"""
import math
import numpy as np
import pandas as pd

from strategies.base import BaseStrategy, Signal, StrategyResult
from config.settings import StrategyConfig


class MomentumStrategy(BaseStrategy):
    name = "momentum"

    def __init__(self, cfg: StrategyConfig = None):
        self.cfg = cfg or StrategyConfig()

    def evaluate(self, df: pd.DataFrame, product_id: str) -> StrategyResult:
        if len(df) < 50:
            return StrategyResult(Signal.HOLD, 0.0, self.name, product_id,
                                  self._last(df, "close"), "insufficient data")

        price       = self._last(df, "close")
        rsi_now     = self._last(df, "rsi")
        rsi_prev    = self._last(df, "rsi", 2)
        macd_hist   = self._last(df, "macd_hist")
        macd_hist_p = self._last(df, "macd_hist", 2)
        ema_long    = self._last(df, "ema_long")
        vol_ratio   = self._last(df, "vol_ratio")
        adx         = self._last(df, "adx")

        if any(math.isnan(v) for v in [rsi_now, macd_hist, ema_long]):
            return StrategyResult(Signal.HOLD, 0.0, self.name, product_id,
                                  price, "nan indicators")

        trend_up   = price > ema_long
        trend_down = price < ema_long
        high_vol   = vol_ratio >= self.cfg.volume_threshold
        strong_trend = adx > 20

        # ── BUY conditions ──────────────────────────────────────────────────
        rsi_oversold_cross = (rsi_prev < self.cfg.rsi_oversold
                               and rsi_now >= self.cfg.rsi_oversold)
        macd_bullish_cross = (macd_hist_p < 0 and macd_hist >= 0)

        if (rsi_oversold_cross and macd_bullish_cross
                and trend_up and high_vol and strong_trend):
            conf = self._confidence_buy(rsi_now, macd_hist, vol_ratio, adx)
            atr  = self._last(df, "atr")
            return StrategyResult(
                Signal.BUY, conf, self.name, product_id, price,
                f"RSI={rsi_now:.1f} cross up | MACD hist={macd_hist:.2f} cross | "
                f"vol={vol_ratio:.2f}x | ADX={adx:.1f}",
                stop_loss   = price - 2 * atr,
                take_profit = price + 3 * atr,
            )

        # ── SELL conditions ─────────────────────────────────────────────────
        rsi_overbought_cross = (rsi_prev > self.cfg.rsi_overbought
                                 and rsi_now <= self.cfg.rsi_overbought)
        macd_bearish_cross   = (macd_hist_p > 0 and macd_hist <= 0)

        if (rsi_overbought_cross and macd_bearish_cross and trend_down):
            conf = self._confidence_sell(rsi_now, macd_hist, vol_ratio, adx)
            atr  = self._last(df, "atr")
            return StrategyResult(
                Signal.SELL, conf, self.name, product_id, price,
                f"RSI={rsi_now:.1f} cross down | MACD hist={macd_hist:.2f} cross | "
                f"vol={vol_ratio:.2f}x",
                stop_loss   = price + 2 * atr,
                take_profit = price - 3 * atr,
            )

        return StrategyResult(Signal.HOLD, 0.0, self.name, product_id, price,
                              f"RSI={rsi_now:.1f} MACD={macd_hist:.4f}")

    def _confidence_buy(self, rsi, macd_hist, vol_ratio, adx) -> float:
        rsi_score  = max(0, (self.cfg.rsi_oversold - rsi) / self.cfg.rsi_oversold)
        macd_score = min(1.0, abs(macd_hist) / 100)
        vol_score  = min(1.0, (vol_ratio - 1.0) / 2.0)
        adx_score  = min(1.0, (adx - 20) / 30)
        return round(min(1.0, (rsi_score + macd_score + vol_score + adx_score) / 4
                         * 1.8), 3)

    def _confidence_sell(self, rsi, macd_hist, vol_ratio, adx) -> float:
        rsi_score  = max(0, (rsi - self.cfg.rsi_overbought) /
                         (100 - self.cfg.rsi_overbought))
        macd_score = min(1.0, abs(macd_hist) / 100)
        vol_score  = min(1.0, (vol_ratio - 1.0) / 2.0)
        adx_score  = min(1.0, (adx - 20) / 30)
        return round(min(1.0, (rsi_score + macd_score + vol_score + adx_score) / 4
                         * 1.8), 3)
