"""
Central configuration for the trading system.
All tunable parameters live here. Override via .env file.
"""
import os
from dotenv import load_dotenv
from dataclasses import dataclass, field
from typing import List

load_dotenv()


# ─── Coinbase API ────────────────────────────────────────────────────────────
COINBASE_API_KEY    = os.getenv("COINBASE_API_KEY", "")
COINBASE_API_SECRET = os.getenv("COINBASE_API_SECRET", "")
COINBASE_REST_URL   = os.getenv("COINBASE_REST_URL", "https://api.coinbase.com")
COINBASE_WS_URL     = os.getenv("COINBASE_WS_URL",  "wss://advanced-trade-ws.coinbase.com")

# ─── Telegram Alerts ─────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID", "")

# ─── Database ────────────────────────────────────────────────────────────────
DB_PATH = os.getenv("DB_PATH", "db/trades.db")

# ─── Trading Mode ────────────────────────────────────────────────────────────
# "paper" = simulation, no real orders placed
# "live"  = real orders via Coinbase API
TRADING_MODE = os.getenv("TRADING_MODE", "paper")

# ─── Markets to trade ────────────────────────────────────────────────────────
TRADING_PAIRS: List[str] = ["BTC-USD", "ETH-USD"]

# ─── Portfolio / Capital ─────────────────────────────────────────────────────
STARTING_CAPITAL   = float(os.getenv("STARTING_CAPITAL", "500.0"))    # USD deployed
MAX_TOTAL_CAPITAL  = float(os.getenv("MAX_TOTAL_CAPITAL", "17000.0")) # hard ceiling
MAX_POSITION_PCT   = float(os.getenv("MAX_POSITION_PCT", "0.10"))     # 10% per asset
MAX_TRADE_USD      = float(os.getenv("MAX_TRADE_USD", "200.0"))        # per single trade
MIN_TRADE_USD      = float(os.getenv("MIN_TRADE_USD", "10.0"))         # Coinbase minimum

# ─── Risk Management ─────────────────────────────────────────────────────────
STOP_LOSS_PCT      = float(os.getenv("STOP_LOSS_PCT", "0.03"))     # 3% stop loss
TAKE_PROFIT_PCT    = float(os.getenv("TAKE_PROFIT_PCT", "0.06"))   # 6% take profit (2:1 R/R)
TRAILING_STOP_PCT  = float(os.getenv("TRAILING_STOP_PCT", "0.015"))# 1.5% trailing
DAILY_LOSS_LIMIT   = float(os.getenv("DAILY_LOSS_LIMIT", "150.0")) # hard daily stop
MAX_OPEN_POSITIONS = int(os.getenv("MAX_OPEN_POSITIONS", "4"))
KELLY_FRACTION     = float(os.getenv("KELLY_FRACTION", "0.25"))    # fractional Kelly (conservative)

# ─── Strategy Parameters ─────────────────────────────────────────────────────
# RSI
RSI_PERIOD      = int(os.getenv("RSI_PERIOD", "14"))
RSI_OVERSOLD    = float(os.getenv("RSI_OVERSOLD", "35"))
RSI_OVERBOUGHT  = float(os.getenv("RSI_OVERBOUGHT", "65"))

# MACD
MACD_FAST   = int(os.getenv("MACD_FAST", "12"))
MACD_SLOW   = int(os.getenv("MACD_SLOW", "26"))
MACD_SIGNAL = int(os.getenv("MACD_SIGNAL", "9"))

# Bollinger Bands
BB_PERIOD = int(os.getenv("BB_PERIOD", "20"))
BB_STDDEV = float(os.getenv("BB_STDDEV", "2.0"))

# EMA
EMA_SHORT = int(os.getenv("EMA_SHORT", "9"))
EMA_LONG  = int(os.getenv("EMA_LONG", "21"))

# ATR (volatility)
ATR_PERIOD = int(os.getenv("ATR_PERIOD", "14"))

# Volume
VOLUME_MA_PERIOD = int(os.getenv("VOLUME_MA_PERIOD", "20"))
VOLUME_THRESHOLD = float(os.getenv("VOLUME_THRESHOLD", "1.5"))  # 1.5x avg volume

# ─── Execution ───────────────────────────────────────────────────────────────
CANDLE_GRANULARITY = os.getenv("CANDLE_GRANULARITY", "ONE_HOUR")  # ONE_MINUTE, FIVE_MINUTE, ONE_HOUR, ONE_DAY
CANDLE_LOOKBACK    = int(os.getenv("CANDLE_LOOKBACK", "200"))     # candles of history
POLL_INTERVAL_SEC  = int(os.getenv("POLL_INTERVAL_SEC", "60"))    # strategy eval cadence
ORDER_TIMEOUT_SEC  = int(os.getenv("ORDER_TIMEOUT_SEC", "30"))    # cancel if not filled

# ─── Ensemble Voting ─────────────────────────────────────────────────────────
# How many strategies must agree before a trade fires
ENSEMBLE_MIN_VOTES = int(os.getenv("ENSEMBLE_MIN_VOTES", "2"))

# ─── Logging ─────────────────────────────────────────────────────────────────
LOG_LEVEL    = os.getenv("LOG_LEVEL", "INFO")
LOG_DIR      = os.getenv("LOG_DIR", "logs")
LOG_TO_FILE  = os.getenv("LOG_TO_FILE", "true").lower() == "true"


@dataclass
class RiskConfig:
    stop_loss_pct:      float = STOP_LOSS_PCT
    take_profit_pct:    float = TAKE_PROFIT_PCT
    trailing_stop_pct:  float = TRAILING_STOP_PCT
    daily_loss_limit:   float = DAILY_LOSS_LIMIT
    max_open_positions: int   = MAX_OPEN_POSITIONS
    max_position_pct:   float = MAX_POSITION_PCT
    max_trade_usd:      float = MAX_TRADE_USD
    min_trade_usd:      float = MIN_TRADE_USD
    kelly_fraction:     float = KELLY_FRACTION


@dataclass
class StrategyConfig:
    rsi_period:      int   = RSI_PERIOD
    rsi_oversold:    float = RSI_OVERSOLD
    rsi_overbought:  float = RSI_OVERBOUGHT
    macd_fast:       int   = MACD_FAST
    macd_slow:       int   = MACD_SLOW
    macd_signal:     int   = MACD_SIGNAL
    bb_period:       int   = BB_PERIOD
    bb_stddev:       float = BB_STDDEV
    ema_short:       int   = EMA_SHORT
    ema_long:        int   = EMA_LONG
    atr_period:      int   = ATR_PERIOD
    volume_ma_period: int  = VOLUME_MA_PERIOD
    volume_threshold: float= VOLUME_THRESHOLD
    ensemble_min_votes: int= ENSEMBLE_MIN_VOTES
