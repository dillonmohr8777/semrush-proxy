# Coinbase Trading Bot

A Python trading bot that connects to your Coinbase account via the official Advanced Trade API. It evaluates BTC-USD, ETH-USD, and SOL-USD using technical indicators and executes trades in **paper mode by default**.

---

## SECURITY WARNING

> **NEVER** commit your `.env` file, API key, or API secret to version control.
>
> **NEVER** share your API credentials with anyone.
>
> **NEVER** run this bot with real trading enabled unless you fully understand the risks.
>
> Your API secret is an EC private key — treat it like a password to your funds.
>
> Add `.env` to your `.gitignore` **immediately**.

---

## Quick Start

### 1. Install dependencies

```bash
cd coinbase_trading_bot
pip install -r requirements.txt
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

### 3. Add your Coinbase API credentials

Open `.env` in a text editor and fill in:

```
COINBASE_API_KEY=your_api_key_here
COINBASE_API_SECRET=-----BEGIN EC PRIVATE KEY-----\nYOUR_KEY_CONTENT_HERE\n-----END EC PRIVATE KEY-----\n
```

**Where to get your credentials:**

1. Go to [Coinbase Developer Platform](https://portal.cdp.coinbase.com/access/api)
2. Create a new API key
3. Select **"Advanced Trade"** permissions
4. For safe first use: grant **"View"** permission only (read-only)
5. Copy the API key name and the EC private key (PEM format)

**IMPORTANT:** The API secret is a multi-line PEM key. In your `.env` file, replace newlines with `\n` so it fits on a single line, or use quotes:

```
COINBASE_API_SECRET="-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIBkg...
-----END EC PRIVATE KEY-----"
```

### 4. Run in safe paper mode (default)

```bash
python main.py
```

On first run the bot will:
- Authenticate with your Coinbase account
- Fetch and display your balances (read-only)
- Fetch market data for BTC-USD, ETH-USD, SOL-USD
- Evaluate trade signals using technical indicators
- Execute trades **only in paper mode** (simulated)
- **No real orders will be placed**

---

## Trading Modes

| Environment Setting | Mode | Real Orders? |
|---|---|---|
| `PAPER_TRADING=true` (default) | PAPER | No |
| `PAPER_TRADING=false`, `ENABLE_REAL_TRADING=false` | REAL_DISABLED | No |
| `PAPER_TRADING=false`, `ENABLE_REAL_TRADING=true` | REAL_ENABLED | **YES** |

**Both flags must be explicitly changed for real trading to activate.** This is a double safety lock.

---

## How to Keep It Safe (Read-Only / Paper Mode)

1. **API Key Permissions:** When creating your API key on Coinbase, grant only "View" permission. The bot will still run — it will authenticate, fetch balances, fetch market data, and paper trade. It simply won't be able to place real orders even if you flip the toggle.

2. **Environment toggles:** Leave the defaults:
   ```
   ENABLE_REAL_TRADING=false
   PAPER_TRADING=true
   ```

3. **When you're ready to enable real trading:**
   - Update your API key permissions on Coinbase to include "Trade"
   - Set `PAPER_TRADING=false`
   - Set `ENABLE_REAL_TRADING=true`
   - The bot will preview every order before placing it

---

## Project Structure

```
coinbase_trading_bot/
├── main.py                        # Entry point and main loop
├── config.py                      # Configuration from environment
├── auth/
│   └── jwt_auth.py                # JWT signing for Coinbase API
├── clients/
│   ├── advanced_trade_client.py   # Low-level HTTP client
│   └── market_data_client.py      # Candles, prices, order book
├── strategy/
│   ├── indicators.py              # EMA, RSI, ATR, momentum
│   ├── signal_engine.py           # Confidence scoring and signals
│   └── risk.py                    # Position sizing, loss limits
├── execution/
│   ├── paper_engine.py            # Paper trading engine
│   ├── real_engine.py             # Real order engine (disabled by default)
│   └── order_preview.py           # Coinbase order preview
├── portfolio/
│   ├── account_service.py         # Balance and account queries
│   └── positions.py               # Position tracking
├── utils/
│   ├── logger.py                  # Logging (never logs secrets)
│   ├── types.py                   # Shared data types
│   └── retry.py                   # Retry with backoff
├── output/                        # Log files
├── requirements.txt
├── .env.example
└── README.md
```

---

## Strategy

The bot evaluates each trading pair using:

| Indicator | Description |
|---|---|
| EMA 9/21/50 | Trend alignment |
| RSI 14 | Overbought/oversold |
| ATR 14 | Volatility and stop placement |
| Order book imbalance | Bid/ask pressure |
| Momentum (5-period) | Short-term direction |

Signals are scored 0-100 and generate: **LONG**, **SHORT**, or **NO TRADE**.

---

## Risk Rules

- Risk 1% of equity per trade
- Minimum risk/reward ratio: 2:1
- Confidence threshold: 65%
- Maximum notional per trade: $5,000
- Daily loss limit: 5% of equity
- Cooldown after stop loss: 5 minutes
- Estimated fees included in calculations

---

## Terminal Output

Each cycle prints per asset:
```
  Timestamp : 2026-04-05 12:00:00 UTC
  Asset     : BTC-USD
  Price     : $84250.00
  Bias      : LONG
  Confidence: 72.0%
  Entry     : $84250.00
  Stop      : $83100.00
  Target    : $86550.00
  R:R       : 2.00
  Equity    : $10000.00
  Mode      : PAPER
```

---

## Logging

Logs are written to `output/bot.log`. API secrets are **never** logged.
