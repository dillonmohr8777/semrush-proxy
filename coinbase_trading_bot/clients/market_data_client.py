"""
Market data service — fetches candles, order book, and current prices.

Designed so that REST fetching can later be supplemented or replaced
by a WebSocket feed without changing the interface.
"""

import time
from datetime import datetime

from clients.advanced_trade_client import AdvancedTradeClient
from config import BotConfig
from utils.logger import get_logger
from utils.types import Candle

logger = get_logger("market_data")


class MarketDataClient:
    def __init__(self, client: AdvancedTradeClient, config: BotConfig) -> None:
        self._client = client
        self._config = config

    def get_current_price(self, product_id: str) -> float:
        product = self._client.get_product(product_id)
        return float(product.get("price", 0))

    def get_candles(
        self,
        product_id: str,
        count: int = 100,
        granularity: str = "ONE_HOUR",
    ) -> list[Candle]:
        """
        Fetch the most recent `count` candles for a product.
        Returns oldest-first ordering.
        """
        now = int(time.time())

        granularity_seconds = {
            "ONE_MINUTE": 60,
            "FIVE_MINUTE": 300,
            "FIFTEEN_MINUTE": 900,
            "THIRTY_MINUTE": 1800,
            "ONE_HOUR": 3600,
            "TWO_HOUR": 7200,
            "SIX_HOUR": 21600,
            "ONE_DAY": 86400,
        }
        interval = granularity_seconds.get(granularity, 3600)
        start = now - (count * interval)

        raw = self._client.get_product_candles(
            product_id, start=start, end=now, granularity=granularity
        )

        candles = []
        for c in raw:
            candles.append(
                Candle(
                    timestamp=datetime.utcfromtimestamp(int(c["start"])),
                    open=float(c["open"]),
                    high=float(c["high"]),
                    low=float(c["low"]),
                    close=float(c["close"]),
                    volume=float(c["volume"]),
                )
            )

        # Coinbase returns newest first — reverse to oldest-first
        candles.sort(key=lambda c: c.timestamp)
        return candles

    def get_order_book_imbalance(self, product_id: str, depth: int = 10) -> float:
        """
        Compute a simple bid/ask imbalance ratio from the order book.
        Returns a value from -1.0 (all asks) to +1.0 (all bids).
        """
        book = self._client.get_product_book(product_id, limit=depth)

        bids = book.get("bids", [])
        asks = book.get("asks", [])

        bid_volume = sum(float(b.get("size", 0)) for b in bids)
        ask_volume = sum(float(a.get("size", 0)) for a in asks)

        total = bid_volume + ask_volume
        if total == 0:
            return 0.0

        return (bid_volume - ask_volume) / total

    def get_bid_ask(self, product_id: str) -> tuple[float, float]:
        """Return (best_bid, best_ask) from the order book."""
        book = self._client.get_product_book(product_id, limit=1)
        bids = book.get("bids", [])
        asks = book.get("asks", [])
        best_bid = float(bids[0]["price"]) if bids else 0.0
        best_ask = float(asks[0]["price"]) if asks else 0.0
        return best_bid, best_ask
