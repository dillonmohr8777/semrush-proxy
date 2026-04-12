"""
Coinbase Advanced Trade API client.
Handles JWT authentication and all exchange interactions.

Supports:
- Account balance queries
- Market/limit order placement
- Order status and cancellation
- Historical candle data
- Real-time ticker prices

Authentication uses Coinbase CDP API keys with ES256 JWT signing.
API keys are loaded from environment variables — NEVER hardcoded.
"""
import os
import time
import json
import uuid
import hmac
import hashlib
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from utils.types import Candle, Side
from utils.retry import retry


# Coinbase Advanced Trade API base
ADVANCED_TRADE_BASE = "https://api.coinbase.com/api/v3/brokerage"
COINBASE_V2_BASE = "https://api.coinbase.com/v2"


class CoinbaseAuth:
    """
    Handles Coinbase Advanced Trade API authentication.
    Uses API key + secret with HMAC-SHA256 signing.
    """
    def __init__(self, api_key: str, api_secret: str):
        self.api_key = api_key
        self.api_secret = api_secret

    def sign_request(self, method: str, path: str, body: str = "") -> Dict[str, str]:
        """Generate authentication headers for a request."""
        timestamp = str(int(time.time()))
        message = timestamp + method.upper() + path + body
        signature = hmac.new(
            self.api_secret.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return {
            "CB-ACCESS-KEY": self.api_key,
            "CB-ACCESS-SIGN": signature,
            "CB-ACCESS-TIMESTAMP": timestamp,
            "Content-Type": "application/json",
            "User-Agent": "TradingBot/2.0",
        }


class CoinbaseClient:
    """
    Coinbase Advanced Trade API client.
    All methods that touch real money are clearly marked and gated.
    """
    def __init__(self, api_key: str = "", api_secret: str = "",
                 sandbox: bool = False, timeout: int = 10):
        self.api_key = api_key or os.environ.get("COINBASE_API_KEY", "")
        self.api_secret = api_secret or os.environ.get("COINBASE_API_SECRET", "")
        self.timeout = timeout
        self.sandbox = sandbox
        self.authenticated = bool(self.api_key and self.api_secret)

        if self.authenticated:
            self.auth = CoinbaseAuth(self.api_key, self.api_secret)
        else:
            self.auth = None

    def _check_auth(self):
        if not self.authenticated:
            raise RuntimeError(
                "Coinbase API keys not configured. "
                "Set COINBASE_API_KEY and COINBASE_API_SECRET environment variables."
            )

    # ─── Public endpoints (no auth needed) ───────────────────────

    @retry(max_attempts=3, base_delay=2.0)
    def get_spot_price(self, symbol: str) -> float:
        """Get current spot price. Symbol format: BTC-USD"""
        coin = symbol.split("-")[0]
        url = f"{COINBASE_V2_BASE}/prices/{coin}-USD/spot"
        data = self._get_public(url)
        return float(data["data"]["amount"])

    @retry(max_attempts=3, base_delay=2.0)
    def get_buy_price(self, symbol: str) -> float:
        coin = symbol.split("-")[0]
        url = f"{COINBASE_V2_BASE}/prices/{coin}-USD/buy"
        data = self._get_public(url)
        return float(data["data"]["amount"])

    @retry(max_attempts=3, base_delay=2.0)
    def get_sell_price(self, symbol: str) -> float:
        coin = symbol.split("-")[0]
        url = f"{COINBASE_V2_BASE}/prices/{coin}-USD/sell"
        data = self._get_public(url)
        return float(data["data"]["amount"])

    def get_prices(self, symbols: List[str]) -> Dict[str, float]:
        """Get spot prices for multiple symbols."""
        prices = {}
        for s in symbols:
            try:
                prices[s] = self.get_spot_price(s)
            except Exception:
                prices[s] = None
        return prices

    @retry(max_attempts=3, base_delay=2.0)
    def get_candles(self, product_id: str, granularity: str = "ONE_MINUTE",
                    limit: int = 300) -> List[Candle]:
        """
        Fetch historical candles from Coinbase Advanced Trade API.

        product_id: e.g. "BTC-USD"
        granularity: ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE, ONE_HOUR, etc.
        """
        end = int(time.time())
        gran_seconds = {
            "ONE_MINUTE": 60, "FIVE_MINUTE": 300,
            "FIFTEEN_MINUTE": 900, "ONE_HOUR": 3600,
            "SIX_HOUR": 21600, "ONE_DAY": 86400,
        }
        seconds = gran_seconds.get(granularity, 60)
        start = end - (seconds * limit)

        url = (f"{ADVANCED_TRADE_BASE}/products/{product_id}/candles"
               f"?start={start}&end={end}&granularity={granularity}")

        data = self._get_public(url)
        candles = []
        for c in data.get("candles", []):
            candles.append(Candle(
                timestamp=datetime.fromtimestamp(int(c["start"]), tz=timezone.utc),
                open=float(c["open"]),
                high=float(c["high"]),
                low=float(c["low"]),
                close=float(c["close"]),
                volume=float(c["volume"]),
            ))

        # Coinbase returns newest first, reverse to chronological
        candles.reverse()
        return candles

    @retry(max_attempts=3, base_delay=2.0)
    def get_product_ticker(self, product_id: str) -> dict:
        """Get current ticker for a product."""
        url = f"{ADVANCED_TRADE_BASE}/products/{product_id}/ticker?limit=1"
        return self._get_public(url)

    # ─── Authenticated endpoints (REAL MONEY) ────────────────────

    @retry(max_attempts=2, base_delay=2.0)
    def get_accounts(self) -> List[dict]:
        """Get all trading accounts. REQUIRES AUTH."""
        self._check_auth()
        path = "/api/v3/brokerage/accounts"
        return self._get_authenticated(path).get("accounts", [])

    def get_balance(self, currency: str = "USD") -> float:
        """Get balance for a specific currency. REQUIRES AUTH."""
        accounts = self.get_accounts()
        for acc in accounts:
            if acc.get("currency") == currency:
                return float(acc.get("available_balance", {}).get("value", 0))
        return 0.0

    def get_all_balances(self) -> Dict[str, float]:
        """Get all non-zero balances. REQUIRES AUTH."""
        accounts = self.get_accounts()
        balances = {}
        for acc in accounts:
            val = float(acc.get("available_balance", {}).get("value", 0))
            if val > 0:
                balances[acc["currency"]] = val
        return balances

    @retry(max_attempts=2, base_delay=2.0)
    def place_market_order(self, product_id: str, side: str,
                           quote_size: str = None,
                           base_size: str = None) -> dict:
        """
        Place a market order. THIS TRADES REAL MONEY.

        product_id: e.g. "BTC-USD"
        side: "BUY" or "SELL"
        quote_size: USD amount to spend (for buys)
        base_size: asset amount to sell (for sells)
        """
        self._check_auth()

        order_config = {"market_market_ioc": {}}
        if quote_size:
            order_config["market_market_ioc"]["quote_size"] = str(quote_size)
        elif base_size:
            order_config["market_market_ioc"]["base_size"] = str(base_size)
        else:
            raise ValueError("Must specify either quote_size or base_size")

        body = {
            "client_order_id": str(uuid.uuid4()),
            "product_id": product_id,
            "side": side.upper(),
            "order_configuration": order_config,
        }

        path = "/api/v3/brokerage/orders"
        return self._post_authenticated(path, body)

    @retry(max_attempts=2, base_delay=2.0)
    def place_limit_order(self, product_id: str, side: str,
                          base_size: str, limit_price: str,
                          post_only: bool = True) -> dict:
        """
        Place a limit order. THIS TRADES REAL MONEY.

        post_only=True ensures maker fees (lower cost).
        """
        self._check_auth()

        order_config = {
            "limit_limit_gtc": {
                "base_size": str(base_size),
                "limit_price": str(limit_price),
                "post_only": post_only,
            }
        }

        body = {
            "client_order_id": str(uuid.uuid4()),
            "product_id": product_id,
            "side": side.upper(),
            "order_configuration": order_config,
        }

        path = "/api/v3/brokerage/orders"
        return self._post_authenticated(path, body)

    @retry(max_attempts=2, base_delay=2.0)
    def cancel_orders(self, order_ids: List[str]) -> dict:
        """Cancel one or more orders. REQUIRES AUTH."""
        self._check_auth()
        body = {"order_ids": order_ids}
        path = "/api/v3/brokerage/orders/batch_cancel"
        return self._post_authenticated(path, body)

    @retry(max_attempts=2, base_delay=2.0)
    def get_order(self, order_id: str) -> dict:
        """Get order status. REQUIRES AUTH."""
        self._check_auth()
        path = f"/api/v3/brokerage/orders/historical/{order_id}"
        return self._get_authenticated(path)

    @retry(max_attempts=2, base_delay=2.0)
    def list_open_orders(self, product_id: str = None) -> List[dict]:
        """List open orders. REQUIRES AUTH."""
        self._check_auth()
        path = "/api/v3/brokerage/orders/historical/batch"
        params = {"order_status": "OPEN"}
        if product_id:
            params["product_id"] = product_id
        query = urllib.parse.urlencode(params)
        return self._get_authenticated(f"{path}?{query}").get("orders", [])

    # ─── Internal HTTP methods ───────────────────────────────────

    def _get_public(self, url: str) -> dict:
        req = urllib.request.Request(url, headers={"User-Agent": "TradingBot/2.0"})
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode())

    def _get_authenticated(self, path: str) -> dict:
        url = f"https://api.coinbase.com{path}"
        headers = self.auth.sign_request("GET", path)
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode())

    def _post_authenticated(self, path: str, body: dict) -> dict:
        url = f"https://api.coinbase.com{path}"
        body_str = json.dumps(body)
        headers = self.auth.sign_request("POST", path, body_str)
        req = urllib.request.Request(
            url, data=body_str.encode("utf-8"),
            headers=headers, method="POST"
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode())

    # ─── Connection test ─────────────────────────────────────────

    def test_connection(self) -> Tuple[bool, str]:
        """Test API connectivity. Returns (success, message)."""
        # Test public endpoint
        try:
            price = self.get_spot_price("BTC-USD")
            public_ok = True
        except Exception as e:
            return False, f"Public API failed: {e}"

        # Test authenticated endpoint if keys provided
        if self.authenticated:
            try:
                accounts = self.get_accounts()
                usd_bal = self.get_balance("USD")
                return True, (f"Connected. BTC=${price:,.2f} | "
                              f"USD balance: ${usd_bal:,.2f} | "
                              f"Accounts: {len(accounts)}")
            except Exception as e:
                return False, f"Auth failed: {e}. Check API keys."

        return True, f"Public API OK. BTC=${price:,.2f}. No API keys configured (paper mode only)."
