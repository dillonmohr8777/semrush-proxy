"""
Configuration loader for the Coinbase trading bot.
All secrets are read from environment variables — never hardcoded.
"""

import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from dotenv import load_dotenv


def _load_env() -> None:
    """Load .env file from the project root if it exists."""
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)


_load_env()


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        print(f"FATAL: Required environment variable {name} is not set.", file=sys.stderr)
        print("Copy .env.example to .env and fill in your credentials.", file=sys.stderr)
        sys.exit(1)
    return value


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("true", "1", "yes")


def _float_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class CoinbaseCredentials:
    api_key: str
    api_secret: str

    def __repr__(self) -> str:
        return f"CoinbaseCredentials(api_key='{self.api_key[:6]}...', api_secret='***')"


@dataclass(frozen=True)
class RiskConfig:
    risk_per_trade_pct: float = 1.0
    min_risk_reward: float = 2.0
    confidence_threshold: float = 65.0
    max_notional_per_trade: float = 5000.0
    daily_loss_limit_pct: float = 5.0
    cooldown_after_stop_loss_seconds: int = 300


@dataclass(frozen=True)
class TradingConfig:
    enable_real_trading: bool = False
    paper_trading: bool = True
    paper_starting_balance: float = 10000.0
    trading_pairs: list[str] = field(default_factory=lambda: ["BTC-USD", "ETH-USD", "SOL-USD"])
    cycle_interval_seconds: int = 60
    portfolio_id: str | None = None


@dataclass(frozen=True)
class BotConfig:
    credentials: CoinbaseCredentials
    trading: TradingConfig
    risk: RiskConfig
    log_level: str = "INFO"

    @property
    def is_real_trading_active(self) -> bool:
        """Real trading requires BOTH the explicit toggle AND paper mode off."""
        return self.trading.enable_real_trading and not self.trading.paper_trading

    @property
    def mode_label(self) -> str:
        if self.trading.paper_trading:
            return "PAPER"
        if self.trading.enable_real_trading:
            return "REAL_ENABLED"
        return "REAL_DISABLED"


def load_config() -> BotConfig:
    credentials = CoinbaseCredentials(
        api_key=_require_env("COINBASE_API_KEY"),
        api_secret=_require_env("COINBASE_API_SECRET"),
    )

    pairs_raw = os.getenv("TRADING_PAIRS", "BTC-USD,ETH-USD,SOL-USD")
    trading_pairs = [p.strip() for p in pairs_raw.split(",") if p.strip()]

    portfolio_id = os.getenv("COINBASE_PORTFOLIO_ID", "").strip() or None

    trading = TradingConfig(
        enable_real_trading=_bool_env("ENABLE_REAL_TRADING", False),
        paper_trading=_bool_env("PAPER_TRADING", True),
        paper_starting_balance=_float_env("PAPER_STARTING_BALANCE", 10000.0),
        trading_pairs=trading_pairs,
        cycle_interval_seconds=_int_env("CYCLE_INTERVAL_SECONDS", 60),
        portfolio_id=portfolio_id,
    )

    risk = RiskConfig(
        risk_per_trade_pct=_float_env("RISK_PER_TRADE_PCT", 1.0),
        min_risk_reward=_float_env("MIN_RISK_REWARD", 2.0),
        confidence_threshold=_float_env("CONFIDENCE_THRESHOLD", 65.0),
        max_notional_per_trade=_float_env("MAX_NOTIONAL_PER_TRADE", 5000.0),
        daily_loss_limit_pct=_float_env("DAILY_LOSS_LIMIT_PCT", 5.0),
        cooldown_after_stop_loss_seconds=_int_env("COOLDOWN_AFTER_STOP_LOSS_SECONDS", 300),
    )

    log_level = os.getenv("LOG_LEVEL", "INFO").upper()

    return BotConfig(
        credentials=credentials,
        trading=trading,
        risk=risk,
        log_level=log_level,
    )
