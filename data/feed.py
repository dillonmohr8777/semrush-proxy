"""
Historical candle loader + in-memory candle cache.
Keeps a rolling window of OHLCV data per product.
"""
import logging
from collections import deque
from datetime import datetime
from typing import Dict, List, Deque

import pandas as pd

from core.exchange import CoinbaseClient
from config.settings import CANDLE_GRANULARITY, CANDLE_LOOKBACK

logger = logging.getLogger(__name__)


class CandleCache:
    """
    Maintains a rolling deque of OHLCV candles per product.
    Thread-safe for single writer.
    """

    def __init__(self, max_candles: int = CANDLE_LOOKBACK):
        self.max_candles = max_candles
        self._data: Dict[str, Deque[Dict]] = {}

    def update(self, product_id: str, candles: List[Dict]):
        if product_id not in self._data:
            self._data[product_id] = deque(maxlen=self.max_candles)
        for c in candles:
            self._data[product_id].append(c)

    def get_df(self, product_id: str) -> pd.DataFrame:
        """Return a DataFrame with columns: time, open, high, low, close, volume."""
        raw = list(self._data.get(product_id, []))
        if not raw:
            return pd.DataFrame()
        df = pd.DataFrame(raw)
        df["time"]   = pd.to_datetime(df["start"].astype(int), unit="s", utc=True)
        df["open"]   = df["open"].astype(float)
        df["high"]   = df["high"].astype(float)
        df["low"]    = df["low"].astype(float)
        df["close"]  = df["close"].astype(float)
        df["volume"] = df["volume"].astype(float)
        return df.set_index("time").sort_index()[["open", "high", "low", "close", "volume"]]

    def latest_price(self, product_id: str) -> float:
        raw = self._data.get(product_id)
        if raw:
            return float(list(raw)[-1]["close"])
        return 0.0

    def has_enough(self, product_id: str, min_candles: int = 50) -> bool:
        return len(self._data.get(product_id, [])) >= min_candles


class DataManager:
    """
    Loads and refreshes candle data for all trading pairs.
    Called periodically by the execution engine.
    """

    def __init__(self, client: CoinbaseClient,
                 product_ids: List[str],
                 granularity: str = CANDLE_GRANULARITY,
                 lookback: int = CANDLE_LOOKBACK):
        self.client      = client
        self.product_ids = product_ids
        self.granularity = granularity
        self.lookback    = lookback
        self.cache       = CandleCache(max_candles=lookback)

    def bootstrap(self):
        """Initial load — called once at startup."""
        for pid in self.product_ids:
            try:
                candles = self.client.get_candles(
                    pid, self.granularity, limit=self.lookback
                )
                self.cache.update(pid, candles)
                logger.info(f"Bootstrapped {pid}: {len(candles)} candles")
            except Exception as e:
                logger.error(f"Bootstrap failed for {pid}: {e}")

    def refresh(self, product_id: str):
        """Fetch the latest candle(s) and append to cache."""
        try:
            candles = self.client.get_candles(
                product_id, self.granularity, limit=5
            )
            self.cache.update(product_id, candles)
        except Exception as e:
            logger.warning(f"Refresh failed for {product_id}: {e}")

    def get_df(self, product_id: str) -> pd.DataFrame:
        return self.cache.get_df(product_id)
