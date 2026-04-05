"""
Technical indicators computed from candle data.
"""

from utils.types import Candle, Indicators
from utils.logger import get_logger

logger = get_logger("indicators")


def ema(values: list[float], period: int) -> list[float]:
    """Compute Exponential Moving Average over a list of values."""
    if len(values) < period:
        return [values[-1]] * len(values) if values else []

    multiplier = 2.0 / (period + 1)
    result = [0.0] * len(values)

    # Seed with SMA of first `period` values
    result[period - 1] = sum(values[:period]) / period

    for i in range(period, len(values)):
        result[i] = (values[i] - result[i - 1]) * multiplier + result[i - 1]

    # Fill earlier slots with the seed value for convenience
    for i in range(period - 1):
        result[i] = result[period - 1]

    return result


def rsi(closes: list[float], period: int = 14) -> float:
    """Compute RSI from close prices. Returns the most recent RSI value."""
    if len(closes) < period + 1:
        return 50.0  # neutral default

    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]

    gains = [d if d > 0 else 0.0 for d in deltas]
    losses = [-d if d < 0 else 0.0 for d in deltas]

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def atr(candles: list[Candle], period: int = 14) -> float:
    """Compute Average True Range. Returns the most recent ATR value."""
    if len(candles) < 2:
        return 0.0

    true_ranges = []
    for i in range(1, len(candles)):
        high = candles[i].high
        low = candles[i].low
        prev_close = candles[i - 1].close
        tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
        true_ranges.append(tr)

    if len(true_ranges) < period:
        return sum(true_ranges) / len(true_ranges) if true_ranges else 0.0

    # Wilder's smoothing
    current_atr = sum(true_ranges[:period]) / period
    for i in range(period, len(true_ranges)):
        current_atr = (current_atr * (period - 1) + true_ranges[i]) / period

    return current_atr


def momentum(closes: list[float], lookback: int = 5) -> float:
    """Short-term momentum as percentage rate of change."""
    if len(closes) < lookback + 1:
        return 0.0
    old = closes[-(lookback + 1)]
    if old == 0:
        return 0.0
    return ((closes[-1] - old) / old) * 100.0


def compute_indicators(
    candles: list[Candle],
    order_book_imbalance: float,
) -> Indicators:
    """Compute all indicators from candle data and order book state."""
    closes = [c.close for c in candles]

    ema_9_vals = ema(closes, 9)
    ema_21_vals = ema(closes, 21)
    ema_50_vals = ema(closes, 50)

    return Indicators(
        ema_9=ema_9_vals[-1] if ema_9_vals else closes[-1],
        ema_21=ema_21_vals[-1] if ema_21_vals else closes[-1],
        ema_50=ema_50_vals[-1] if ema_50_vals else closes[-1],
        rsi_14=rsi(closes, 14),
        atr_14=atr(candles, 14),
        order_book_imbalance=order_book_imbalance,
        momentum=momentum(closes, 5),
    )
