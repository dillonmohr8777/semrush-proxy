"""
Base strategy interface. All strategies inherit from this.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import pandas as pd


class Signal(str, Enum):
    BUY  = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


@dataclass
class StrategyResult:
    signal:      Signal
    confidence:  float          # 0.0 – 1.0
    strategy:    str
    product_id:  str
    price:       float
    reason:      str = ""
    stop_loss:   Optional[float] = None
    take_profit: Optional[float] = None
    meta:        dict = field(default_factory=dict)


class BaseStrategy(ABC):
    name: str = "base"

    @abstractmethod
    def evaluate(self, df: pd.DataFrame, product_id: str) -> StrategyResult:
        """
        Evaluate the strategy on the given OHLCV+indicator DataFrame.
        df must already have indicators computed via data.indicators.compute_all().
        Returns a StrategyResult.
        """
        ...

    def _last(self, df: pd.DataFrame, col: str, n: int = 1) -> float:
        """Return the nth-from-last value of a column."""
        vals = df[col].dropna()
        if len(vals) < n:
            return float("nan")
        return float(vals.iloc[-n])
