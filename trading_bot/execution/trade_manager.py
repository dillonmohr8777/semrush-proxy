"""
Trade manager: handles open position lifecycle.
Stop loss, take profit, trailing stops, breakeven, time exits, volatility exits.
"""
from typing import List, Optional, Tuple
from utils.types import Position, Side, ExitReason, IndicatorSnapshot
from config import StrategyConfig


class TradeManager:
    def __init__(self, config: StrategyConfig):
        self.cfg = config

    def manage_position(self, position: Position, current_price: float,
                        indicators: Optional[IndicatorSnapshot]) -> Tuple[Optional[ExitReason], Optional[float]]:
        """
        Evaluate an open position against current conditions.
        Returns (exit_reason, exit_price) if position should be closed, else (None, None).
        Checks are ordered by priority.
        """
        position.candles_held += 1

        # Track extremes for trailing stop
        if position.side == Side.LONG:
            if current_price > position.highest_price:
                position.highest_price = current_price
        else:
            if position.lowest_price == 0 or current_price < position.lowest_price:
                position.lowest_price = current_price

        # Mark to market
        position.mark_to_market(current_price)

        # 1. Liquidation check (critical — before anything else)
        if position.is_liquidated(current_price):
            return ExitReason.LIQUIDATION, current_price

        # 2. Stop loss
        if position.side == Side.LONG and current_price <= position.stop_loss:
            return ExitReason.STOP_LOSS, position.stop_loss
        if position.side == Side.SHORT and current_price >= position.stop_loss:
            return ExitReason.STOP_LOSS, position.stop_loss

        # 3. Take profit
        if position.side == Side.LONG and current_price >= position.take_profit:
            return ExitReason.TAKE_PROFIT, position.take_profit
        if position.side == Side.SHORT and current_price <= position.take_profit:
            return ExitReason.TAKE_PROFIT, position.take_profit

        # 4. Volatility spike exit
        if indicators and indicators.atr_ratio and indicators.atr_ratio > 2.5:
            # Extreme vol — protect capital
            return ExitReason.VOLATILITY_SPIKE, current_price

        # 5. Momentum reversal exit
        exit_reason = self._check_momentum_reversal(position, indicators)
        if exit_reason:
            return exit_reason, current_price

        # 6. Time-based exit
        if position.candles_held >= self.cfg.max_trade_duration_candles:
            return ExitReason.TIME_EXIT, current_price

        # 7. Move stop to breakeven (doesn't close, just adjusts)
        self._check_breakeven(position, current_price, indicators)

        # 8. Trailing stop update
        exit_reason = self._check_trailing_stop(position, current_price, indicators)
        if exit_reason:
            return exit_reason, current_price

        return None, None

    def check_partial_tp(self, position: Position, current_price: float,
                         indicators: Optional[IndicatorSnapshot]) -> bool:
        """Check if partial take profit should be taken."""
        if position.partial_tp_taken:
            return False

        atr = indicators.atr if indicators and indicators.atr else abs(position.take_profit - position.entry_price) / self.cfg.atr_target_multiplier

        if position.side == Side.LONG:
            profit_distance = current_price - position.entry_price
            target_distance = atr * (self.cfg.atr_target_multiplier * 0.6)
            if profit_distance >= target_distance:
                return True
        else:
            profit_distance = position.entry_price - current_price
            target_distance = atr * (self.cfg.atr_target_multiplier * 0.6)
            if profit_distance >= target_distance:
                return True

        return False

    def _check_momentum_reversal(self, position: Position,
                                  indicators: Optional[IndicatorSnapshot]) -> Optional[ExitReason]:
        """Exit if momentum has clearly reversed against the position."""
        if indicators is None or indicators.rsi is None:
            return None

        # Only check after position has been open a while
        if position.candles_held < 5:
            return None

        if position.side == Side.LONG:
            # Long: exit if RSI drops below 30 and EMA9 < EMA21
            if (indicators.rsi < 30 and indicators.ema_9 and indicators.ema_21
                    and indicators.ema_9 < indicators.ema_21):
                return ExitReason.MOMENTUM_REVERSAL

        elif position.side == Side.SHORT:
            # Short: exit if RSI rises above 70 and EMA9 > EMA21
            if (indicators.rsi > 70 and indicators.ema_9 and indicators.ema_21
                    and indicators.ema_9 > indicators.ema_21):
                return ExitReason.MOMENTUM_REVERSAL

        return None

    def _check_breakeven(self, position: Position, current_price: float,
                          indicators: Optional[IndicatorSnapshot]):
        """Move stop to breakeven after sufficient profit."""
        if position.stop_moved_to_breakeven:
            return

        atr = indicators.atr if indicators and indicators.atr else abs(position.take_profit - position.entry_price) / self.cfg.atr_target_multiplier
        trigger = atr * self.cfg.breakeven_trigger_atr

        if position.side == Side.LONG:
            if current_price - position.entry_price >= trigger:
                # Move stop to entry + small buffer
                position.stop_loss = position.entry_price + atr * 0.1
                position.stop_moved_to_breakeven = True
        else:
            if position.entry_price - current_price >= trigger:
                position.stop_loss = position.entry_price - atr * 0.1
                position.stop_moved_to_breakeven = True

    def _check_trailing_stop(self, position: Position, current_price: float,
                              indicators: Optional[IndicatorSnapshot]) -> Optional[ExitReason]:
        """Trailing stop: activate after threshold, trail by ATR distance."""
        atr = indicators.atr if indicators and indicators.atr else abs(position.take_profit - position.entry_price) / self.cfg.atr_target_multiplier

        activation = atr * self.cfg.trailing_stop_activation_atr
        trail_distance = atr * self.cfg.trailing_stop_distance_atr

        if position.side == Side.LONG:
            if position.highest_price - position.entry_price >= activation:
                trailing_stop = position.highest_price - trail_distance
                if trailing_stop > position.stop_loss:
                    position.stop_loss = trailing_stop
                if current_price <= position.stop_loss:
                    return ExitReason.TRAILING_STOP

        elif position.side == Side.SHORT:
            if position.lowest_price > 0 and position.entry_price - position.lowest_price >= activation:
                trailing_stop = position.lowest_price + trail_distance
                if trailing_stop < position.stop_loss:
                    position.stop_loss = trailing_stop
                if current_price >= position.stop_loss:
                    return ExitReason.TRAILING_STOP

        return None
