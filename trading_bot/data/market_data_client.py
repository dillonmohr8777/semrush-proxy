"""
Market data client. Fetches prices from Coinbase public API.
Falls back to demo mode with simulated price movement when API is unreachable.
Structured to allow easy swap to websocket or other exchange later.
"""
import time
import random
import urllib.request
import json
from datetime import datetime
from typing import Dict, List, Optional

from utils.types import Candle
from utils.retry import retry


class MarketDataClient:
    def __init__(self, base_url: str, symbols: List[str],
                 demo_mode: bool = True, demo_prices: Dict[str, float] = None,
                 timeout: int = 10, max_retries: int = 3):
        self.base_url = base_url
        self.symbols = symbols
        self.demo_mode = demo_mode
        self.timeout = timeout
        self.max_retries = max_retries

        # Demo state: random walk from seed prices
        self._demo_prices = dict(demo_prices or {})
        self._demo_velocities: Dict[str, float] = {s: 0.0 for s in symbols}

    def get_price(self, symbol: str) -> float:
        """Get current spot price for a symbol."""
        if self.demo_mode:
            return self._demo_price(symbol)
        return self._fetch_price(symbol)

    def get_prices(self) -> Dict[str, float]:
        """Get prices for all configured symbols."""
        return {s: self.get_price(s) for s in self.symbols}

    @retry(max_attempts=3, base_delay=1.0)
    def _fetch_price(self, symbol: str) -> float:
        """Fetch live price from Coinbase. Symbol format: BTC-USD -> BTC"""
        coin = symbol.split("-")[0]
        url = f"{self.base_url}/prices/{coin}-USD/spot"
        req = urllib.request.Request(url, headers={"User-Agent": "TradingBot/1.0"})
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            data = json.loads(resp.read().decode())
        return float(data["data"]["amount"])

    def _demo_price(self, symbol: str) -> float:
        """
        Generate realistic price movement using mean-reverting random walk.
        Models microstructure: momentum, mean reversion, and occasional jumps.
        """
        base = self._demo_prices.get(symbol, 100.0)

        # Volatility scaled to asset
        vol_map = {"BTC-USD": 0.0003, "ETH-USD": 0.0005, "SOL-USD": 0.0008}
        vol = vol_map.get(symbol, 0.0005)

        # Mean-reverting velocity (momentum with decay)
        v = self._demo_velocities.get(symbol, 0.0)
        v = v * 0.95 + random.gauss(0, vol)

        # Occasional small jump (1% chance of 3x move)
        if random.random() < 0.01:
            v += random.gauss(0, vol * 3)

        # Mean reversion toward seed price
        seed = {"BTC-USD": 67357.0, "ETH-USD": 2069.0, "SOL-USD": 80.94}
        seed_price = seed.get(symbol, 100.0)
        reversion = (seed_price - base) / seed_price * 0.001
        v += reversion

        new_price = base * (1 + v)
        self._demo_prices[symbol] = new_price
        self._demo_velocities[symbol] = v

        return round(new_price, 2)


class CandleBuilder:
    """
    Builds candle history from tick prices.
    In production, this would consume websocket ticks.
    For now, it aggregates from polling.
    """
    def __init__(self, max_candles: int = 250):
        self.max_candles = max_candles
        # symbol -> timeframe -> list of candles
        self._candles: Dict[str, Dict[str, List[Candle]]] = {}
        # symbol -> timeframe -> current building candle data
        self._building: Dict[str, Dict[str, dict]] = {}

    def feed_price(self, symbol: str, price: float, volume: float,
                   timestamp: datetime, timeframe_seconds: int,
                   timeframe_name: str):
        """Feed a price tick to build candles."""
        key = f"{symbol}_{timeframe_name}"

        if symbol not in self._candles:
            self._candles[symbol] = {}
            self._building[symbol] = {}

        if timeframe_name not in self._candles[symbol]:
            self._candles[symbol][timeframe_name] = []
            self._building[symbol][timeframe_name] = None

        # Determine which candle period this tick belongs to
        epoch = int(timestamp.timestamp())
        candle_start = epoch - (epoch % timeframe_seconds)

        building = self._building[symbol][timeframe_name]

        if building is None or building["start"] != candle_start:
            # Close previous candle if exists
            if building is not None:
                candle = Candle(
                    timestamp=datetime.utcfromtimestamp(building["start"]),
                    open=building["open"],
                    high=building["high"],
                    low=building["low"],
                    close=building["close"],
                    volume=building["volume"],
                )
                self._candles[symbol][timeframe_name].append(candle)
                # Trim history
                if len(self._candles[symbol][timeframe_name]) > self.max_candles:
                    self._candles[symbol][timeframe_name] = \
                        self._candles[symbol][timeframe_name][-self.max_candles:]

            # Start new candle
            self._building[symbol][timeframe_name] = {
                "start": candle_start,
                "open": price,
                "high": price,
                "low": price,
                "close": price,
                "volume": volume,
            }
        else:
            # Update current candle
            building["high"] = max(building["high"], price)
            building["low"] = min(building["low"], price)
            building["close"] = price
            building["volume"] += volume

    def get_candles(self, symbol: str, timeframe: str) -> List[Candle]:
        """Get completed candles for a symbol/timeframe."""
        if symbol not in self._candles or timeframe not in self._candles[symbol]:
            return []
        return list(self._candles[symbol][timeframe])

    def get_latest_candle(self, symbol: str, timeframe: str) -> Optional[Candle]:
        """Get the most recent completed candle."""
        candles = self.get_candles(symbol, timeframe)
        return candles[-1] if candles else None

    def candle_count(self, symbol: str, timeframe: str) -> int:
        if symbol not in self._candles or timeframe not in self._candles[symbol]:
            return 0
        return len(self._candles[symbol][timeframe])
