"""
Signal engine — evaluates market data and produces trade signals.

Scoring rubric (out of 100):
  - EMA alignment:        0-25 points
  - RSI confirmation:     0-20 points
  - Order book imbalance: 0-15 points
  - Momentum:             0-20 points
  - ATR quality:          0-10 points
  - Risk/reward quality:  0-10 points
"""

from datetime import datetime

from config import RiskConfig
from utils.types import Candle, Indicators, Signal, Bias
from strategy.indicators import compute_indicators
from utils.logger import get_logger

logger = get_logger("signal_engine")


def _score_long(ind: Indicators, price: float) -> float:
    score = 0.0

    # EMA alignment: price > EMA9 > EMA21 > EMA50
    if price > ind.ema_9:
        score += 8
    if ind.ema_9 > ind.ema_21:
        score += 9
    if ind.ema_21 > ind.ema_50:
        score += 8

    # RSI: bullish zone 40-70 is ideal; >70 overbought penalty
    if 40 <= ind.rsi_14 <= 70:
        score += 20
    elif 30 <= ind.rsi_14 < 40:
        score += 10
    elif ind.rsi_14 > 70:
        score += 5  # overbought

    # Order book imbalance: positive = more bids
    if ind.order_book_imbalance > 0.2:
        score += 15
    elif ind.order_book_imbalance > 0.05:
        score += 10
    elif ind.order_book_imbalance > -0.05:
        score += 5

    # Momentum: positive is bullish
    if ind.momentum > 1.0:
        score += 20
    elif ind.momentum > 0.3:
        score += 14
    elif ind.momentum > 0:
        score += 8

    # ATR quality: not too low, not too high (relative to price)
    atr_pct = (ind.atr_14 / price) * 100 if price > 0 else 0
    if 0.3 <= atr_pct <= 3.0:
        score += 10
    elif 0.1 <= atr_pct <= 5.0:
        score += 5

    return score


def _score_short(ind: Indicators, price: float) -> float:
    score = 0.0

    # EMA alignment: price < EMA9 < EMA21 < EMA50
    if price < ind.ema_9:
        score += 8
    if ind.ema_9 < ind.ema_21:
        score += 9
    if ind.ema_21 < ind.ema_50:
        score += 8

    # RSI: bearish zone 30-60
    if 30 <= ind.rsi_14 <= 60:
        score += 20
    elif 60 < ind.rsi_14 <= 70:
        score += 10
    elif ind.rsi_14 < 30:
        score += 5  # oversold

    # Order book imbalance: negative = more asks
    if ind.order_book_imbalance < -0.2:
        score += 15
    elif ind.order_book_imbalance < -0.05:
        score += 10
    elif ind.order_book_imbalance < 0.05:
        score += 5

    # Momentum: negative is bearish
    if ind.momentum < -1.0:
        score += 20
    elif ind.momentum < -0.3:
        score += 14
    elif ind.momentum < 0:
        score += 8

    # ATR quality
    atr_pct = (ind.atr_14 / price) * 100 if price > 0 else 0
    if 0.3 <= atr_pct <= 3.0:
        score += 10
    elif 0.1 <= atr_pct <= 5.0:
        score += 5

    return score


def evaluate(
    asset: str,
    candles: list[Candle],
    order_book_imbalance: float,
    risk_config: RiskConfig,
) -> Signal:
    """
    Evaluate candles + order book for a single asset and produce a Signal.
    """
    if len(candles) < 50:
        logger.warning("%s: not enough candles (%d), need >= 50", asset, len(candles))
        price = candles[-1].close if candles else 0.0
        ind = compute_indicators(candles, order_book_imbalance) if candles else Indicators(
            ema_9=0, ema_21=0, ema_50=0, rsi_14=50, atr_14=0,
            order_book_imbalance=0, momentum=0,
        )
        return Signal(
            asset=asset, bias=Bias.NO_TRADE, confidence=0,
            entry=price, stop_loss=price, target=price,
            risk_reward=0, indicators=ind,
        )

    ind = compute_indicators(candles, order_book_imbalance)
    price = candles[-1].close
    atr_val = ind.atr_14

    long_score = _score_long(ind, price)
    short_score = _score_short(ind, price)

    # Determine bias
    if long_score >= short_score and long_score >= risk_config.confidence_threshold:
        bias = Bias.LONG
        confidence = long_score
        stop_loss = price - 1.5 * atr_val
        target = price + 1.5 * atr_val * risk_config.min_risk_reward
    elif short_score > long_score and short_score >= risk_config.confidence_threshold:
        bias = Bias.SHORT
        confidence = short_score
        stop_loss = price + 1.5 * atr_val
        target = price - 1.5 * atr_val * risk_config.min_risk_reward
    else:
        bias = Bias.NO_TRADE
        confidence = max(long_score, short_score)
        stop_loss = price
        target = price

    # Risk/reward ratio
    risk_distance = abs(price - stop_loss)
    reward_distance = abs(target - price)
    rr = reward_distance / risk_distance if risk_distance > 0 else 0.0

    # Bonus for risk/reward quality
    if rr >= risk_config.min_risk_reward:
        confidence = min(confidence + 10, 100)

    return Signal(
        asset=asset,
        bias=bias,
        confidence=confidence,
        entry=price,
        stop_loss=round(stop_loss, 2),
        target=round(target, 2),
        risk_reward=round(rr, 2),
        indicators=ind,
    )
