#!/usr/bin/env python3
"""
Coinbase Algorithmic Trading Bot
=================================
Usage:
  python main.py trade            # run bot (paper mode by default)
  python main.py trade --live     # run in live mode (requires API keys)
  python main.py backtest         # backtest on historical data
  python main.py status           # show portfolio snapshot
  python main.py history          # show recent trades from DB
  python main.py performance      # show strategy performance stats
"""
import sys
import os
import json
import logging

import click

from monitoring.logger import setup_logging

logger = setup_logging("main")


@click.group()
def cli():
    """Coinbase Algorithmic Trading Bot"""
    pass


# ─── Trade ───────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--live",         is_flag=True, default=False,
              help="Enable live trading (default: paper)")
@click.option("--pairs",        default=None,
              help="Comma-separated pairs, e.g. BTC-USD,ETH-USD")
@click.option("--capital",      default=None, type=float,
              help="Starting capital in USD")
@click.option("--no-dashboard", is_flag=True, default=False,
              help="Disable live dashboard")
@click.option("--min-votes",    default=2, type=int,
              help="Min strategy votes for ensemble signal (default: 2)")
def trade(live, pairs, capital, no_dashboard, min_votes):
    """Run the trading bot."""
    from config.settings import (TRADING_PAIRS, STARTING_CAPITAL,
                                   StrategyConfig, RiskConfig)
    from execution.engine import TradingEngine

    mode = "live" if live else "paper"
    pair_list = pairs.split(",") if pairs else TRADING_PAIRS
    cap = capital or STARTING_CAPITAL

    if mode == "live":
        if not os.getenv("COINBASE_API_KEY"):
            click.echo("ERROR: COINBASE_API_KEY not set. "
                       "Add it to .env or export it.", err=True)
            sys.exit(1)

        click.echo(f"\n{'='*60}")
        click.echo(f"  ⚠️  LIVE MODE — Real money will be traded")
        click.echo(f"  Capital: ${cap:,.2f}")
        click.echo(f"  Pairs:   {pair_list}")
        click.echo(f"{'='*60}")
        if not click.confirm("\nAre you sure you want to trade with REAL money?"):
            click.echo("Aborted.")
            sys.exit(0)

    cfg_s = StrategyConfig(ensemble_min_votes=min_votes)
    cfg_r = RiskConfig()

    engine = TradingEngine(
        mode             = mode,
        pairs            = pair_list,
        starting_capital = cap,
        strategy_cfg     = cfg_s,
        risk_cfg         = cfg_r,
        show_dashboard   = not no_dashboard,
    )
    engine.start()


# ─── Backtest ─────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--pair",       default="BTC-USD",    help="Trading pair")
@click.option("--granularity",default="ONE_HOUR",   help="Candle granularity")
@click.option("--bars",       default=500, type=int, help="Number of bars")
@click.option("--capital",    default=500.0, type=float, help="Starting capital")
@click.option("--min-votes",  default=2, type=int)
@click.option("--json-out",   is_flag=True, default=False, help="Output raw JSON")
def backtest(pair, granularity, bars, capital, min_votes, json_out):
    """Backtest the strategy on historical Coinbase data."""
    from core.exchange import CoinbaseClient
    from backtest.runner import Backtester
    from config.settings import StrategyConfig, RiskConfig
    from data.indicators import compute_all
    import pandas as pd

    click.echo(f"Fetching {bars} bars of {granularity} data for {pair}…")
    client = CoinbaseClient()
    candles = client.get_candles(pair, granularity, limit=bars)
    if not candles:
        click.echo("No data returned. Check API keys and pair name.", err=True)
        sys.exit(1)

    df = pd.DataFrame(candles)
    df["time"]   = pd.to_datetime(df["start"].astype(int), unit="s", utc=True)
    df["open"]   = df["open"].astype(float)
    df["high"]   = df["high"].astype(float)
    df["low"]    = df["low"].astype(float)
    df["close"]  = df["close"].astype(float)
    df["volume"] = df["volume"].astype(float)
    df = df.set_index("time").sort_index()[["open","high","low","close","volume"]]

    bt = Backtester(
        strategy_cfg     = StrategyConfig(ensemble_min_votes=min_votes),
        risk_cfg         = RiskConfig(),
        starting_capital = capital,
        min_votes        = min_votes,
    )
    result = bt.run(df, pair, granularity)
    summary = result.summary()

    if json_out:
        click.echo(json.dumps(summary, indent=2))
        return

    click.echo("\n" + "="*55)
    click.echo(f"  BACKTEST RESULTS — {pair}  ({summary['period']})")
    click.echo("="*55)
    for k, v in summary.items():
        if k not in ("product_id", "period"):
            label = k.replace("_", " ").title()
            click.echo(f"  {label:<25} {v}")
    click.echo("="*55)

    if result.trades:
        click.echo(f"\n  Sample trades (last 5):")
        for t in result.trades[-5:]:
            pnl_s = f"{t.pnl:+.2f}"
            click.echo(f"    {t.side:4s} @ ${t.entry_price:,.0f} → "
                       f"${t.exit_price:,.0f}  P&L={pnl_s}  [{t.reason_close}]")


# ─── Status ───────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--json-out", is_flag=True, default=False)
def status(json_out):
    """Show portfolio snapshot from the database."""
    from db.database import TradeDB
    db = TradeDB()
    trades = db.get_recent_trades(1)
    total  = db.total_pnl()

    if json_out:
        click.echo(json.dumps({"total_pnl": total, "recent": trades}, indent=2,
                               default=str))
        return

    click.echo(f"\n  Total Realized P&L : ${total:+,.2f}")
    click.echo(f"  Last trade         : {trades[0] if trades else 'none'}\n")


# ─── History ─────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--limit", default=20, type=int)
@click.option("--mode",  default=None, help="paper or live")
def history(limit, mode):
    """Show recent trades."""
    from db.database import TradeDB
    from rich.table import Table
    from rich.console import Console
    from rich import box

    db     = TradeDB()
    trades = db.get_recent_trades(limit, mode=mode)
    con    = Console()

    tbl = Table(box=box.SIMPLE_HEAVY, title=f"Last {limit} Trades")
    for col in ["Time", "Pair", "Side", "Price", "Size", "P&L", "Strategy", "Mode"]:
        tbl.add_column(col)

    for t in trades:
        pnl = t.get("pnl") or 0
        ts  = str(t.get("timestamp",""))[:19].replace("T"," ")
        tbl.add_row(
            ts,
            str(t.get("product_id","")),
            str(t.get("side","")),
            f"${t.get('price',0):,.2f}",
            f"${t.get('size_usd',0):,.2f}",
            f"{pnl:+.2f}" if t.get("side")=="SELL" else "—",
            str(t.get("strategy","")),
            str(t.get("mode","")),
        )
    con.print(tbl)


# ─── Performance ─────────────────────────────────────────────────────────────

@cli.command()
def performance():
    """Show per-strategy performance stats."""
    from db.database import TradeDB
    from rich.table import Table
    from rich.console import Console
    from rich import box

    db   = TradeDB()
    rows = db.get_strategy_performance()
    con  = Console()

    tbl = Table(box=box.SIMPLE_HEAVY, title="Strategy Performance")
    for col in ["Strategy", "Trades", "Wins", "Total P&L", "Avg P&L"]:
        tbl.add_column(col, justify="right" if col != "Strategy" else "left")

    for r in rows:
        wins  = r.get("wins") or 0
        total = r.get("trades") or 1
        tbl.add_row(
            str(r.get("strategy","")),
            str(r.get("trades",0)),
            f"{wins}/{total} ({wins/total*100:.0f}%)",
            f"${r.get('total_pnl',0):+,.2f}",
            f"${r.get('avg_pnl',0):+,.2f}",
        )
    con.print(tbl)


if __name__ == "__main__":
    cli()
