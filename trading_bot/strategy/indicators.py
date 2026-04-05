"""
Technical indicator calculations.
All functions are pure — they take candle lists and return values.
No side effects, fully testable.
"""
from typing import List, Optional
from utils.types import Candle, IndicatorSnapshot


def ema(values: List[float], period: int) -> List[float]:
    """Exponential Moving Average. Returns list same length as input (NaN-padded)."""
    if len(values) < period:
        return [None] * len(values)

    k = 2.0 / (period + 1)
    result = [None] * (period - 1)

    # Seed with SMA
    sma = sum(values[:period]) / period
    result.append(sma)

    for i in range(period, len(values)):
        val = values[i] * k + result[-1] * (1 - k)
        result.append(val)

    return result


def rsi(closes: List[float], period: int = 14) -> List[Optional[float]]:
    """Relative Strength Index using Wilder's smoothing."""
    if len(closes) < period + 1:
        return [None] * len(closes)

    result = [None] * period
    gains = []
    losses = []

    for i in range(1, len(closes)):
        delta = closes[i] - closes[i - 1]
        gains.append(max(delta, 0))
        losses.append(max(-delta, 0))

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    if avg_loss == 0:
        result.append(100.0)
    else:
        rs = avg_gain / avg_loss
        result.append(100 - 100 / (1 + rs))

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        if avg_loss == 0:
            result.append(100.0)
        else:
            rs = avg_gain / avg_loss
            result.append(100 - 100 / (1 + rs))

    return result


def atr(candles: List[Candle], period: int = 14) -> List[Optional[float]]:
    """Average True Range."""
    if len(candles) < period + 1:
        return [None] * len(candles)

    true_ranges = [candles[0].range]
    for i in range(1, len(candles)):
        tr = max(
            candles[i].high - candles[i].low,
            abs(candles[i].high - candles[i - 1].close),
            abs(candles[i].low - candles[i - 1].close),
        )
        true_ranges.append(tr)

    result = [None] * (period - 1)
    # Seed with SMA of TR
    avg_tr = sum(true_ranges[:period]) / period
    result.append(avg_tr)

    for i in range(period, len(true_ranges)):
        avg_tr = (avg_tr * (period - 1) + true_ranges[i]) / period
        result.append(avg_tr)

    return result


def momentum(closes: List[float], period: int = 5) -> Optional[float]:
    """Short-term momentum as percentage change over N periods."""
    if len(closes) < period + 1:
        return None
    return (closes[-1] - closes[-period - 1]) / closes[-period - 1] * 100


def volume_ratio(volumes: List[float], period: int = 20) -> Optional[float]:
    """Current volume vs rolling average volume."""
    if len(volumes) < period + 1:
        return None
    avg_vol = sum(volumes[-period - 1:-1]) / period
    if avg_vol == 0:
        return None
    return volumes[-1] / avg_vol


def compute_indicators(candles: List[Candle], ema_fast: int = 9,
                       ema_mid: int = 21, ema_slow: int = 50,
                       ema_trend: int = 200, rsi_period: int = 14,
                       atr_period: int = 14) -> Optional[IndicatorSnapshot]:
    """Compute all indicators for a list of candles, return latest snapshot."""
    if len(candles) < max(ema_mid, rsi_period, atr_period) + 1:
        return None

    closes = [c.close for c in candles]
    volumes = [c.volume for c in candles]

    ema_9_vals = ema(closes, ema_fast)
    ema_21_vals = ema(closes, ema_mid)
    ema_50_vals = ema(closes, ema_slow)
    ema_200_vals = ema(closes, ema_trend) if len(closes) >= ema_trend else [None] * len(closes)
    rsi_vals = rsi(closes, rsi_period)
    atr_vals = atr(candles, atr_period)

    snap = IndicatorSnapshot()
    snap.ema_9 = ema_9_vals[-1]
    snap.ema_21 = ema_21_vals[-1]
    snap.ema_50 = ema_50_vals[-1] if ema_50_vals[-1] is not None else None
    snap.ema_200 = ema_200_vals[-1]
    snap.rsi = rsi_vals[-1]
    snap.atr = atr_vals[-1]

    if snap.atr and closes[-1] > 0:
        snap.atr_pct = snap.atr / closes[-1] * 100

    # ATR ratio: current ATR vs rolling average ATR (to detect vol expansion)
    valid_atrs = [a for a in atr_vals if a is not None]
    if len(valid_atrs) >= 20:
        avg_atr = sum(valid_atrs[-20:]) / 20
        snap.atr_ratio = snap.atr / avg_atr if avg_atr > 0 else 1.0
    else:
        snap.atr_ratio = 1.0

    snap.volume_ratio = volume_ratio(volumes)
    snap.momentum = momentum(closes)

    # EMA alignment checks
    if snap.ema_9 and snap.ema_21 and snap.ema_50:
        snap.ema_alignment_bull = snap.ema_9 > snap.ema_21 > snap.ema_50
        snap.ema_alignment_bear = snap.ema_9 < snap.ema_21 < snap.ema_50

    return snap
