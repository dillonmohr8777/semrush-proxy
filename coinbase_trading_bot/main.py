#!/usr/bin/env python3
"""
Coinbase Trading Bot — Main entry point.

Default behavior:
  - Connects to your Coinbase account (read-only)
  - Fetches balances and market data
  - Runs strategy evaluation
  - Executes trades in PAPER mode only

Real trading is impossible unless you explicitly set:
  ENABLE_REAL_TRADING=true
  PAPER_TRADING=false
"""

import sys
import time
from datetime import datetime

from config import load_config, BotConfig
from clients.advanced_trade_client import AdvancedTradeClient
from clients.market_data_client import MarketDataClient
from portfolio.account_service import AccountService
from strategy import signal_engine
from execution.paper_engine import PaperEngine
from execution.real_engine import RealEngine, RealTradingDisabledError
from utils.logger import setup_logger, get_logger


def print_banner(config: BotConfig) -> None:
    logger = get_logger("main")
    mode = config.mode_label
    logger.info("=" * 60)
    logger.info("  COINBASE TRADING BOT")
    logger.info("  Mode: %s", mode)
    logger.info("  Pairs: %s", ", ".join(config.trading.trading_pairs))
    logger.info("  Cycle interval: %ds", config.trading.cycle_interval_seconds)
    logger.info("  Risk per trade: %.1f%%", config.risk.risk_per_trade_pct)
    logger.info("  Min R:R: %.1f", config.risk.min_risk_reward)
    logger.info("  Confidence threshold: %.0f%%", config.risk.confidence_threshold)
    if config.trading.paper_trading:
        logger.info("  Paper starting balance: $%.2f", config.trading.paper_starting_balance)
    logger.info("=" * 60)

    if mode == "REAL_ENABLED":
        logger.warning("*** REAL TRADING IS ENABLED — REAL MONEY AT RISK ***")
    else:
        logger.info("Safe mode: no real orders will be placed.")


def print_cycle_output(
    asset: str,
    price: float,
    signal,
    equity: float,
    balances_str: str,
    mode: str,
) -> None:
    logger = get_logger("main")
    logger.info("─" * 60)
    logger.info("  Timestamp : %s", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"))
    logger.info("  Asset     : %s", asset)
    logger.info("  Price     : $%.2f", price)
    logger.info("  Bias      : %s", signal.bias.value)
    logger.info("  Confidence: %.1f%%", signal.confidence)
    logger.info("  Action    : %s", signal.bias.value)
    logger.info("  Entry     : $%.2f", signal.entry)
    logger.info("  Stop      : $%.2f", signal.stop_loss)
    logger.info("  Target    : $%.2f", signal.target)
    logger.info("  R:R       : %.2f", signal.risk_reward)
    logger.info("  Equity    : $%.2f", equity)
    logger.info("  Balances  : %s", balances_str)
    logger.info("  Mode      : %s", mode)


def run_cycle(
    config: BotConfig,
    api_client: AdvancedTradeClient,
    market_data: MarketDataClient,
    account_svc: AccountService,
    paper_engine: PaperEngine,
    real_engine: RealEngine,
) -> None:
    logger = get_logger("main")
    mode = config.mode_label

    # ── Fetch current prices for all pairs ──
    prices: dict[str, float] = {}
    for pair in config.trading.trading_pairs:
        try:
            prices[pair] = market_data.get_current_price(pair)
        except Exception as e:
            logger.error("Failed to fetch price for %s: %s", pair, e)

    # ── Manage open paper positions ──
    if config.trading.paper_trading:
        paper_engine.manage_open_positions(prices)

    # ── Build balances summary ──
    balances_str = "paper-mode"
    try:
        balances = account_svc.get_all_balances()
        parts = [f"{b.currency}:{b.available:.4f}" for b in balances[:5]]
        balances_str = " | ".join(parts) if parts else "no balances"
    except Exception as e:
        logger.debug("Could not fetch live balances: %s", e)

    # ── Determine equity ──
    if config.trading.paper_trading:
        equity = paper_engine.get_equity()
    else:
        equity = account_svc.get_usd_balance()

    # ── Evaluate signals for each pair ──
    for pair in config.trading.trading_pairs:
        price = prices.get(pair)
        if price is None or price <= 0:
            logger.warning("Skipping %s — no valid price", pair)
            continue

        try:
            candles = market_data.get_candles(pair, count=100, granularity="ONE_HOUR")
        except Exception as e:
            logger.error("Failed to fetch candles for %s: %s", pair, e)
            continue

        try:
            ob_imbalance = market_data.get_order_book_imbalance(pair)
        except Exception as e:
            logger.debug("Order book fetch failed for %s: %s", pair, e)
            ob_imbalance = 0.0

        signal = signal_engine.evaluate(pair, candles, ob_imbalance, config.risk)

        # Print cycle output
        print_cycle_output(pair, price, signal, equity, balances_str, mode)

        # ── Execute ──
        if config.trading.paper_trading:
            paper_engine.execute_signal(signal)
        elif config.is_real_trading_active:
            try:
                real_engine.execute_signal(signal, equity)
            except RealTradingDisabledError:
                logger.error("Real trading guard triggered — this should not happen")
        else:
            logger.info("%s: real trading disabled, signal logged only", pair)

    # ── Paper summary ──
    if config.trading.paper_trading:
        summary = paper_engine.get_summary(prices)
        logger.info("─" * 60)
        logger.info("  PAPER SUMMARY")
        logger.info("    Equity       : $%.2f", summary["equity"])
        logger.info("    Unrealized   : $%.2f", summary["unrealized_pnl"])
        logger.info("    Total Equity : $%.2f", summary["total_equity"])
        logger.info("    Realized PnL : $%.2f", summary["realized_pnl"])
        logger.info("    Today PnL    : $%.2f", summary["today_pnl"])
        logger.info("    Open Pos     : %d", summary["open_positions"])
        logger.info("    Total Trades : %d", summary["total_trades"])


def main() -> None:
    config = load_config()
    setup_logger(config.log_level)
    logger = get_logger("main")

    print_banner(config)

    # ── Initialize components ──
    api_client = AdvancedTradeClient(config)
    market_data = MarketDataClient(api_client, config)
    account_svc = AccountService(api_client, config)
    paper_engine = PaperEngine(config)
    real_engine = RealEngine(api_client, config)

    # ── Startup: verify connectivity ──
    logger.info("Verifying Coinbase API connectivity...")
    try:
        account_svc.print_balances_summary()
        logger.info("Authentication successful.")
    except Exception as e:
        logger.error("Failed to connect to Coinbase API: %s", e)
        logger.error("Check your COINBASE_API_KEY and COINBASE_API_SECRET.")
        sys.exit(1)

    # ── Main loop ──
    logger.info("Starting trading loop (Ctrl+C to stop)...")
    try:
        while True:
            try:
                run_cycle(
                    config, api_client, market_data,
                    account_svc, paper_engine, real_engine,
                )
            except KeyboardInterrupt:
                raise
            except Exception as e:
                logger.error("Cycle error: %s", e, exc_info=True)

            time.sleep(config.trading.cycle_interval_seconds)

    except KeyboardInterrupt:
        logger.info("Bot stopped by user.")

    # ── Final summary ──
    if config.trading.paper_trading:
        prices_final: dict[str, float] = {}
        for pair in config.trading.trading_pairs:
            try:
                prices_final[pair] = market_data.get_current_price(pair)
            except Exception:
                pass
        summary = paper_engine.get_summary(prices_final)
        logger.info("=" * 60)
        logger.info("  FINAL PAPER TRADING SUMMARY")
        for k, v in summary.items():
            logger.info("    %-16s: %s", k, v)
        logger.info("=" * 60)


if __name__ == "__main__":
    main()
