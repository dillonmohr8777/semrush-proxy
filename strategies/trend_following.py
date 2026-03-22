"""
Trend Following strategy: EMA crossover + ADX + VWAP.

Entry (BUY):
  - EMA-9 crosses above EMA-21
  - Price above VWAP
  - ADX > 25 (trending)
  - Volume above average

Entry (SELL):
  - EMA-9 crosses below EMA-21
  - Price below VWAP
  - ADX > 25

Higher timeframe bias gives bigger confidence.
"""
import math
import pandas as pd

from strategies.base import BaseStrategy, Signal, StrategyResult
from config.settings import StrategyConfig


class TrendFollowingStrategy(BaseStrategy):
    name = "trend_following"

    def __init__(self, cfg: StrategyConfig = None):
        self.cfg = cfg or StrategyConfig()

    def evaluate(self, df: pd.DataFrame, product_id: str) -> StrategyResult:
        if len(df) < 50:
            return StrategyResult(Signal.HOLD, 0.0, self.name, product_id,
                                  self._last(df, "close"), "insufficient data")

        price       = self._last(df, "close")
        ema_s       = self._last(df, "ema_short")
        ema_s_prev  = self._last(df, "ema_short", 2)
        ema_l       = self._last(df, "ema_long")
        ema_l_prev  = self._last(df, "ema_long", 2)
        vwap        = self._last(df, "vwap")
        adx         = self._last(df, "adx")
        vol_ratio   = self._last(df, "vol_ratio")
        atr         = self._last(df, "atr")

        if any(math.isnan(v) for v in [ema_s, ema_l, vwap, adx]):
            return StrategyResult(Signal.HOLD, 0.0, self.name, product_id,
                                  price, "nan indicators")

        trending   = adx > 25
        high_vol   = vol_ratio >= self.cfg.volume_threshold

        # Golden cross
        bull_cross = ema_s_prev <= ema_l_prev and ema_s > ema_l
        above_vwap = price > vwap

        if bull_cross and above_vwap and trending and high_vol:
            conf = self._conf(adx, vol_ratio, (ema_s - ema_l) / ema_l)
            return StrategyResult(
                Signal.BUY, conf, self.name, product_id, price,
                f"EMA cross up | ADX={adx:.1f} | VWAP={vwap:.2f} | vol={vol_ratio:.2f}x",
                stop_loss   = price - 2 * atr,
                take_profit = price + 4 * atr,
            )

        # Death cross
        bear_cross  = ema_s_prev >= ema_l_prev and ema_s < ema_l
        below_vwap  = price < vwap

        if bear_cross and below_vwap and trending:
            conf = self._conf(adx, vol_ratio, (ema_l - ema_s) / ema_l)
            return StrategyResult(
                Signal.SELL, conf, self.name, product_id, price,
                f"EMA cross down | ADX={adx:.1f} | VWAP={vwap:.2f}",
                stop_loss   = price + 2 * atr,
                take_profit = price - 4 * atr,
            )

        return StrategyResult(Signal.HOLD, 0.0, self.name, product_id, price,
                              f"EMA spread={(ema_s-ema_l)/ema_l*100:.2f}% ADX={adx:.1f}")

    def _conf(self, adx, vol_ratio, spread_pct) -> float:
        adx_score  = min(1.0, (adx - 25) / 25)
        vol_score  = min(1.0, (vol_ratio - 1.0) / 2.0)
        sprd_score = min(1.0, abs(spread_pct) * 50)
        return round(min(1.0, (adx_score + vol_score + sprd_score) / 3 * 1.5), 3)
