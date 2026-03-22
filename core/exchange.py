"""
Coinbase Advanced Trade API wrapper.
Handles REST (orders, accounts, products) and WebSocket (price feed).
Uses JWT auth as required by Coinbase Advanced Trade API.
"""
import time
import json
import uuid
import hashlib
import hmac
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, List, Callable
from enum import Enum

import jwt
import requests
import websockets
from cryptography.hazmat.primitives import serialization

from config.settings import (
    COINBASE_API_KEY, COINBASE_API_SECRET,
    COINBASE_REST_URL, COINBASE_WS_URL
)

logger = logging.getLogger(__name__)


class OrderSide(str, Enum):
    BUY  = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT  = "LIMIT"


class CoinbaseClient:
    """
    Thread-safe Coinbase Advanced Trade REST client.
    Implements JWT authentication (required since 2024).
    """

    def __init__(self, api_key: str = COINBASE_API_KEY,
                 api_secret: str = COINBASE_API_SECRET):
        self.api_key    = api_key
        self.api_secret = api_secret
        self.base_url   = COINBASE_REST_URL
        self.session    = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    # ─── Auth ────────────────────────────────────────────────────────────────

    def _build_jwt(self, method: str, path: str) -> str:
        """Generate a short-lived JWT for each request."""
        uri = f"{method} {self.base_url.replace('https://', '')}{path}"
        payload = {
            "sub": self.api_key,
            "iss": "cdp",
            "nbf": int(time.time()),
            "exp": int(time.time()) + 120,
            "uri": uri,
        }
        # Secret is a PEM EC key (CDP keys) or HMAC secret (legacy)
        try:
            token = jwt.encode(
                payload,
                self.api_secret,
                algorithm="ES256",
                headers={"kid": self.api_key, "nonce": uuid.uuid4().hex}
            )
        except Exception:
            # Fallback: legacy HMAC signing
            token = jwt.encode(payload, self.api_secret, algorithm="HS256")
        return token

    def _headers(self, method: str, path: str) -> Dict:
        return {"Authorization": f"Bearer {self._build_jwt(method, path)}"}

    # ─── Request helpers ─────────────────────────────────────────────────────

    def _get(self, path: str, params: Dict = None) -> Dict:
        resp = self.session.get(
            f"{self.base_url}{path}",
            params=params,
            headers=self._headers("GET", path),
            timeout=10
        )
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, body: Dict) -> Dict:
        resp = self.session.post(
            f"{self.base_url}{path}",
            json=body,
            headers=self._headers("POST", path),
            timeout=10
        )
        resp.raise_for_status()
        return resp.json()

    # ─── Account endpoints ───────────────────────────────────────────────────

    def get_accounts(self) -> List[Dict]:
        """Return all portfolio accounts."""
        data = self._get("/api/v3/brokerage/accounts")
        return data.get("accounts", [])

    def get_account(self, currency: str) -> Optional[Dict]:
        """Return account for a specific currency (e.g. 'USD', 'BTC')."""
        for acct in self.get_accounts():
            if acct.get("currency") == currency:
                return acct
        return None

    def get_usd_balance(self) -> float:
        acct = self.get_account("USD")
        if acct:
            return float(acct.get("available_balance", {}).get("value", 0))
        return 0.0

    def get_crypto_balance(self, currency: str) -> float:
        """Return available balance for a crypto (e.g. 'BTC')."""
        acct = self.get_account(currency)
        if acct:
            return float(acct.get("available_balance", {}).get("value", 0))
        return 0.0

    def get_portfolio_value(self) -> Dict[str, float]:
        """Return {currency: balance} for all non-zero accounts."""
        return {
            a["currency"]: float(a["available_balance"]["value"])
            for a in self.get_accounts()
            if float(a.get("available_balance", {}).get("value", 0)) > 0
        }

    # ─── Market data ─────────────────────────────────────────────────────────

    def get_product(self, product_id: str) -> Dict:
        return self._get(f"/api/v3/brokerage/products/{product_id}")

    def get_best_bid_ask(self, product_id: str) -> Dict:
        data = self._get("/api/v3/brokerage/best_bid_ask",
                         params={"product_ids": product_id})
        pricebooks = data.get("pricebooks", [])
        if pricebooks:
            return {
                "bid": float(pricebooks[0].get("bids", [{}])[0].get("price", 0)),
                "ask": float(pricebooks[0].get("asks", [{}])[0].get("price", 0)),
            }
        return {"bid": 0.0, "ask": 0.0}

    def get_candles(self, product_id: str, granularity: str,
                    start: int = None, end: int = None,
                    limit: int = 200) -> List[Dict]:
        """
        Fetch OHLCV candles.
        granularity: ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE,
                     THIRTY_MINUTE, ONE_HOUR, TWO_HOUR, SIX_HOUR, ONE_DAY
        """
        end   = end   or int(time.time())
        gran_seconds = {
            "ONE_MINUTE": 60, "FIVE_MINUTE": 300, "FIFTEEN_MINUTE": 900,
            "THIRTY_MINUTE": 1800, "ONE_HOUR": 3600, "TWO_HOUR": 7200,
            "SIX_HOUR": 21600, "ONE_DAY": 86400
        }
        secs  = gran_seconds.get(granularity, 3600)
        start = start or (end - secs * limit)

        data = self._get(
            f"/api/v3/brokerage/products/{product_id}/candles",
            params={"start": start, "end": end, "granularity": granularity}
        )
        candles = data.get("candles", [])
        return sorted(candles, key=lambda c: int(c["start"]))

    def get_market_trades(self, product_id: str, limit: int = 50) -> List[Dict]:
        data = self._get(
            f"/api/v3/brokerage/products/{product_id}/ticker",
            params={"limit": limit, "product_id": product_id}
        )
        return data.get("trades", [])

    # ─── Order endpoints ─────────────────────────────────────────────────────

    def place_market_order(self, product_id: str, side: OrderSide,
                           quote_size: float = None,
                           base_size: float = None) -> Dict:
        """
        Market order.
        - BUY:  specify quote_size (USD amount to spend)
        - SELL: specify base_size (crypto amount to sell)
        """
        order_cfg = {}
        if quote_size:
            order_cfg["quote_size"] = f"{quote_size:.2f}"
        if base_size:
            order_cfg["base_size"] = f"{base_size:.8f}"

        body = {
            "client_order_id": uuid.uuid4().hex,
            "product_id": product_id,
            "side": side.value,
            "order_configuration": {
                "market_market_ioc": order_cfg
            }
        }
        logger.info(f"Placing MARKET {side.value} {product_id} | "
                    f"quote={quote_size} base={base_size}")
        return self._post("/api/v3/brokerage/orders", body)

    def place_limit_order(self, product_id: str, side: OrderSide,
                          base_size: float, limit_price: float,
                          post_only: bool = False,
                          gtc: bool = True) -> Dict:
        """Limit order, GTC by default."""
        body = {
            "client_order_id": uuid.uuid4().hex,
            "product_id": product_id,
            "side": side.value,
            "order_configuration": {
                "limit_limit_gtc": {
                    "base_size":    f"{base_size:.8f}",
                    "limit_price":  f"{limit_price:.2f}",
                    "post_only":    post_only,
                }
            }
        }
        logger.info(f"Placing LIMIT {side.value} {product_id} "
                    f"@ {limit_price} | size={base_size}")
        return self._post("/api/v3/brokerage/orders", body)

    def cancel_order(self, order_id: str) -> Dict:
        return self._post("/api/v3/brokerage/orders/batch_cancel",
                          {"order_ids": [order_id]})

    def get_order(self, order_id: str) -> Dict:
        return self._get(f"/api/v3/brokerage/orders/historical/{order_id}")

    def get_open_orders(self, product_id: str = None) -> List[Dict]:
        params = {"order_status": "OPEN"}
        if product_id:
            params["product_id"] = product_id
        data = self._get("/api/v3/brokerage/orders/historical/batch",
                         params=params)
        return data.get("orders", [])

    def get_fills(self, order_id: str = None,
                  product_id: str = None, limit: int = 100) -> List[Dict]:
        params = {"limit": limit}
        if order_id:
            params["order_id"] = order_id
        if product_id:
            params["product_id"] = product_id
        data = self._get("/api/v3/brokerage/orders/historical/fills",
                         params=params)
        return data.get("fills", [])


# ─── WebSocket Feed ──────────────────────────────────────────────────────────

class PriceFeed:
    """
    Real-time price feed using Coinbase Advanced Trade WebSocket.
    Calls on_tick(product_id, price, volume) on every ticker update.
    """

    def __init__(self, product_ids: List[str],
                 on_tick: Callable[[str, float, float], None],
                 api_key: str = COINBASE_API_KEY,
                 api_secret: str = COINBASE_API_SECRET):
        self.product_ids = product_ids
        self.on_tick     = on_tick
        self.api_key     = api_key
        self.api_secret  = api_secret
        self._running    = False
        self.prices: Dict[str, float] = {}

    def _sign_subscribe(self, channel: str, product_ids: List[str]) -> Dict:
        """Build a signed subscription message."""
        timestamp = str(int(time.time()))
        msg       = timestamp + channel + ",".join(sorted(product_ids))
        signature = hmac.new(
            self.api_secret.encode("utf-8"),
            msg.encode("utf-8"),
            digestmod=hashlib.sha256
        ).hexdigest()
        return {
            "type":        "subscribe",
            "product_ids": product_ids,
            "channel":     channel,
            "api_key":     self.api_key,
            "timestamp":   timestamp,
            "signature":   signature,
        }

    async def _listen(self):
        sub = self._sign_subscribe("ticker", self.product_ids)
        async with websockets.connect(COINBASE_WS_URL,
                                      ping_interval=20,
                                      ping_timeout=20) as ws:
            await ws.send(json.dumps(sub))
            logger.info(f"WebSocket subscribed: {self.product_ids}")
            async for raw in ws:
                if not self._running:
                    break
                msg = json.loads(raw)
                self._handle(msg)

    def _handle(self, msg: Dict):
        events = msg.get("events", [])
        for event in events:
            tickers = event.get("tickers", [])
            for t in tickers:
                pid   = t.get("product_id")
                price = float(t.get("price", 0))
                vol   = float(t.get("volume_24_h", 0))
                if pid and price:
                    self.prices[pid] = price
                    try:
                        self.on_tick(pid, price, vol)
                    except Exception as e:
                        logger.error(f"on_tick error: {e}")

    def start(self):
        self._running = True
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def _run_forever():
            backoff = 2
            while self._running:
                try:
                    await self._listen()
                except Exception as e:
                    logger.warning(f"WebSocket disconnected: {e}. "
                                   f"Reconnecting in {backoff}s…")
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, 60)

        loop.run_until_complete(_run_forever())

    def stop(self):
        self._running = False
