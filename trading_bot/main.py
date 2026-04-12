#!/usr/bin/env python3
"""
Leveraged Crypto Paper Trading Bot
===================================
Disciplined, risk-controlled trading system with long/short capability.
Uses multi-timeframe confluence analysis and conservative leverage modeling.

PAPER MODE ONLY by default. Never trades real money without explicit override.

Usage:
    python main.py                     # Run with defaults (BTC, ETH, SOL)
    python main.py --symbols BTC-USD   # Single asset
    python main.py --interval 30       # 30 second cycles
    python main.py --balance 50000     # Start with $50k
"""
import sys
import os
import time
import signal
import argparse
import random
from datetime import datetime
from typing import Dict, Optional

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import BotConfig, RiskConfig, LeverageConfig, StrategyConfig, DataConfig, LogConfig
from utils.types import (
    Action, Side, Signal, MarketContext, IndicatorSnapshot,
    Position, Regime, Candle
)
from utils.logger import Logger
from data.market_data_client import MarketDataClient, CandleBuilder
from strategy.indicators import compute_indicators
from strategy.signal_engine import SignalEngine
from strategy.risk import RiskManager
from strategy.leverage_model import liquidation_distance_pct
from execution.paper_engine import PaperEngine
from execution.trade_manager import TradeManager
from execution.coinbase_client import CoinbaseClient
from execution.live_engine import LiveEngine, SafetyGate
from portfolio.drawdown import DrawdownTracker
from portfolio.metrics import compute_metrics, format_metrics_table


class TradingBot:
    def __init__(self, config: BotConfig):
        self.config = config
        self.running = False
        self.cycle_count = 0
        self.live_mode = not config.paper_mode

        # Initialize components
        self.logger = Logger(
            output_dir=config.log.output_dir,
            trade_csv=config.log.trade_log_csv,
            equity_csv=config.log.equity_log_csv,
            state_json=config.log.state_json,
            event_log=config.log.event_log,
        )

        self.market_data = MarketDataClient(
            base_url=config.data.base_url,
            symbols=config.data.symbols,
            demo_mode=config.data.demo_mode,
            demo_prices=config.data.demo_prices,
            timeout=config.data.api_timeout,
            max_retries=config.data.max_retries,
        )

        self.candle_builder = CandleBuilder(max_candles=config.data.max_candles)

        self.risk_manager = RiskManager(config.risk, config.leverage)
        self.trade_manager = TradeManager(config.strategy)
        self.signal_engine = SignalEngine(config.strategy, config.leverage, config.risk)

        # Coinbase client (used for live data and live execution)
        self.coinbase_client = CoinbaseClient()

        if self.live_mode:
            # LIVE MODE: real Coinbase execution with safety gates
            self.safety = SafetyGate(
                max_order_usd=500.0,        # Hard cap per order
                max_daily_orders=20,
                confirmation_trades=5,       # First 5 trades use min size
                min_balance_reserve_usd=100.0,
            )
            self.engine = LiveEngine(
                client=self.coinbase_client,
                risk_manager=self.risk_manager,
                trade_manager=self.trade_manager,
                logger=self.logger,
                safety=self.safety,
                fee_pct=config.risk.taker_fee_pct,
            )
        else:
            # PAPER MODE: simulated execution
            self.engine = PaperEngine(
                self.risk_manager, self.trade_manager,
                self.logger, fee_pct=config.risk.taker_fee_pct,
            )

        self.drawdown_tracker = DrawdownTracker(config.risk.starting_balance)

    def start(self):
        """Main entry point. Run the bot loop."""
        self.running = True
        signal.signal(signal.SIGINT, self._shutdown)
        signal.signal(signal.SIGTERM, self._shutdown)

        self._print_banner()
        self.logger.event(f"Bot started in {'LIVE' if self.live_mode else 'PAPER'} mode")

        # LIVE MODE: preflight checks
        if self.live_mode:
            print("\n  Running preflight checks...")
            ok, msg = self.engine.preflight_check()
            if not ok:
                print(f"\n  *** {msg} ***")
                print("  Cannot start in live mode. Fix the issue or use --demo.")
                return
            print(f"  {msg}")
            print("\n  *** LIVE MODE ACTIVE — REAL MONEY AT RISK ***")
            print("  Safety gates: max $500/order, 5-trade confirmation period")
            print("  Press Ctrl+C to stop.\n")

        # Seed historical candles
        print("\n  Seeding historical candle data...")
        if not self.config.data.demo_mode and self.coinbase_client.authenticated:
            # Use real Coinbase candle data
            self.market_data.seed_from_coinbase(
                self.coinbase_client, self.candle_builder,
                self.config.data.timeframes,
            )
        else:
            self._seed_candles()
        print("  Candle history seeded. Trading active.\n")

        try:
            while self.running:
                self._run_cycle(False, 0, 0)

                if self.running:
                    time.sleep(self.config.data.cycle_interval_seconds)

        except Exception as e:
            self.logger.error(f"Fatal error: {e}")
            print(f"\n  FATAL ERROR: {e}")
            raise
        finally:
            self._print_final_report()

    def _seed_candles(self):
        """
        Pre-seed candle history with simulated price data so indicators
        are immediately available. Generates enough candles for EMA200 + RSI + ATR.
        """
        from datetime import timedelta
        num_candles = 220  # Enough for EMA200

        for symbol in self.config.data.symbols:
            base_price = self.market_data.get_price(symbol)

            for tf_name, tf_seconds in self.config.data.timeframes.items():
                # Generate historical candles going back in time
                start_time = datetime.utcnow() - timedelta(seconds=tf_seconds * num_candles)

                price = base_price
                for i in range(num_candles):
                    ts = start_time + timedelta(seconds=tf_seconds * i)

                    # Simulate realistic OHLCV
                    vol_pct = {"BTC-USD": 0.003, "ETH-USD": 0.005, "SOL-USD": 0.008}.get(symbol, 0.005)
                    change = random.gauss(0, vol_pct)
                    intra_vol = abs(random.gauss(0, vol_pct * 0.7))

                    open_p = price
                    close_p = price * (1 + change)
                    high_p = max(open_p, close_p) * (1 + intra_vol)
                    low_p = min(open_p, close_p) * (1 - intra_vol)
                    volume = random.uniform(50, 300)

                    candle = Candle(
                        timestamp=ts, open=open_p, high=high_p,
                        low=low_p, close=close_p, volume=volume,
                    )

                    # Directly inject into candle builder
                    if symbol not in self.candle_builder._candles:
                        self.candle_builder._candles[symbol] = {}
                        self.candle_builder._building[symbol] = {}
                    if tf_name not in self.candle_builder._candles[symbol]:
                        self.candle_builder._candles[symbol][tf_name] = []
                        self.candle_builder._building[symbol][tf_name] = None

                    self.candle_builder._candles[symbol][tf_name].append(candle)
                    price = close_p

            coin = symbol.split("-")[0]
            print(f"    {coin}: {num_candles} candles seeded across {len(self.config.data.timeframes)} timeframes")

    def _run_cycle(self, is_warmup: bool, cycle: int, warmup_total: int):
        """Execute one analysis/trading cycle."""
        self.cycle_count += 1
        now = datetime.utcnow()
        ts = now.strftime("%H:%M:%S")

        # Fetch prices
        prices = self.market_data.get_prices()

        # Feed prices into candle builder (simulate volume)
        for symbol, price in prices.items():
            vol = random.uniform(50, 200)  # Simulated volume
            for tf_name, tf_seconds in self.config.data.timeframes.items():
                self.candle_builder.feed_price(symbol, price, vol, now, tf_seconds, tf_name)

        # Compute indicators per symbol per timeframe
        all_indicators: Dict[str, Dict[str, Optional[IndicatorSnapshot]]] = {}
        for symbol in self.config.data.symbols:
            all_indicators[symbol] = {}
            for tf_name in self.config.data.timeframes:
                candles = self.candle_builder.get_candles(symbol, tf_name)
                if len(candles) >= 22:  # Minimum for EMA21 + RSI
                    ind = compute_indicators(
                        candles,
                        ema_fast=self.config.strategy.ema_fast,
                        ema_mid=self.config.strategy.ema_mid,
                        ema_slow=self.config.strategy.ema_slow,
                        ema_trend=self.config.strategy.ema_trend,
                        rsi_period=self.config.strategy.rsi_period,
                        atr_period=self.config.strategy.atr_period,
                    )
                    all_indicators[symbol][tf_name] = ind
                else:
                    all_indicators[symbol][tf_name] = None

        # Update positions
        primary_indicators = {
            s: all_indicators[s].get(self.config.data.primary_timeframe)
            for s in self.config.data.symbols
        }
        closed = self.engine.update_positions(prices, primary_indicators)

        # Get equity snapshot
        eq = self.engine.get_equity_snapshot(prices)
        self.drawdown_tracker.update(eq.equity)
        self.logger.log_equity(eq)

        # Evaluate signals for each symbol
        signals: Dict[str, Signal] = {}
        for symbol in self.config.data.symbols:
            ctx = MarketContext(
                symbol=symbol,
                price=prices[symbol],
                timestamp=now,
                tf_1m=all_indicators[symbol].get("1m"),
                tf_5m=all_indicators[symbol].get("5m"),
                tf_15m=all_indicators[symbol].get("15m"),
                tf_1h=all_indicators[symbol].get("1h"),
            )

            sig = self.signal_engine.evaluate(
                ctx, self.risk_manager, self.engine.positions
            )
            signals[symbol] = sig

            # Execute if actionable
            if sig.action in (Action.LONG, Action.SHORT):
                self.engine.execute_signal(sig)

        # Save state
        self._save_state(prices, signals, eq)

        # Print cycle output
        self._print_cycle(ts, prices, signals, all_indicators, eq, closed)

    def _print_banner(self):
        mode = "PAPER" if self.config.paper_mode else "!!! LIVE !!!"
        assets = ", ".join(s.split("-")[0] for s in self.config.data.symbols)
        bal = self.config.risk.starting_balance
        max_lev = self.config.leverage.max_leverage
        risk_pct = self.config.risk.risk_per_trade_pct
        interval = self.config.data.cycle_interval_seconds
        kill_dd = self.config.risk.max_total_drawdown_pct
        print(f"""
╔══════════════════════════════════════════════════════════════╗
║           LEVERAGED CRYPTO TRADING SYSTEM                   ║
║                     Mode: {mode:<10}                         ║
╠══════════════════════════════════════════════════════════════╣
║  Assets:    {assets:<47} ║
║  Balance:   ${bal:>10,.2f}                                    ║
║  Max Lev:   {max_lev}x                                            ║
║  Risk/Trade:{risk_pct}%                                          ║
║  Interval:  {interval}s                                           ║
║  Kill Switch: {kill_dd}% drawdown                               ║
╠══════════════════════════════════════════════════════════════╣
║  Strategy:  Multi-TF Confluence (EMA/RSI/ATR/Volume/Regime) ║
║  Sides:     LONG + SHORT                                    ║
║  Risk:      ATR-based stops, drawdown guards, liq safety     ║
╚══════════════════════════════════════════════════════════════╝""")

    def _print_cycle(self, ts: str, prices: Dict[str, float],
                     signals: Dict[str, Signal],
                     indicators: Dict[str, Dict],
                     eq, closed):
        """Print structured cycle output."""
        print(f"\n{'─' * 70}")
        print(f"  [{ts}]  Cycle #{self.cycle_count}  |  Mode: {'LIVE' if self.live_mode else 'PAPER'}  |  "
              f"Equity: ${eq.equity:,.2f}  |  DD: {eq.drawdown_pct:.1f}%")
        print(f"{'─' * 70}")

        for symbol in self.config.data.symbols:
            price = prices[symbol]
            sig = signals[symbol]
            coin = symbol.split("-")[0]

            # Get primary TF indicators for display
            ind = indicators[symbol].get(self.config.data.primary_timeframe)

            # Higher TF bias
            bias_str = "—"
            if sig.side:
                bias_str = sig.side.value
            elif sig.components.get("htf_bias", 0) > 0.1:
                bias_str = "BULL"
            elif sig.components.get("htf_bias", 0) == 0:
                bias_str = "BEAR"

            regime_str = sig.regime.value if sig.regime != Regime.UNKNOWN else "—"

            # Indicator values
            rsi_str = f"{ind.rsi:.1f}" if ind and ind.rsi else "—"
            atr_str = f"${ind.atr:.2f}" if ind and ind.atr else "—"
            ema9_str = f"${ind.ema_9:,.2f}" if ind and ind.ema_9 else "—"
            mom_str = f"{ind.momentum:.2f}%" if ind and ind.momentum else "—"

            print(f"\n  {coin:<5} ${price:>10,.2f}  |  Regime: {regime_str:<14} | "
                  f"RSI: {rsi_str:>5} | ATR: {atr_str:>8} | Mom: {mom_str:>7}")

            if sig.action == Action.NO_TRADE:
                print(f"         Action: NO TRADE  |  Confidence: {sig.confidence:.2f}  |  {sig.reason}")
            else:
                liq_dist = liquidation_distance_pct(
                    sig.entry_price, sig.liquidation_price, sig.side
                ) if sig.side else 0

                print(f"         >>> {sig.action.value} <<<  |  Confidence: {sig.confidence:.2f}  |  "
                      f"Leverage: {sig.leverage}x")
                print(f"         Entry: ${sig.entry_price:,.2f}  |  Stop: ${sig.stop_loss:,.2f}  |  "
                      f"Target: ${sig.take_profit:,.2f}")
                print(f"         Liq: ${sig.liquidation_price:,.2f} ({liq_dist:.1f}% away)  |  "
                      f"R:R: {sig.risk_reward:.2f}  |  Size: ${sig.position_size_usd:,.2f}")

        # Open positions
        if self.engine.positions:
            print(f"\n  {'─' * 66}")
            print(f"  OPEN POSITIONS:")
            for pos in self.engine.positions:
                coin = pos.symbol.split("-")[0]
                price = prices.get(pos.symbol, pos.entry_price)
                pnl = pos.mark_to_market(price)
                pnl_pct = (pnl / pos.margin_used * 100) if pos.margin_used > 0 else 0
                print(f"    {pos.side.value:<5} {coin} | Entry: ${pos.entry_price:,.2f} | "
                      f"Mark: ${price:,.2f} | PnL: ${pnl:,.2f} ({pnl_pct:+.1f}%) | "
                      f"Lev: {pos.leverage}x | Stop: ${pos.stop_loss:,.2f}")

        # Closed trades this cycle
        if closed:
            print(f"\n  CLOSED THIS CYCLE:")
            for t in closed:
                tcoin = t.symbol.split("-")[0]
                print(f"    {t.side} {tcoin} | PnL: ${t.pnl:,.2f} | {t.exit_reason}")

        # Account summary
        print(f"\n  Cash: ${self.risk_manager.cash:,.2f}  |  "
              f"Win Rate: {self.risk_manager.win_rate:.0f}%  |  "
              f"Trades: {self.risk_manager.total_trades}  |  "
              f"Consec L: {self.risk_manager.consecutive_losses}  |  "
              f"PF: {self.engine.profit_factor:.2f}")

        if self.risk_manager.kill_switch_active:
            print(f"\n  *** KILL SWITCH ACTIVE — TRADING HALTED ***")

    def _save_state(self, prices, signals, eq):
        """Save current state to JSON."""
        state = {
            "timestamp": datetime.utcnow().isoformat(),
            "mode": "PAPER",
            "cycle": self.cycle_count,
            "equity": eq.equity,
            "cash": eq.cash,
            "drawdown_pct": eq.drawdown_pct,
            "peak_equity": eq.peak_equity,
            "open_positions": [
                {
                    "symbol": p.symbol,
                    "side": p.side.value,
                    "leverage": p.leverage,
                    "entry": p.entry_price,
                    "stop": p.stop_loss,
                    "tp": p.take_profit,
                    "liq": p.liquidation_price,
                    "qty": p.quantity,
                    "unrealized_pnl": p.unrealized_pnl,
                }
                for p in self.engine.positions
            ],
            "signals": {
                s: {
                    "action": sig.action.value,
                    "confidence": sig.confidence,
                    "reason": sig.reason,
                }
                for s, sig in signals.items()
            },
            "prices": prices,
            "risk": {
                "kill_switch": self.risk_manager.kill_switch_active,
                "daily_loss_pct": self.risk_manager.daily_loss_pct,
                "weekly_dd_pct": self.risk_manager.weekly_drawdown_pct,
                "consecutive_losses": self.risk_manager.consecutive_losses,
                "total_trades": self.risk_manager.total_trades,
                "win_rate": self.risk_manager.win_rate,
            },
        }
        self.logger.save_state(state)

    def _print_final_report(self):
        """Print performance summary on shutdown."""
        print(f"\n\n{'=' * 70}")
        print("  FINAL REPORT")
        print(f"{'=' * 70}")

        metrics = compute_metrics(
            self.engine.closed_trades,
            self.risk_manager.equity,
            self.config.risk.starting_balance,
            self.risk_manager.peak_equity,
        )
        print(format_metrics_table(metrics))

        print(f"\n  Starting Balance: ${self.config.risk.starting_balance:,.2f}")
        print(f"  Final Equity:     ${self.risk_manager.equity:,.2f}")
        print(f"  Peak Equity:      ${self.risk_manager.peak_equity:,.2f}")
        print(f"  Max Drawdown:     {self.drawdown_tracker.max_drawdown_pct:.2f}%")
        print(f"\n  Logs saved to: {self.config.log.output_dir}/")
        print(f"{'=' * 70}\n")

    def _shutdown(self, signum, frame):
        print("\n\n  Shutting down gracefully...")
        self.running = False


def parse_args():
    parser = argparse.ArgumentParser(description="Leveraged Crypto Paper Trading Bot")
    parser.add_argument("--symbols", nargs="+", default=["BTC-USD", "ETH-USD", "SOL-USD"],
                        help="Trading symbols (default: BTC-USD ETH-USD SOL-USD)")
    parser.add_argument("--interval", type=int, default=10,
                        help="Cycle interval in seconds (default: 10)")
    parser.add_argument("--balance", type=float, default=10000.0,
                        help="Starting paper balance (default: 10000)")
    parser.add_argument("--max-leverage", type=float, default=5.0,
                        help="Maximum allowed leverage (default: 5)")
    parser.add_argument("--risk-pct", type=float, default=0.75,
                        help="Risk per trade %% (default: 0.75)")
    parser.add_argument("--demo", action="store_true", default=True,
                        help="Use demo prices (default: True)")
    parser.add_argument("--live-data", action="store_true", default=False,
                        help="Use live Coinbase API data (paper execution, real prices)")
    parser.add_argument("--live-trade", action="store_true", default=False,
                        help="LIVE TRADING: real money on Coinbase (requires API keys + passphrase)")
    parser.add_argument("--passphrase", type=str, default="",
                        help="Safety passphrase to enable live trading")
    parser.add_argument("--max-order-usd", type=float, default=500.0,
                        help="Maximum USD per order in live mode (default: 500)")
    return parser.parse_args()


def main():
    args = parse_args()

    config = BotConfig()
    config.data.symbols = args.symbols
    config.data.cycle_interval_seconds = args.interval
    config.risk.starting_balance = args.balance
    config.leverage.max_leverage = args.max_leverage
    config.risk.risk_per_trade_pct = args.risk_pct

    # Mode selection
    if args.live_trade:
        # LIVE MODE: requires passphrase and API keys
        if args.passphrase != config.live_mode_passphrase:
            print("=" * 60)
            print("  LIVE TRADING REJECTED")
            print("=" * 60)
            print("  You must provide the correct --passphrase to enable live trading.")
            print("  This is a safety measure to prevent accidental live execution.")
            print(f"\n  Also required: COINBASE_API_KEY and COINBASE_API_SECRET")
            print("  environment variables must be set.")
            print("\n  If you're not ready, use --live-data for real prices + paper trading.")
            print("=" * 60)
            sys.exit(1)

        api_key = os.environ.get("COINBASE_API_KEY", "")
        api_secret = os.environ.get("COINBASE_API_SECRET", "")
        if not api_key or not api_secret:
            print("ERROR: COINBASE_API_KEY and COINBASE_API_SECRET must be set.")
            sys.exit(1)

        config.paper_mode = False
        config.data.demo_mode = False
        print("\n  *** WARNING: LIVE TRADING MODE ***")
        print("  Real money will be used. Max order: $" + f"{args.max_order_usd:.0f}")
        print("  Starting in 5 seconds... Ctrl+C to abort.\n")
        time.sleep(5)

    elif args.live_data:
        # Real prices, paper execution
        config.paper_mode = True
        config.data.demo_mode = False
    else:
        # Full demo
        config.paper_mode = True
        config.data.demo_mode = True

    bot = TradingBot(config)
    bot.start()


if __name__ == "__main__":
    main()
