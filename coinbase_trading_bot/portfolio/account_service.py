"""
Account service — read-only methods for account balances and info.
"""

from clients.advanced_trade_client import AdvancedTradeClient
from config import BotConfig
from utils.logger import get_logger
from utils.types import AccountBalance

logger = get_logger("account_service")


class AccountService:
    def __init__(self, client: AdvancedTradeClient, config: BotConfig) -> None:
        self._client = client
        self._config = config

    def get_all_balances(self) -> list[AccountBalance]:
        """Fetch all account balances with non-zero totals."""
        accounts = self._client.list_accounts()
        balances = []
        for acct in accounts:
            available = float(acct.get("available_balance", {}).get("value", 0))
            hold = float(acct.get("hold", {}).get("value", 0))
            total = available + hold
            if total > 0:
                balances.append(
                    AccountBalance(
                        currency=acct.get("currency", ""),
                        available=available,
                        hold=hold,
                        total=total,
                    )
                )
        return balances

    def get_usd_balance(self) -> float:
        """Return the available USD balance."""
        for bal in self.get_all_balances():
            if bal.currency == "USD":
                return bal.available
        return 0.0

    def get_portfolio_breakdown(self) -> dict | None:
        """If a portfolio ID is configured, fetch its breakdown."""
        pid = self._config.trading.portfolio_id
        if not pid:
            return None
        return self._client.get_portfolio_breakdown(pid)

    def get_open_orders(self, product_id: str | None = None) -> list[dict]:
        return self._client.list_orders(
            product_id=product_id, order_status=["OPEN", "PENDING"]
        )

    def get_fills(self, product_id: str | None = None, limit: int = 50) -> list[dict]:
        return self._client.list_fills(product_id=product_id, limit=limit)

    def print_balances_summary(self) -> None:
        balances = self.get_all_balances()
        if not balances:
            logger.info("No balances found (or unable to fetch).")
            return
        logger.info("── Account Balances ──")
        for b in balances:
            logger.info(
                "  %s: available=%.8f  hold=%.8f  total=%.8f",
                b.currency, b.available, b.hold, b.total,
            )
