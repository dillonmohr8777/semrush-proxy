"""
Mean Reversion strategy: Bollinger Bands + Stochastic + RSI.

Entry (BUY):
  - Price touches or breaches lower BB (oversold)
  - Stochastic K < 20 and turning up
  - RSI < 40 and turning up
  - ADX < 25 (low trend = range-bound, good for reversion)

Entry (SELL):
  - Price touches or breaches upper BB (overbought)
  - Stochastic K > 80 and turning down
  - RSI > 60 and turning down

Target: mid BB. Stop: outside 2.5x ATR from entry.
"""
import math
import pandas as pd

from strategies.base import BaseStrategy, Signal, StrategyResult
from config.settings import StrategyConfig


class MeanReversionStrategy(BaseStrategy):
    name = "mean_reversion"

    def __init__(self, cfg: StrategyConfig = None):
        self.cfg = cfg or StrategyConfig()

    def evaluate(self, df: pd.DataFrame, product_id: str) -> StrategyResult:
        if len(df) < 50:
            return StrategyResult(Signal.HOLD, 0.0, self.name, product_id,
                                  self._last(df, "close"), "insufficient data")

        price      = self._last(df, "close")
        price_prev = self._last(df, "close", 2)
        bb_lower   = self._last(df, "bb_lower")
        bb_upper   = self._last(df, "bb_upper")
        bb_mid     = self._last(df, "bb_mid")
        pct_b      = self._last(df, "bb_pct_b")
        rsi_now    = self._last(df, "rsi")
        rsi_prev   = self._last(df, "rsi", 2)
        stoch_k    = self._last(df, "stoch_k")
        stoch_k_p  = self._last(df, "stoch_k", 2)
        adx        = self._last(df, "adx")
        atr        = self._last(df, "atr")

        if any(math.isnan(v) for v in [bb_lower, bb_upper, rsi_now, stoch_k]):
            return StrategyResult(Signal.HOLD, 0.0, self.name, product_id,
                                  price, "nan indicators")

        ranging = adx < 25

        # ── BUY (oversold bounce) ────────────────────────────────────────────
        at_lower_bb   = price <= bb_lower * 1.002
        stoch_turning = stoch_k_p < 20 and stoch_k > stoch_k_p
        rsi_turning   = rsi_prev < 40 and rsi_now > rsi_prev

        if at_lower_bb and stoch_turning and rsi_turning and ranging:
            dist_to_mid = (bb_mid - price) / price
            conf = self._conf(pct_b, rsi_now, stoch_k, dist_to_mid, is_buy=True)
            return StrategyResult(
                Signal.BUY, conf, self.name, product_id, price,
                f"BB lower touch | pct_b={pct_b:.2f} | stoch_k={stoch_k:.1f} | "
                f"RSI={rsi_now:.1f} | ADX={adx:.1f}",
                stop_loss   = price - 2.5 * atr,
                take_profit = bb_mid,
            )

        # ── SELL (overbought fade) ───────────────────────────────────────────
        at_upper_bb      = price >= bb_upper * 0.998
        stoch_turning_dn = stoch_k_p > 80 and stoch_k < stoch_k_p
        rsi_turning_dn   = rsi_prev > 60 and rsi_now < rsi_prev

        if at_upper_bb and stoch_turning_dn and rsi_turning_dn and ranging:
            dist_to_mid = (price - bb_mid) / price
            conf = self._conf(pct_b, rsi_now, stoch_k, dist_to_mid, is_buy=False)
            return StrategyResult(
                Signal.SELL, conf, self.name, product_id, price,
                f"BB upper touch | pct_b={pct_b:.2f} | stoch_k={stoch_k:.1f} | "
                f"RSI={rsi_now:.1f} | ADX={adx:.1f}",
                stop_loss   = price + 2.5 * atr,
                take_profit = bb_mid,
            )

        return StrategyResult(Signal.HOLD, 0.0, self.name, product_id, price,
                              f"BB pct_b={pct_b:.2f} ADX={adx:.1f}")

    def _conf(self, pct_b, rsi, stoch_k, dist, is_buy: bool) -> float:
        if is_buy:
            bb_score = max(0, -pct_b)            # more negative = further below
            rsi_sc   = max(0, (40 - rsi) / 40)
            st_sc    = max(0, (20 - stoch_k) / 20)
        else:
            bb_score = max(0, pct_b - 1.0)
            rsi_sc   = max(0, (rsi - 60) / 40)
            st_sc    = max(0, (stoch_k - 80) / 20)

        dist_score = min(1.0, dist * 20)
        return round(min(1.0, (bb_score + rsi_sc + st_sc + dist_score) / 4 * 1.6), 3)
