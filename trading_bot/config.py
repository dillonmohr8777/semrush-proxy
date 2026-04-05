"""
Configuration for the leveraged paper trading system.
All risk parameters, leverage limits, and strategy thresholds live here.
Designed to be conservative by default. Override via environment or config file.
"""
from dataclasses import dataclass, field
from typing import Dict, List
import os
import json


@dataclass
class RiskConfig:
    # Account
    starting_balance: float = 10_000.0

    # Per-trade risk
    risk_per_trade_pct: float = 0.75       # 0.5% - 1.0% range, default 0.75%
    min_risk_reward: float = 1.5           # Minimum R:R to take a trade

    # Daily / weekly guards
    max_daily_loss_pct: float = 3.0        # Kill trading for the day
    max_weekly_drawdown_pct: float = 7.0   # Kill trading for the week

    # Drawdown kill switch
    max_total_drawdown_pct: float = 15.0   # Hard stop - no more trading

    # Cooldowns
    cooldown_after_stop_seconds: int = 300       # 5 min after a stop loss
    cooldown_after_consecutive_losses: int = 3   # N consecutive losses triggers cooldown
    cooldown_consecutive_loss_seconds: int = 900 # 15 min cooldown after consecutive losses

    # Position limits
    max_concurrent_positions: int = 2
    max_notional_exposure: float = 50_000.0      # Total notional across all positions
    max_exposure_per_asset: float = 30_000.0     # Max notional per single asset

    # Fees (simulated, based on typical taker fees)
    taker_fee_pct: float = 0.06  # 0.06% per side (Coinbase Advanced / Binance tier)


@dataclass
class LeverageConfig:
    default_leverage: float = 2.0
    max_leverage: float = 5.0
    leverage_tiers: List[float] = field(default_factory=lambda: [1.0, 2.0, 3.0, 5.0])

    # Liquidation safety
    min_liquidation_distance_pct: float = 10.0   # Must be at least 10% from liquidation
    liquidation_buffer_pct: float = 2.0          # Extra buffer above exchange liq price

    # Leverage adjustment rules
    reduce_leverage_atr_multiplier: float = 1.5  # If ATR > 1.5x normal, reduce leverage
    reduce_leverage_weak_signal: bool = True      # Lower leverage on lower confidence

    # Per-asset max leverage overrides
    asset_max_leverage: Dict[str, float] = field(default_factory=lambda: {
        "BTC-USD": 5.0,
        "ETH-USD": 5.0,
        "SOL-USD": 3.0,
    })


@dataclass
class StrategyConfig:
    # EMA periods
    ema_fast: int = 9
    ema_mid: int = 21
    ema_slow: int = 50
    ema_trend: int = 200

    # RSI
    rsi_period: int = 14
    rsi_overbought: float = 70.0
    rsi_oversold: float = 30.0
    rsi_extreme_overbought: float = 80.0
    rsi_extreme_oversold: float = 20.0

    # ATR
    atr_period: int = 14
    atr_stop_multiplier: float = 1.5    # Stop loss = ATR * multiplier
    atr_target_multiplier: float = 2.5  # Take profit = ATR * multiplier

    # Volume
    volume_expansion_threshold: float = 1.5  # Volume must be 1.5x average

    # Confidence
    min_confidence: float = 0.55         # Minimum score to consider a trade
    strong_confidence: float = 0.75      # Strong signal threshold

    # Chop / regime
    chop_atr_ratio_threshold: float = 0.4  # Low ATR ratio = choppy market
    trend_ema_alignment_tolerance: float = 0.002  # EMAs within 0.2% = no clear trend

    # Trade management
    breakeven_trigger_atr: float = 1.0   # Move stop to BE after 1x ATR profit
    trailing_stop_activation_atr: float = 1.5
    trailing_stop_distance_atr: float = 0.75
    max_trade_duration_candles: int = 60  # Exit if trade stalls (on primary TF)
    partial_tp_pct: float = 0.5          # Close 50% at first target


@dataclass
class DataConfig:
    # Supported assets
    symbols: List[str] = field(default_factory=lambda: ["BTC-USD", "ETH-USD", "SOL-USD"])

    # Timeframes (in seconds)
    timeframes: Dict[str, int] = field(default_factory=lambda: {
        "1m": 60,
        "5m": 300,
        "15m": 900,
        "1h": 3600,
    })

    # Primary timeframe for signals
    primary_timeframe: str = "5m"
    trigger_timeframe: str = "1m"
    bias_timeframe: str = "15m"
    trend_timeframe: str = "1h"

    # Candle history needed
    max_candles: int = 250  # Enough for EMA 200

    # API
    base_url: str = "https://api.coinbase.com/v2"
    api_timeout: int = 10
    max_retries: int = 3

    # Demo mode
    demo_mode: bool = True
    demo_prices: Dict[str, float] = field(default_factory=lambda: {
        "BTC-USD": 67357.0,
        "ETH-USD": 2069.0,
        "SOL-USD": 80.94,
    })

    # Cycle interval
    cycle_interval_seconds: int = 60


@dataclass
class LogConfig:
    output_dir: str = "output"
    trade_log_csv: str = "trades.csv"
    equity_log_csv: str = "equity_curve.csv"
    state_json: str = "state.json"
    event_log: str = "events.log"


@dataclass
class BotConfig:
    risk: RiskConfig = field(default_factory=RiskConfig)
    leverage: LeverageConfig = field(default_factory=LeverageConfig)
    strategy: StrategyConfig = field(default_factory=StrategyConfig)
    data: DataConfig = field(default_factory=DataConfig)
    log: LogConfig = field(default_factory=LogConfig)

    # Master safety
    paper_mode: bool = True  # NEVER set to False without explicit safety checks
    live_mode_passphrase: str = "I_UNDERSTAND_THE_RISKS"

    @classmethod
    def load(cls, path: str = "config.json") -> "BotConfig":
        """Load config from JSON file if it exists, otherwise use defaults."""
        if os.path.exists(path):
            with open(path) as f:
                data = json.load(f)
            # Only override paper_mode if passphrase matches
            if data.get("paper_mode") is False:
                if data.get("live_mode_passphrase") != cls.live_mode_passphrase:
                    data["paper_mode"] = True
            return cls(**data)
        return cls()
