"""
Market regime detection.
Classifies the current market state to avoid trading in unfavorable conditions.
"""
from utils.types import IndicatorSnapshot, Regime, Side
from config import StrategyConfig
from typing import Optional


def detect_regime(indicators: IndicatorSnapshot, config: StrategyConfig) -> Regime:
    """
    Classify market regime from indicator snapshot.

    Regimes:
    - TRENDING_UP: Clear bullish structure, EMAs aligned, momentum positive
    - TRENDING_DOWN: Clear bearish structure, EMAs aligned, momentum negative
    - RANGING: Price oscillating, no clear direction, EMAs flat
    - CHOPPY: High noise, whipsaws, ATR elevated but no direction
    - HIGH_VOLATILITY: ATR spiking, dangerous for leveraged positions
    """
    if indicators is None:
        return Regime.UNKNOWN

    # High volatility override — most important check
    if indicators.atr_ratio and indicators.atr_ratio > 2.0:
        return Regime.HIGH_VOLATILITY

    # Check for chop: ATR is low AND no EMA alignment
    if indicators.atr_ratio and indicators.atr_ratio < config.chop_atr_ratio_threshold:
        if not indicators.ema_alignment_bull and not indicators.ema_alignment_bear:
            return Regime.CHOPPY

    # Check EMA convergence (ranging)
    if indicators.ema_9 and indicators.ema_21 and indicators.ema_50:
        mid = indicators.ema_21
        spread_9_21 = abs(indicators.ema_9 - indicators.ema_21) / mid
        spread_21_50 = abs(indicators.ema_21 - indicators.ema_50) / mid
        if (spread_9_21 < config.trend_ema_alignment_tolerance and
                spread_21_50 < config.trend_ema_alignment_tolerance):
            return Regime.RANGING

    # Trending detection
    if indicators.ema_alignment_bull:
        if indicators.momentum and indicators.momentum > 0:
            return Regime.TRENDING_UP
    if indicators.ema_alignment_bear:
        if indicators.momentum and indicators.momentum < 0:
            return Regime.TRENDING_DOWN

    # Partial alignment with momentum
    if indicators.ema_9 and indicators.ema_21:
        if indicators.ema_9 > indicators.ema_21 and indicators.momentum and indicators.momentum > 0:
            return Regime.TRENDING_UP
        if indicators.ema_9 < indicators.ema_21 and indicators.momentum and indicators.momentum < 0:
            return Regime.TRENDING_DOWN

    return Regime.RANGING


def determine_higher_tf_bias(indicators: Optional[IndicatorSnapshot]) -> Optional[Side]:
    """
    Determine directional bias from higher timeframe indicators.
    Used as a filter — only trade in direction of higher TF bias.
    """
    if indicators is None:
        return None

    bull_score = 0
    bear_score = 0

    # EMA alignment
    if indicators.ema_alignment_bull:
        bull_score += 2
    elif indicators.ema_alignment_bear:
        bear_score += 2

    # Price vs EMA 50
    if indicators.ema_50 and indicators.ema_9:
        if indicators.ema_9 > indicators.ema_50:
            bull_score += 1
        else:
            bear_score += 1

    # RSI bias
    if indicators.rsi:
        if indicators.rsi > 55:
            bull_score += 1
        elif indicators.rsi < 45:
            bear_score += 1

    # Momentum
    if indicators.momentum:
        if indicators.momentum > 0.1:
            bull_score += 1
        elif indicators.momentum < -0.1:
            bear_score += 1

    if bull_score >= 3 and bull_score > bear_score:
        return Side.LONG
    elif bear_score >= 3 and bear_score > bull_score:
        return Side.SHORT

    return None


def is_extended(indicators: IndicatorSnapshot, side: Side) -> bool:
    """
    Check if price is overextended in the proposed direction.
    Avoid chasing moves that are already exhausted.
    """
    if indicators is None or indicators.rsi is None or indicators.atr is None:
        return False

    if side == Side.LONG:
        # RSI overbought + price far above EMAs
        if indicators.rsi > 75:
            return True
        if indicators.ema_9 and indicators.ema_50:
            deviation = (indicators.ema_9 - indicators.ema_50) / indicators.ema_50
            if deviation > 0.03:  # 3% above EMA50
                return True

    elif side == Side.SHORT:
        if indicators.rsi < 25:
            return True
        if indicators.ema_9 and indicators.ema_50:
            deviation = (indicators.ema_50 - indicators.ema_9) / indicators.ema_50
            if deviation > 0.03:
                return True

    return False
