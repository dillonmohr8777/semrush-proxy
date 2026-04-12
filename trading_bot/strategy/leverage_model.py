"""
Leverage modeling and liquidation estimation.
Conservative by design — leverage is a tool, not a weapon.
"""
from utils.types import Side, IndicatorSnapshot, Regime
from config import LeverageConfig, StrategyConfig


def select_leverage(confidence: float, regime: Regime, indicators: IndicatorSnapshot,
                    symbol: str, config: LeverageConfig,
                    strategy_config: StrategyConfig) -> float:
    """
    Select appropriate leverage based on:
    1. Signal confidence
    2. Market regime / volatility
    3. Asset-specific limits
    4. ATR conditions

    Higher confidence + lower volatility = higher leverage allowed.
    Weak signals or high vol = reduce leverage aggressively.
    """
    # Start with default
    lev = config.default_leverage

    # Asset-specific cap
    max_lev = config.asset_max_leverage.get(symbol, config.max_leverage)

    # Confidence-based adjustment — scale up to max leverage
    if confidence >= 0.85:
        lev = min(max_lev, 10.0)
    elif confidence >= 0.75:
        lev = min(max_lev, 7.0)
    elif confidence >= 0.65:
        lev = min(max_lev, 5.0)
    elif confidence >= 0.55:
        lev = min(max_lev, 3.0)
    else:
        lev = 2.0  # Weak signal — minimal leverage

    # Volatility reduction — only cut leverage in extreme conditions
    if indicators and indicators.atr_ratio:
        if indicators.atr_ratio > 2.0:
            # Extreme vol: reduce leverage moderately
            reduction = indicators.atr_ratio / 2.0
            lev = max(2.0, lev / reduction)

    # Regime-based caps — still allow meaningful leverage
    if regime == Regime.HIGH_VOLATILITY:
        lev = min(lev, 3.0)
    elif regime == Regime.CHOPPY:
        lev = min(lev, 3.0)
    elif regime == Regime.RANGING:
        lev = min(lev, 7.0)

    # Snap to nearest tier
    lev = _snap_to_tier(lev, config.leverage_tiers)

    return min(lev, max_lev)


def _snap_to_tier(lev: float, tiers: list) -> float:
    """Snap leverage down to the nearest allowed tier."""
    valid = [t for t in sorted(tiers) if t <= lev + 0.01]
    return valid[-1] if valid else tiers[0]


def estimate_liquidation_price(entry_price: float, side: Side,
                                leverage: float, buffer_pct: float = 2.0) -> float:
    """
    Estimate liquidation price for isolated margin.

    For LONG: liquidation when price drops enough to lose margin
      liq_price = entry * (1 - 1/leverage + buffer)
    For SHORT: liquidation when price rises enough
      liq_price = entry * (1 + 1/leverage - buffer)

    Buffer adds safety margin above exchange liquidation.
    """
    margin_fraction = 1.0 / leverage
    buffer = buffer_pct / 100.0

    if side == Side.LONG:
        # Liquidation below entry
        liq = entry_price * (1 - margin_fraction + buffer)
        return max(0, liq)
    else:
        # Liquidation above entry
        liq = entry_price * (1 + margin_fraction - buffer)
        return liq


def liquidation_distance_pct(entry_price: float, liquidation_price: float,
                              side: Side) -> float:
    """How far (%) is the liquidation price from entry."""
    if side == Side.LONG:
        return (entry_price - liquidation_price) / entry_price * 100
    else:
        return (liquidation_price - entry_price) / entry_price * 100


def is_liquidation_safe(entry_price: float, stop_loss: float,
                        liquidation_price: float, side: Side,
                        min_distance_pct: float = 10.0) -> bool:
    """
    Check that:
    1. Stop loss would trigger BEFORE liquidation
    2. Liquidation is at least min_distance_pct away from entry
    """
    liq_dist = liquidation_distance_pct(entry_price, liquidation_price, side)

    if liq_dist < min_distance_pct:
        return False

    # Ensure stop is closer to entry than liquidation
    if side == Side.LONG:
        return stop_loss > liquidation_price
    else:
        return stop_loss < liquidation_price


def max_leverage_for_stop(entry_price: float, stop_loss: float,
                           side: Side, min_liq_buffer_pct: float = 5.0) -> float:
    """
    Calculate the maximum safe leverage given a stop loss level.
    Ensures liquidation price is beyond stop with buffer.
    """
    if side == Side.LONG:
        stop_distance = (entry_price - stop_loss) / entry_price
    else:
        stop_distance = (stop_loss - entry_price) / entry_price

    if stop_distance <= 0:
        return 1.0

    # Liquidation distance must be greater than stop distance + buffer
    required_liq_distance = stop_distance + min_liq_buffer_pct / 100.0

    # liq_distance = 1/leverage, so leverage = 1/required_distance
    max_lev = 1.0 / required_liq_distance if required_liq_distance > 0 else 1.0
    return max(1.0, max_lev)
