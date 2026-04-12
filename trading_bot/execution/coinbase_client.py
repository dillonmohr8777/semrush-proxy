"""
Coinbase Advanced Trade API client.
Handles authentication and all exchange interactions for BOTH spot and futures.

Supports:
- Account balance queries
- Spot market/limit orders
- Futures/perpetual contract orders (BUY and SELL for real longs + shorts)
- Leverage and margin configuration
- Historical candle data
- Futures position listing
- Real-time ticker prices

Authentication uses CDP API keys with JWT/ES256 signing.
API keys are loaded from environment variables — NEVER hardcoded.
"""
import os
import time
import json
import uuid
import hmac
import hashlib
import math
import secrets
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import jwt
from cryptography.hazmat.primitives import serialization

from utils.types import Candle, Side
from utils.retry import retry


ADVANCED_TRADE_BASE = "https://api.coinbase.com/api/v3/brokerage"
COINBASE_V2_BASE = "https://api.coinbase.com/v2"


class CoinbaseAuth:
    """JWT/ES256 authentication for Coinbase Developer Platform (CDP) API keys."""

    def __init__(self, api_key: str, api_secret: str):
        self.api_key = api_key  # e.g. "organizations/.../apiKeys/..."
        # Parse the EC private key from PEM string
        pem = api_secret.replace("\\n", "\n").encode("utf-8")
        self.private_key = serialization.load_pem_private_key(pem, password=None)

    def _build_jwt(self, method: str, path: str) -> str:
        """Build a signed JWT for Coinbase CDP API authentication."""
        now = int(time.time())
        uri = f"{method.upper()} api.coinbase.com{path}"

        payload = {
            "sub": self.api_key,
            "iss": "coinbase-cloud",
            "nbf": now,
            "exp": now + 120,  # 2 minute expiry
            "aud": ["retail_rest_api_proxy"],
            "uri": uri,
        }

        headers = {
            "kid": self.api_key,
            "nonce": secrets.token_hex(16),
            "typ": "JWT",
        }

        return jwt.encode(payload, self.private_key, algorithm="ES256", headers=headers)

    def sign_request(self, method: str, path: str, body: str = "") -> Dict[str, str]:
        """Generate authorization headers using JWT Bearer token."""
        token = self._build_jwt(method, path)
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "TradingBot/2.0",
        }


class CoinbaseClient:
    """
    Coinbase Advanced Trade API client for spot AND futures.
    All methods that touch real money are clearly documented.
    """
    def __init__(self, api_key: str = "", api_secret: str = "",
                 timeout: int = 10):
        # Try loading from .env file if env vars not set
        self._load_dotenv()

        self.api_key = api_key or os.environ.get("COINBASE_API_KEY", "")
        self.api_secret = api_secret or os.environ.get("COINBASE_API_SECRET", "")
        self.timeout = timeout
        self.authenticated = bool(self.api_key and self.api_secret)

        if self.authenticated:
            self.auth = CoinbaseAuth(self.api_key, self.api_secret)
        else:
            self.auth = None

    @staticmethod
    def _load_dotenv():
        """Load .env file from trading_bot directory if it exists."""
        env_paths = [
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"),
            os.path.join(os.getcwd(), ".env"),
        ]
        for env_path in env_paths:
            if os.path.exists(env_path):
                with open(env_path) as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, _, value = line.partition("=")
                            key = key.strip()
                            value = value.strip()
                            if key and key not in os.environ:
                                os.environ[key] = value
                break

    def _check_auth(self):
        if not self.authenticated:
            raise RuntimeError(
                "Coinbase API keys not configured. "
                "Set COINBASE_API_KEY and COINBASE_API_SECRET environment variables."
            )

    # ═══════════════════════════════════════════════════════════════
    #  PUBLIC ENDPOINTS (no auth needed)
    # ═══════════════════════════════════════════════════════════════

    @retry(max_attempts=3, base_delay=2.0)
    def get_spot_price(self, symbol: str) -> float:
        """Get current spot price. Symbol format: BTC-USD"""
        coin = symbol.split("-")[0]
        url = f"{COINBASE_V2_BASE}/prices/{coin}-USD/spot"
        data = self._get_public(url)
        return float(data["data"]["amount"])

    def get_prices(self, symbols: List[str]) -> Dict[str, float]:
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
        """Fetch historical candles. Works for both spot and futures product IDs."""
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
        candles.reverse()
        return candles

    @retry(max_attempts=3, base_delay=2.0)
    def list_products(self, product_type: str = None) -> List[dict]:
        """List available products. Filter by type: SPOT, FUTURE."""
        url = f"{ADVANCED_TRADE_BASE}/products"
        if product_type:
            url += f"?product_type={product_type}"
        return self._get_public(url).get("products", [])

    @retry(max_attempts=3, base_delay=2.0)
    def get_product(self, product_id: str) -> dict:
        """Get details for a specific product."""
        url = f"{ADVANCED_TRADE_BASE}/products/{product_id}"
        return self._get_public(url)

    # ═══════════════════════════════════════════════════════════════
    #  ACCOUNT / BALANCE ENDPOINTS (requires auth)
    # ═══════════════════════════════════════════════════════════════

    @retry(max_attempts=2, base_delay=2.0)
    def get_accounts(self) -> List[dict]:
        self._check_auth()
        path = "/api/v3/brokerage/accounts"
        return self._get_authenticated(path).get("accounts", [])

    def get_balance(self, currency: str = "USD") -> float:
        accounts = self.get_accounts()
        for acc in accounts:
            if acc.get("currency") == currency:
                return float(acc.get("available_balance", {}).get("value", 0))
        return 0.0

    def get_all_balances(self) -> Dict[str, float]:
        accounts = self.get_accounts()
        balances = {}
        for acc in accounts:
            val = float(acc.get("available_balance", {}).get("value", 0))
            if val > 0:
                balances[acc["currency"]] = val
        return balances

    @retry(max_attempts=2, base_delay=2.0)
    def get_futures_balance(self) -> dict:
        """
        Get futures/perps portfolio balance summary. REQUIRES AUTH.
        Returns dict with keys like:
          futures_buying_power, total_usd_balance, cbi_usd_balance,
          cfm_usd_balance, total_open_orders_hold_amount,
          unrealized_pnl, daily_realized_pnl, initial_margin,
          available_margin, liquidation_threshold, etc.
        """
        self._check_auth()
        path = "/api/v3/brokerage/cfm/balance_summary"
        return self._get_authenticated(path)

    def get_futures_buying_power(self) -> float:
        """Get available futures buying power in USD."""
        bal = self.get_futures_balance()
        return float(bal.get("futures_buying_power", 0))

    def get_futures_available_margin(self) -> float:
        """Get available margin for new positions."""
        bal = self.get_futures_balance()
        return float(bal.get("available_margin", 0))

    @retry(max_attempts=2, base_delay=2.0)
    def get_futures_positions(self) -> List[dict]:
        """
        List all open futures positions. REQUIRES AUTH.
        Each position includes:
          product_id, number_of_contracts, avg_entry_price,
          unrealized_pnl, side, current_price, etc.
        """
        self._check_auth()
        path = "/api/v3/brokerage/cfm/positions"
        return self._get_authenticated(path).get("positions", [])

    # ═══════════════════════════════════════════════════════════════
    #  FUTURES ORDER ENDPOINTS — REAL MONEY
    # ═══════════════════════════════════════════════════════════════

    @retry(max_attempts=2, base_delay=2.0)
    def place_futures_market_order(self, product_id: str, side: str,
                                   contracts: int,
                                   leverage: str = "") -> dict:
        """
        Place a MARKET order on a futures product.
        THIS TRADES REAL MONEY.

        product_id: e.g. "BIT-26DEC25-CDE" (US CFM) or "BTC-PERP-INTX" (INTX)
        side: "BUY" (long) or "SELL" (short/close)
        contracts: number of contracts (integer)
        leverage: string (e.g. "2", "5", "10") — empty string uses account default
        """
        self._check_auth()

        body = {
            "client_order_id": str(uuid.uuid4()),
            "product_id": product_id,
            "side": side.upper(),
            "order_configuration": {
                "market_market_ioc": {
                    "base_size": str(contracts),
                }
            },
            "leverage": str(leverage) if leverage else "",
            "margin_type": "CROSS",
        }

        path = "/api/v3/brokerage/orders"
        return self._post_authenticated(path, body)

    @retry(max_attempts=2, base_delay=2.0)
    def place_futures_limit_order(self, product_id: str, side: str,
                                   contracts: int, limit_price: float,
                                   leverage: str = "",
                                   post_only: bool = True) -> dict:
        """
        Place a LIMIT order on a futures product.
        THIS TRADES REAL MONEY.

        post_only=True ensures maker fee (lower cost).
        leverage: string (e.g. "2", "5") — empty uses account default.
        """
        self._check_auth()

        body = {
            "client_order_id": str(uuid.uuid4()),
            "product_id": product_id,
            "side": side.upper(),
            "order_configuration": {
                "limit_limit_gtc": {
                    "base_size": str(contracts),
                    "limit_price": str(round(limit_price, 2)),
                    "post_only": post_only,
                }
            },
            "leverage": str(leverage) if leverage else "",
            "margin_type": "CROSS",
        }

        path = "/api/v3/brokerage/orders"
        return self._post_authenticated(path, body)

    @retry(max_attempts=2, base_delay=2.0)
    def place_futures_stop_order(self, product_id: str, side: str,
                                  contracts: int, stop_price: float,
                                  limit_price: float = None,
                                  leverage: str = "") -> dict:
        """
        Place a stop-limit order on a futures product.
        Used for stop losses and take profits.
        THIS TRADES REAL MONEY.
        """
        self._check_auth()

        if limit_price is None:
            # Stop-market: set limit far from stop to ensure fill
            if side.upper() == "SELL":
                limit_price = stop_price * 0.99
            else:
                limit_price = stop_price * 1.01

        body = {
            "client_order_id": str(uuid.uuid4()),
            "product_id": product_id,
            "side": side.upper(),
            "order_configuration": {
                "stop_limit_stop_limit_gtc": {
                    "base_size": str(contracts),
                    "limit_price": str(round(limit_price, 2)),
                    "stop_price": str(round(stop_price, 2)),
                    "stop_direction": "STOP_DIRECTION_STOP_DOWN" if side.upper() == "SELL" else "STOP_DIRECTION_STOP_UP",
                }
            },
            "leverage": str(leverage) if leverage else "",
            "margin_type": "CROSS",
        }

        path = "/api/v3/brokerage/orders"
        return self._post_authenticated(path, body)

    # ═══════════════════════════════════════════════════════════════
    #  SPOT ORDER ENDPOINTS — REAL MONEY
    # ═══════════════════════════════════════════════════════════════

    @retry(max_attempts=2, base_delay=2.0)
    def place_market_order(self, product_id: str, side: str,
                           quote_size: str = None,
                           base_size: str = None) -> dict:
        """Place a spot market order. THIS TRADES REAL MONEY."""
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

    # ═══════════════════════════════════════════════════════════════
    #  ORDER MANAGEMENT
    # ═══════════════════════════════════════════════════════════════

    @retry(max_attempts=2, base_delay=2.0)
    def cancel_orders(self, order_ids: List[str]) -> dict:
        self._check_auth()
        body = {"order_ids": order_ids}
        path = "/api/v3/brokerage/orders/batch_cancel"
        return self._post_authenticated(path, body)

    @retry(max_attempts=2, base_delay=2.0)
    def get_order(self, order_id: str) -> dict:
        self._check_auth()
        path = f"/api/v3/brokerage/orders/historical/{order_id}"
        return self._get_authenticated(path)

    @retry(max_attempts=2, base_delay=2.0)
    def list_open_orders(self, product_id: str = None) -> List[dict]:
        self._check_auth()
        path = "/api/v3/brokerage/orders/historical/batch"
        params = {"order_status": "OPEN"}
        if product_id:
            params["product_id"] = product_id
        query = urllib.parse.urlencode(params)
        return self._get_authenticated(f"{path}?{query}").get("orders", [])

    @retry(max_attempts=2, base_delay=2.0)
    def close_futures_position(self, product_id: str, size: int = None) -> dict:
        """
        Close a futures position using the dedicated close_position endpoint.
        THIS TRADES REAL MONEY.

        Uses POST /api/v3/brokerage/orders/close_position which automatically
        determines the correct side (opposite of current position).

        product_id: e.g. "BIT-26DEC25-CDE"
        size: number of contracts to close (None = close all)
        """
        self._check_auth()

        body = {
            "client_order_id": str(uuid.uuid4()),
            "product_id": product_id,
        }
        if size is not None:
            body["size"] = str(size)

        path = "/api/v3/brokerage/orders/close_position"
        return self._post_authenticated(path, body)

    @retry(max_attempts=2, base_delay=2.0)
    def close_futures_position_via_order(self, product_id: str, side: str,
                                         contracts: int) -> dict:
        """
        Fallback: close a futures position by placing an opposite-side market order.
        Used when the close_position endpoint isn't available.
        THIS TRADES REAL MONEY.
        """
        close_side = "SELL" if side.upper() == "BUY" else "BUY"
        return self.place_futures_market_order(product_id, close_side, contracts)

    # ═══════════════════════════════════════════════════════════════
    #  INTERNAL HTTP
    # ═══════════════════════════════════════════════════════════════

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

    # ═══════════════════════════════════════════════════════════════
    #  CONNECTION TEST
    # ═══════════════════════════════════════════════════════════════

    def test_connection(self) -> Tuple[bool, str]:
        """Test API connectivity. Returns (success, message)."""
        try:
            price = self.get_spot_price("BTC-USD")
            public_ok = True
        except Exception as e:
            return False, f"Public API failed: {e}"

        if self.authenticated:
            try:
                accounts = self.get_accounts()
                usd_bal = self.get_balance("USDC")
                # Try futures balance
                futures_info = ""
                try:
                    fb = self.get_futures_balance()
                    futures_info = f" | Futures portfolio available"
                except Exception:
                    futures_info = " | Futures portfolio: not accessible"

                return True, (f"Connected. BTC=${price:,.2f} | "
                              f"USDC balance: ${usd_bal:,.2f} | "
                              f"Accounts: {len(accounts)}{futures_info}")
            except Exception as e:
                return False, f"Auth failed: {e}. Check API keys."

        return True, f"Public API OK. BTC=${price:,.2f}. No API keys configured (paper mode only)."
