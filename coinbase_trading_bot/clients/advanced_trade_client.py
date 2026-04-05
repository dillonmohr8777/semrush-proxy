"""
Low-level HTTP client for the Coinbase Advanced Trade REST API.

Handles request signing, base URL management, and response parsing.
All higher-level clients (market data, account, orders) build on this.
"""

import requests
from typing import Any, Optional

from config import BotConfig
from auth.jwt_auth import get_auth_headers
from utils.logger import get_logger
from utils.retry import retry

logger = get_logger("advanced_trade_client")

BASE_URL = "https://api.coinbase.com"


class AdvancedTradeClient:
    """Authenticated HTTP client for Coinbase Advanced Trade API."""

    def __init__(self, config: BotConfig) -> None:
        self._config = config
        self._credentials = config.credentials
        self._session = requests.Session()

    @retry(max_attempts=3, base_delay=1.0)
    def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> requests.Response:
        url = f"{BASE_URL}{path}"
        headers = get_auth_headers(self._credentials, method, path)

        response = self._session.request(
            method=method,
            url=url,
            headers=headers,
            params=params,
            json=json_body,
            timeout=30,
        )
        return response

    def get(
        self, path: str, params: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        resp = self._request("GET", path, params=params)
        resp.raise_for_status()
        return resp.json()

    def post(
        self, path: str, json_body: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        resp = self._request("POST", path, json_body=json_body)
        resp.raise_for_status()
        return resp.json()

    # ── Read-only convenience methods ──────────────────────────────────

    def list_accounts(self, limit: int = 49) -> list[dict]:
        """Fetch all trading accounts (wallets)."""
        data = self.get("/api/v3/brokerage/accounts", params={"limit": limit})
        return data.get("accounts", [])

    def get_account(self, account_id: str) -> dict:
        return self.get(f"/api/v3/brokerage/accounts/{account_id}")

    def get_product(self, product_id: str) -> dict:
        return self.get(f"/api/v3/brokerage/market/products/{product_id}")

    def get_product_candles(
        self,
        product_id: str,
        start: int,
        end: int,
        granularity: str = "ONE_HOUR",
    ) -> list[dict]:
        """
        Fetch historical candles.
        granularity: ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE,
                     THIRTY_MINUTE, ONE_HOUR, TWO_HOUR, SIX_HOUR, ONE_DAY
        """
        data = self.get(
            f"/api/v3/brokerage/market/products/{product_id}/candles",
            params={
                "start": str(start),
                "end": str(end),
                "granularity": granularity,
            },
        )
        return data.get("candles", [])

    def get_product_book(
        self, product_id: str, limit: int = 10
    ) -> dict:
        """Fetch Level 2 order book snapshot."""
        data = self.get(
            "/api/v3/brokerage/market/product_book",
            params={"product_id": product_id, "limit": limit},
        )
        return data.get("pricebook", {})

    def list_orders(
        self,
        product_id: str | None = None,
        order_status: list[str] | None = None,
        limit: int = 100,
    ) -> list[dict]:
        params: dict[str, Any] = {"limit": limit}
        if product_id:
            params["product_id"] = product_id
        if order_status:
            params["order_status"] = order_status
        data = self.get("/api/v3/brokerage/orders/historical/batch", params=params)
        return data.get("orders", [])

    def list_fills(
        self,
        product_id: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        params: dict[str, Any] = {"limit": limit}
        if product_id:
            params["product_id"] = product_id
        data = self.get("/api/v3/brokerage/orders/historical/fills", params=params)
        return data.get("fills", [])

    # ── Trading methods (require ENABLE_REAL_TRADING) ─────────────────

    def preview_order(self, order_body: dict[str, Any]) -> dict:
        """Preview an order without placing it."""
        return self.post("/api/v3/brokerage/orders/preview", json_body=order_body)

    def create_order(self, order_body: dict[str, Any]) -> dict:
        """
        Place a real order. This method is only called by real_engine
        which enforces the ENABLE_REAL_TRADING guard.
        """
        return self.post("/api/v3/brokerage/orders", json_body=order_body)

    # ── Portfolio-aware methods ───────────────────────────────────────

    def list_portfolios(self) -> list[dict]:
        data = self.get("/api/v3/brokerage/portfolios")
        return data.get("portfolios", [])

    def get_portfolio_breakdown(self, portfolio_id: str) -> dict:
        return self.get(f"/api/v3/brokerage/portfolios/{portfolio_id}")
