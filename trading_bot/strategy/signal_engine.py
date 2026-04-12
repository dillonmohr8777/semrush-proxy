"""
Signal engine: confluence-based trade decision system.
Evaluates multiple factors across timeframes and produces a scored signal.
Returns LONG, SHORT, or NO_TRADE with confidence and trade parameters.
"""
from typing import Optional, List
from utils.types import (
    Action, Side, Signal, MarketContext, IndicatorSnapshot,
    Regime, SetupType, Position
)
from config import StrategyConfig, LeverageConfig, RiskConfig
from strategy.regime import detect_regime, determine_higher_tf_bias, is_extended
from strategy.leverage_model import (
    select_leverage, estimate_liquidation_price,
    is_liquidation_safe, max_leverage_for_stop
)
from strategy.risk import RiskManager


class SignalEngine:
    def __init__(self, strategy_config: StrategyConfig,
                 leverage_config: LeverageConfig,
                 risk_config: RiskConfig,
                 contract_sizes: dict = None):
        self.cfg = strategy_config
        self.lev_cfg = leverage_config
        self.risk_cfg = risk_config
        self.contract_sizes = contract_sizes or {}

    def evaluate(self, ctx: MarketContext, risk_mgr: RiskManager,
                 open_positions: List[Position]) -> Signal:
        """
        Main signal evaluation. Multi-timeframe confluence scoring.

        Process:
        1. Determine higher TF bias
        2. Detect regime
        3. Score long and short setups independently
        4. Pick the stronger one (if any passes threshold)
        5. Calculate trade parameters
        6. Validate risk and liquidation
        7. Return signal
        """
        no_trade = Signal(
            action=Action.NO_TRADE,
            symbol=ctx.symbol,
            confidence=0.0,
            reason="",
            regime=ctx.regime,
        )

        # Check if we can trade at all
        can_trade, reason = risk_mgr.can_trade(open_positions)
        if not can_trade:
            no_trade.reason = reason
            return no_trade

        # Already have position in this asset?
        if any(p.symbol == ctx.symbol for p in open_positions):
            no_trade.reason = f"Already positioned in {ctx.symbol}"
            return no_trade

        # Need minimum indicators
        primary = ctx.tf_5m
        trigger = ctx.tf_1m
        bias_tf = ctx.tf_15m
        trend_tf = ctx.tf_1h

        if primary is None:
            no_trade.reason = "Insufficient 5m data"
            return no_trade

        # Determine higher TF bias
        higher_bias = determine_higher_tf_bias(bias_tf or trend_tf)
        ctx.higher_tf_bias = higher_bias

        # Detect regime on primary TF
        regime = detect_regime(primary, self.cfg)
        ctx.regime = regime

        # Score both sides
        long_score, long_components = self._score_long(ctx, primary, trigger, bias_tf, trend_tf, regime, higher_bias)
        short_score, short_components = self._score_short(ctx, primary, trigger, bias_tf, trend_tf, regime, higher_bias)

        # Determine best side
        if long_score >= self.cfg.min_confidence and long_score > short_score:
            return self._build_signal(
                ctx, Side.LONG, long_score, long_components,
                primary, regime, risk_mgr, open_positions
            )
        elif short_score >= self.cfg.min_confidence and short_score > long_score:
            return self._build_signal(
                ctx, Side.SHORT, short_score, short_components,
                primary, regime, risk_mgr, open_positions
            )

        # No trade
        best = max(long_score, short_score)
        no_trade.confidence = best
        if best > 0:
            no_trade.reason = (f"Best confidence {best:.2f} < threshold {self.cfg.min_confidence:.2f} "
                               f"(L:{long_score:.2f} S:{short_score:.2f})")
        else:
            no_trade.reason = "No viable setup detected"
        no_trade.regime = regime
        return no_trade

    def _score_long(self, ctx: MarketContext, primary: IndicatorSnapshot,
                    trigger: Optional[IndicatorSnapshot],
                    bias_tf: Optional[IndicatorSnapshot],
                    trend_tf: Optional[IndicatorSnapshot],
                    regime: Regime, higher_bias: Optional[Side]) -> tuple:
        """Score a potential LONG setup. Returns (score, components_dict)."""
        components = {}
        score = 0.0
        max_score = 0.0

        # 1. Higher TF bias alignment (weight: 0.20)
        weight = 0.20
        max_score += weight
        if higher_bias == Side.LONG:
            score += weight
            components["htf_bias"] = weight
        elif higher_bias is None:
            score += weight * 0.3  # Neutral is slightly ok
            components["htf_bias"] = weight * 0.3
        else:
            components["htf_bias"] = 0.0  # Bearish HTF = no points for long

        # 2. EMA alignment on primary TF (weight: 0.15)
        weight = 0.15
        max_score += weight
        if primary.ema_alignment_bull:
            score += weight
            components["ema_alignment"] = weight
        elif primary.ema_9 and primary.ema_21 and primary.ema_9 > primary.ema_21:
            score += weight * 0.5
            components["ema_alignment"] = weight * 0.5
        else:
            components["ema_alignment"] = 0.0

        # 3. RSI positioning (weight: 0.12)
        weight = 0.12
        max_score += weight
        if primary.rsi:
            if 40 <= primary.rsi <= 65:  # Healthy zone for longs
                score += weight
                components["rsi"] = weight
            elif 30 <= primary.rsi < 40:  # Oversold — pullback opportunity
                score += weight * 0.8
                components["rsi"] = weight * 0.8
            elif primary.rsi > 65:  # Getting overbought — caution
                score += weight * 0.2
                components["rsi"] = weight * 0.2
            else:
                components["rsi"] = 0.0
        else:
            components["rsi"] = 0.0

        # 4. Momentum (weight: 0.13)
        weight = 0.13
        max_score += weight
        if primary.momentum is not None:
            if primary.momentum > 0.1:
                score += weight
                components["momentum"] = weight
            elif primary.momentum > 0:
                score += weight * 0.5
                components["momentum"] = weight * 0.5
            else:
                components["momentum"] = 0.0
        else:
            components["momentum"] = 0.0

        # 5. Volume expansion (weight: 0.10)
        weight = 0.10
        max_score += weight
        if primary.volume_ratio and primary.volume_ratio >= self.cfg.volume_expansion_threshold:
            score += weight
            components["volume"] = weight
        elif primary.volume_ratio and primary.volume_ratio >= 1.0:
            score += weight * 0.5
            components["volume"] = weight * 0.5
        else:
            components["volume"] = 0.0

        # 6. Regime compatibility (weight: 0.15)
        weight = 0.15
        max_score += weight
        if regime == Regime.TRENDING_UP:
            score += weight
            components["regime"] = weight
        elif regime == Regime.RANGING:
            score += weight * 0.3
            components["regime"] = weight * 0.3
        elif regime in (Regime.CHOPPY, Regime.HIGH_VOLATILITY):
            components["regime"] = 0.0  # Don't long in chop/high vol
        elif regime == Regime.TRENDING_DOWN:
            components["regime"] = 0.0  # Counter-trend — no points
        else:
            components["regime"] = 0.0

        # 7. Trigger TF confirmation (weight: 0.10)
        weight = 0.10
        max_score += weight
        if trigger and trigger.momentum is not None and trigger.momentum > 0:
            score += weight
            components["trigger"] = weight
        elif trigger and trigger.ema_9 and trigger.ema_21 and trigger.ema_9 > trigger.ema_21:
            score += weight * 0.5
            components["trigger"] = weight * 0.5
        else:
            components["trigger"] = 0.0

        # 8. Not extended (weight: 0.05 penalty)
        weight = 0.05
        max_score += weight
        if not is_extended(primary, Side.LONG):
            score += weight
            components["not_extended"] = weight
        else:
            score -= 0.10  # Active penalty for chasing
            components["not_extended"] = -0.10

        # Normalize to 0-1
        final = max(0.0, min(1.0, score / max_score)) if max_score > 0 else 0.0
        return final, components

    def _score_short(self, ctx: MarketContext, primary: IndicatorSnapshot,
                     trigger: Optional[IndicatorSnapshot],
                     bias_tf: Optional[IndicatorSnapshot],
                     trend_tf: Optional[IndicatorSnapshot],
                     regime: Regime, higher_bias: Optional[Side]) -> tuple:
        """Score a potential SHORT setup. Returns (score, components_dict)."""
        components = {}
        score = 0.0
        max_score = 0.0

        # 1. Higher TF bias alignment
        weight = 0.20
        max_score += weight
        if higher_bias == Side.SHORT:
            score += weight
            components["htf_bias"] = weight
        elif higher_bias is None:
            score += weight * 0.3
            components["htf_bias"] = weight * 0.3
        else:
            components["htf_bias"] = 0.0

        # 2. EMA alignment (bearish)
        weight = 0.15
        max_score += weight
        if primary.ema_alignment_bear:
            score += weight
            components["ema_alignment"] = weight
        elif primary.ema_9 and primary.ema_21 and primary.ema_9 < primary.ema_21:
            score += weight * 0.5
            components["ema_alignment"] = weight * 0.5
        else:
            components["ema_alignment"] = 0.0

        # 3. RSI positioning
        weight = 0.12
        max_score += weight
        if primary.rsi:
            if 35 <= primary.rsi <= 60:  # Healthy zone for shorts
                score += weight
                components["rsi"] = weight
            elif 60 < primary.rsi <= 70:  # Overbought — potential short
                score += weight * 0.8
                components["rsi"] = weight * 0.8
            elif primary.rsi < 35:
                score += weight * 0.2
                components["rsi"] = weight * 0.2
            else:
                components["rsi"] = 0.0
        else:
            components["rsi"] = 0.0

        # 4. Momentum (bearish)
        weight = 0.13
        max_score += weight
        if primary.momentum is not None:
            if primary.momentum < -0.1:
                score += weight
                components["momentum"] = weight
            elif primary.momentum < 0:
                score += weight * 0.5
                components["momentum"] = weight * 0.5
            else:
                components["momentum"] = 0.0
        else:
            components["momentum"] = 0.0

        # 5. Volume expansion
        weight = 0.10
        max_score += weight
        if primary.volume_ratio and primary.volume_ratio >= self.cfg.volume_expansion_threshold:
            score += weight
            components["volume"] = weight
        elif primary.volume_ratio and primary.volume_ratio >= 1.0:
            score += weight * 0.5
            components["volume"] = weight * 0.5
        else:
            components["volume"] = 0.0

        # 6. Regime compatibility
        weight = 0.15
        max_score += weight
        if regime == Regime.TRENDING_DOWN:
            score += weight
            components["regime"] = weight
        elif regime == Regime.RANGING:
            score += weight * 0.3
            components["regime"] = weight * 0.3
        elif regime in (Regime.CHOPPY, Regime.HIGH_VOLATILITY):
            components["regime"] = 0.0
        elif regime == Regime.TRENDING_UP:
            components["regime"] = 0.0
        else:
            components["regime"] = 0.0

        # 7. Trigger TF confirmation
        weight = 0.10
        max_score += weight
        if trigger and trigger.momentum is not None and trigger.momentum < 0:
            score += weight
            components["trigger"] = weight
        elif trigger and trigger.ema_9 and trigger.ema_21 and trigger.ema_9 < trigger.ema_21:
            score += weight * 0.5
            components["trigger"] = weight * 0.5
        else:
            components["trigger"] = 0.0

        # 8. Not extended
        weight = 0.05
        max_score += weight
        if not is_extended(primary, Side.SHORT):
            score += weight
            components["not_extended"] = weight
        else:
            score -= 0.10
            components["not_extended"] = -0.10

        final = max(0.0, min(1.0, score / max_score)) if max_score > 0 else 0.0
        return final, components

    def _build_signal(self, ctx: MarketContext, side: Side, confidence: float,
                      components: dict, primary: IndicatorSnapshot,
                      regime: Regime, risk_mgr: RiskManager,
                      open_positions: List[Position]) -> Signal:
        """Build a complete trade signal with entry, stop, target, leverage, sizing."""
        price = ctx.price
        atr = primary.atr or price * 0.01  # Fallback ATR

        # Calculate stop and target
        if side == Side.LONG:
            stop_loss = price - atr * self.cfg.atr_stop_multiplier
            take_profit = price + atr * self.cfg.atr_target_multiplier
        else:
            stop_loss = price + atr * self.cfg.atr_stop_multiplier
            take_profit = price - atr * self.cfg.atr_target_multiplier

        # Risk/reward
        risk_dist = abs(price - stop_loss)
        reward_dist = abs(take_profit - price)
        rr = reward_dist / risk_dist if risk_dist > 0 else 0

        # Check R:R minimum
        if rr < self.risk_cfg.min_risk_reward:
            return Signal(
                action=Action.NO_TRADE, symbol=ctx.symbol,
                confidence=confidence, regime=regime,
                reason=f"R:R {rr:.2f} below minimum {self.risk_cfg.min_risk_reward}"
            )

        # Select leverage
        leverage = select_leverage(
            confidence, regime, primary, ctx.symbol,
            self.lev_cfg, self.cfg
        )

        # Check max safe leverage for this stop distance
        max_safe = max_leverage_for_stop(price, stop_loss, side)
        leverage = min(leverage, max_safe)

        # Ensure leverage is at least 1
        leverage = max(1.0, leverage)

        # Estimate liquidation
        liq_price = estimate_liquidation_price(
            price, side, leverage, self.lev_cfg.liquidation_buffer_pct
        )

        # Liquidation safety check
        if not is_liquidation_safe(price, stop_loss, liq_price, side,
                                    self.lev_cfg.min_liquidation_distance_pct):
            # Try reducing leverage
            leverage = max(1.0, leverage - 1.0)
            liq_price = estimate_liquidation_price(
                price, side, leverage, self.lev_cfg.liquidation_buffer_pct
            )
            if not is_liquidation_safe(price, stop_loss, liq_price, side,
                                        self.lev_cfg.min_liquidation_distance_pct):
                return Signal(
                    action=Action.NO_TRADE, symbol=ctx.symbol,
                    confidence=confidence, regime=regime,
                    reason=f"Liquidation too close even at {leverage}x leverage"
                )

        # Position sizing (contract-aware for futures)
        contract_size = self.contract_sizes.get(ctx.symbol, 0.0)
        notional, qty, margin, contracts = risk_mgr.calculate_position_size(
            risk_mgr.equity, price, stop_loss, leverage, side,
            contract_size=contract_size,
        )

        # Exposure check
        can_expose, expose_reason = risk_mgr.check_exposure(
            notional, ctx.symbol, open_positions
        )
        if not can_expose:
            return Signal(
                action=Action.NO_TRADE, symbol=ctx.symbol,
                confidence=confidence, regime=regime,
                reason=expose_reason
            )

        if notional <= 0 or qty <= 0:
            return Signal(
                action=Action.NO_TRADE, symbol=ctx.symbol,
                confidence=confidence, regime=regime,
                reason="Position size too small"
            )

        # Classify setup type
        setup = self._classify_setup(primary, side, regime)

        # Build reason string
        top_factors = sorted(components.items(), key=lambda x: x[1], reverse=True)[:3]
        reason = f"{setup.value} | Top factors: " + ", ".join(
            f"{k}={v:.3f}" for k, v in top_factors
        )

        return Signal(
            action=Action.LONG if side == Side.LONG else Action.SHORT,
            symbol=ctx.symbol,
            confidence=confidence,
            side=side,
            leverage=leverage,
            entry_price=price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            liquidation_price=liq_price,
            risk_reward=rr,
            position_size_usd=notional,
            position_size_qty=qty,
            contracts=contracts,
            contract_size=contract_size,
            reason=reason,
            regime=regime,
            setup_type=setup,
            components=components,
        )

    def _classify_setup(self, primary: IndicatorSnapshot, side: Side,
                        regime: Regime) -> SetupType:
        """Classify the trade setup type."""
        if regime in (Regime.TRENDING_UP, Regime.TRENDING_DOWN):
            # Is price pulling back to EMA?
            if primary.ema_21 and primary.ema_9:
                if side == Side.LONG and primary.ema_9 <= primary.ema_21 * 1.005:
                    return SetupType.PULLBACK
                if side == Side.SHORT and primary.ema_9 >= primary.ema_21 * 0.995:
                    return SetupType.PULLBACK
            return SetupType.CONTINUATION

        if primary.volume_ratio and primary.volume_ratio > 2.0:
            return SetupType.BREAKOUT

        return SetupType.NONE
