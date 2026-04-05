"""
Shared type definitions used across the trading bot.
"""

from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class Bias(Enum):
    LONG = "LONG"
    SHORT = "SHORT"
    NO_TRADE = "NO_TRADE"


class OrderSide(Enum):
    BUY = "BUY"
    SELL = "SELL"


@dataclass
class Candle:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass
class Indicators:
    ema_9: float
    ema_21: float
    ema_50: float
    rsi_14: float
    atr_14: float
    order_book_imbalance: float  # positive = more bids, negative = more asks
    momentum: float  # short-term price rate of change


@dataclass
class Signal:
    asset: str
    bias: Bias
    confidence: float  # 0-100
    entry: float
    stop_loss: float
    target: float
    risk_reward: float
    indicators: Indicators
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class OrderPreview:
    asset: str
    side: OrderSide
    size: float
    price: float
    notional: float
    estimated_fee: float
    stop_loss: float
    target: float


@dataclass
class PaperPosition:
    asset: str
    side: OrderSide
    entry_price: float
    size: float
    stop_loss: float
    target: float
    entry_time: datetime
    notional: float
    estimated_fee: float


@dataclass
class PaperTrade:
    asset: str
    side: OrderSide
    entry_price: float
    exit_price: float
    size: float
    pnl: float
    entry_time: datetime
    exit_time: datetime
    reason: str  # "target", "stop_loss", "signal_exit"


@dataclass
class AccountBalance:
    currency: str
    available: float
    hold: float
    total: float


@dataclass
class Fill:
    trade_id: str
    product_id: str
    side: str
    price: float
    size: float
    fee: float
    timestamp: datetime
