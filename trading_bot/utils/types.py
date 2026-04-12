"""
Core data types for the trading system.
All structures are immutable where possible to prevent accidental mutation.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List
from datetime import datetime


class Side(Enum):
    LONG = "LONG"
    SHORT = "SHORT"


class Action(Enum):
    LONG = "LONG"
    SHORT = "SHORT"
    NO_TRADE = "NO_TRADE"
    CLOSE = "CLOSE"


class ExitReason(Enum):
    STOP_LOSS = "STOP_LOSS"
    TAKE_PROFIT = "TAKE_PROFIT"
    PARTIAL_TP = "PARTIAL_TP"
    TRAILING_STOP = "TRAILING_STOP"
    BREAKEVEN_STOP = "BREAKEVEN_STOP"
    MOMENTUM_REVERSAL = "MOMENTUM_REVERSAL"
    TIME_EXIT = "TIME_EXIT"
    VOLATILITY_SPIKE = "VOLATILITY_SPIKE"
    KILL_SWITCH = "KILL_SWITCH"
    MANUAL = "MANUAL"
    LIQUIDATION = "LIQUIDATION"


class Regime(Enum):
    TRENDING_UP = "TRENDING_UP"
    TRENDING_DOWN = "TRENDING_DOWN"
    RANGING = "RANGING"
    CHOPPY = "CHOPPY"
    HIGH_VOLATILITY = "HIGH_VOLATILITY"
    UNKNOWN = "UNKNOWN"


class SetupType(Enum):
    BREAKOUT = "BREAKOUT"
    PULLBACK = "PULLBACK"
    REVERSAL = "REVERSAL"
    CONTINUATION = "CONTINUATION"
    NONE = "NONE"


@dataclass
class Candle:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float

    @property
    def body(self) -> float:
        return abs(self.close - self.open)

    @property
    def range(self) -> float:
        return self.high - self.low

    @property
    def is_bullish(self) -> bool:
        return self.close > self.open


@dataclass
class IndicatorSnapshot:
    """All indicator values at a point in time for one timeframe."""
    ema_9: Optional[float] = None
    ema_21: Optional[float] = None
    ema_50: Optional[float] = None
    ema_200: Optional[float] = None
    rsi: Optional[float] = None
    atr: Optional[float] = None
    atr_pct: Optional[float] = None          # ATR as % of price
    atr_ratio: Optional[float] = None        # Current ATR vs average ATR
    volume_ratio: Optional[float] = None     # Current vol vs average vol
    momentum: Optional[float] = None         # Short-term price change %
    ema_alignment_bull: bool = False          # 9 > 21 > 50
    ema_alignment_bear: bool = False          # 9 < 21 < 50


@dataclass
class MarketContext:
    """Multi-timeframe market analysis for a single asset."""
    symbol: str
    price: float
    timestamp: datetime

    # Per-timeframe indicators
    tf_1m: Optional[IndicatorSnapshot] = None
    tf_5m: Optional[IndicatorSnapshot] = None
    tf_15m: Optional[IndicatorSnapshot] = None
    tf_1h: Optional[IndicatorSnapshot] = None

    # Derived
    regime: Regime = Regime.UNKNOWN
    setup_type: SetupType = SetupType.NONE
    higher_tf_bias: Optional[Side] = None
    lower_tf_condition: str = "unknown"


@dataclass
class Signal:
    """Output of the signal engine."""
    action: Action
    symbol: str
    confidence: float              # 0.0 to 1.0
    side: Optional[Side] = None
    leverage: float = 1.0
    entry_price: float = 0.0
    stop_loss: float = 0.0
    take_profit: float = 0.0
    liquidation_price: float = 0.0
    risk_reward: float = 0.0
    position_size_usd: float = 0.0
    position_size_qty: float = 0.0
    contracts: int = 0                 # Number of futures contracts
    contract_size: float = 0.0         # Size per contract (e.g. 0.01 BTC)
    reason: str = ""
    regime: Regime = Regime.UNKNOWN
    setup_type: SetupType = SetupType.NONE
    components: dict = field(default_factory=dict)  # Breakdown of confidence score


@dataclass
class Position:
    """An open position (paper or live)."""
    id: str
    symbol: str
    side: Side
    leverage: float
    entry_price: float
    quantity: float               # In asset units
    stop_loss: float
    take_profit: float
    liquidation_price: float
    opened_at: datetime
    # Fields with defaults
    contracts: int = 0            # Number of futures contracts
    contract_size: float = 0.0    # Size per contract (e.g. 0.01 BTC)
    notional: float = 0.0        # USD value at entry
    margin_used: float = 0.0     # Collateral locked = notional / leverage
    candles_held: int = 0
    highest_price: float = 0.0    # For trailing stop (longs)
    lowest_price: float = 0.0     # For trailing stop (shorts)
    stop_moved_to_breakeven: bool = False
    partial_tp_taken: bool = False
    original_quantity: float = 0.0
    fees_paid: float = 0.0
    unrealized_pnl: float = 0.0
    signal_confidence: float = 0.0
    signal_reason: str = ""

    def mark_to_market(self, current_price: float) -> float:
        """Calculate unrealized PnL at current price."""
        if self.side == Side.LONG:
            pnl = (current_price - self.entry_price) * self.quantity
        else:
            pnl = (self.entry_price - current_price) * self.quantity
        self.unrealized_pnl = pnl - self.fees_paid
        return self.unrealized_pnl

    def is_liquidated(self, current_price: float) -> bool:
        if self.side == Side.LONG:
            return current_price <= self.liquidation_price
        else:
            return current_price >= self.liquidation_price


@dataclass
class TradeLog:
    """Completed trade record."""
    id: str
    symbol: str
    side: str
    leverage: float
    bias: str
    confidence: float
    entry_price: float
    exit_price: float
    stop_loss: float
    take_profit: float
    liquidation_price: float
    quantity: float
    notional: float
    fees: float
    pnl: float
    pnl_pct: float
    opened_at: str
    closed_at: str
    candles_held: int
    entry_reason: str
    exit_reason: str
    regime: str
    setup_type: str


@dataclass
class EquitySnapshot:
    """Point-in-time equity record."""
    timestamp: str
    equity: float
    cash: float
    unrealized_pnl: float
    open_positions: int
    drawdown_pct: float
    daily_pnl: float
    peak_equity: float
