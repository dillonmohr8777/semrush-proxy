# Coinbase Algorithmic Trading Bot

Fully automated trading system for BTC/ETH on Coinbase Advanced Trade.

## Architecture

```
├── config/settings.py        ← All tunable parameters (.env override)
├── core/
│   ├── exchange.py           ← Coinbase REST + WebSocket client
│   ├── risk.py               ← Risk engine (Kelly sizing, stops, daily limits)
│   └── portfolio.py          ← Position tracking + P&L
├── data/
│   ├── feed.py               ← Historical candle loader + rolling cache
│   └── indicators.py         ← RSI, MACD, BB, EMA, ATR, VWAP, ADX, Stochastic
├── strategies/
│   ├── momentum.py           ← RSI + MACD crossover + volume filter
│   ├── mean_reversion.py     ← Bollinger Bands + Stochastic bounce
│   ├── trend_following.py    ← EMA crossover + VWAP + ADX
│   └── ensemble.py           ← Multi-strategy vote aggregator
├── execution/
│   ├── paper.py              ← Simulated fills (no real orders)
│   ├── live.py               ← Real Coinbase orders with fill confirmation
│   └── engine.py             ← Main event loop
├── backtest/runner.py        ← Historical strategy simulation
├── monitoring/
│   ├── alerts.py             ← Telegram + console alerts
│   ├── logger.py             ← Structured rotating log files
│   └── dashboard.py          ← Rich CLI live dashboard
├── db/database.py            ← SQLite trade journal
└── main.py                   ← CLI entry point
```

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure
```bash
cp .env.example .env
# Edit .env — add Coinbase API keys, Telegram (optional)
```

### 3. Run in paper mode (safe, no real trades)
```bash
python main.py trade
```

### 4. Backtest first
```bash
python main.py backtest --pair BTC-USD --bars 500 --capital 500
```

### 5. Go live (after validating paper results)
```bash
python main.py trade --live --capital 500
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `python main.py trade` | Run bot (paper mode) |
| `python main.py trade --live` | Run bot (live mode) |
| `python main.py trade --pairs ETH-USD --capital 200` | Custom config |
| `python main.py backtest --pair BTC-USD --bars 500` | Backtest |
| `python main.py history` | Recent trades |
| `python main.py performance` | Per-strategy stats |
| `python main.py status` | Portfolio snapshot |

## Risk Management

| Parameter | Default | Description |
|-----------|---------|-------------|
| `STOP_LOSS_PCT` | 3% | Per-trade stop loss |
| `TAKE_PROFIT_PCT` | 6% | Per-trade take profit (2:1 R/R) |
| `TRAILING_STOP_PCT` | 1.5% | Trailing stop ratchet |
| `DAILY_LOSS_LIMIT` | $150 | Bot halts if daily loss exceeds this |
| `MAX_OPEN_POSITIONS` | 4 | Max simultaneous positions |
| `MAX_TRADE_USD` | $200 | Hard cap per trade |
| `KELLY_FRACTION` | 0.25 | Conservative fractional Kelly sizing |

## Strategies

**Ensemble voting** — a trade only fires when ≥2 strategies agree:

1. **Momentum** — RSI crossover + MACD histogram + volume spike + ADX trend filter
2. **Mean Reversion** — Bollinger Band touch + Stochastic bounce + ADX ranging filter
3. **Trend Following** — EMA golden/death cross + VWAP + ADX strength

## Coinbase API Keys

1. Go to [Coinbase Advanced Trade](https://www.coinbase.com/settings/api)
2. Create API key with permissions: **View** + **Trade**
3. Add to `.env`

## Telegram Alerts (Optional)

1. Create bot: message `@BotFather` → `/newbot`
2. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to `.env`
3. You'll get trade alerts, daily summaries, and risk warnings

## Risk Disclaimer

This software is for educational and research purposes. Algorithmic trading
involves substantial risk of loss. Past backtest performance does not guarantee
future results. Never trade with money you cannot afford to lose. Start with
paper trading and small live amounts to validate strategy performance.