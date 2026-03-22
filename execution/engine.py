"""
Main execution engine.
Orchestrates the full loop:
  data refresh → indicator computation → strategy evaluation
  → risk check → order execution → position monitoring → alerts → DB
"""
import logging
import time
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional

from data.feed import DataManager
from data.indicators import compute_all
from strategies.ensemble import EnsembleStrategy
from strategies.base import Signal
from core.portfolio import Portfolio
from execution.paper import PaperExecutor
from execution.live import LiveExecutor
from monitoring.alerts import AlertManager
from monitoring.dashboard import full_dashboard
from db.database import TradeDB
from config.settings import (
    TRADING_MODE, TRADING_PAIRS, POLL_INTERVAL_SEC,
    STARTING_CAPITAL, StrategyConfig, RiskConfig
)

logger = logging.getLogger(__name__)


class TradingEngine:
    """
    Core event loop that ties all components together.
    """

    def __init__(self,
                 mode: str = TRADING_MODE,
                 pairs: List[str] = None,
                 starting_capital: float = STARTING_CAPITAL,
                 strategy_cfg: StrategyConfig = None,
                 risk_cfg: RiskConfig = None,
                 show_dashboard: bool = True):

        self.mode       = mode.lower()
        self.pairs      = pairs or TRADING_PAIRS
        self.cfg_s      = strategy_cfg or StrategyConfig()
        self.cfg_r      = risk_cfg or RiskConfig()
        self._running   = False
        self.show_dash  = show_dashboard

        # ── Core components ──────────────────────────────────────────────────
        self.portfolio  = Portfolio(starting_capital, self.cfg_r)
        self.ensemble   = EnsembleStrategy(self.cfg_s)
        self.alerts     = AlertManager()
        self.db         = TradeDB()
        self._live_prices: Dict[str, float] = {}

        # ── Exchange + Executor ──────────────────────────────────────────────
        if self.mode == "live":
            from core.exchange import CoinbaseClient
            self.client   = CoinbaseClient()
            self.executor = LiveExecutor(self.client, self.portfolio)
            self.data_mgr = DataManager(self.client, self.pairs)
        else:
            # Paper mode — still fetch real data for signals, just don't trade
            try:
                from core.exchange import CoinbaseClient
                self.client   = CoinbaseClient()
                self.data_mgr = DataManager(self.client, self.pairs)
            except Exception:
                self.client   = None
                self.data_mgr = None
                logger.warning("No Coinbase credentials — data feed unavailable in paper mode")
            self.executor = PaperExecutor(self.portfolio)

        logger.info(f"Engine initialized | mode={self.mode} "
                    f"pairs={self.pairs} capital=${starting_capital}")

    # ─── Lifecycle ───────────────────────────────────────────────────────────

    def start(self):
        """Bootstrap data and start the main loop."""
        self._running = True
        self.alerts.bot_started(self.mode, self.pairs,
                                 self.portfolio.starting_capital)

        if self.data_mgr:
            logger.info("Bootstrapping historical data…")
            self.data_mgr.bootstrap()

        logger.info("Starting main loop…")
        try:
            self._loop()
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt — shutting down")
        finally:
            self.stop()

    def stop(self):
        self._running = False
        self._flush_daily_stats()
        self.alerts.bot_stopped()
        logger.info("Engine stopped.")

    # ─── Main loop ───────────────────────────────────────────────────────────

    def _loop(self):
        last_dashboard = 0.0
        last_daily     = 0.0
        DASH_INTERVAL  = 10   # refresh dashboard every 10s
        DAILY_INTERVAL = 3600 # flush daily stats every hour

        while self._running:
            loop_start = time.time()

            for pair in self.pairs:
                try:
                    self._process_pair(pair)
                except Exception as e:
                    logger.error(f"Error processing {pair}: {e}")
                    self.alerts.error_alert(f"{pair}: {e}")

            now = time.time()

            # Dashboard refresh
            if self.show_dash and now - last_dashboard >= DASH_INTERVAL:
                self._render_dashboard()
                last_dashboard = now

            # Daily summary flush
            if now - last_daily >= DAILY_INTERVAL:
                self._flush_daily_stats()
                last_daily = now

            # Wait remainder of poll interval
            elapsed = time.time() - loop_start
            sleep_t = max(0, POLL_INTERVAL_SEC - elapsed)
            time.sleep(sleep_t)

    def _process_pair(self, pair: str):
        # 1. Refresh market data
        if self.data_mgr:
            self.data_mgr.refresh(pair)
            df = self.data_mgr.get_df(pair)
        else:
            return

        if df.empty or len(df) < 50:
            logger.debug(f"Insufficient data for {pair}")
            return

        # 2. Compute indicators
        df = compute_all(df.copy(),
                         rsi_period       = self.cfg_s.rsi_period,
                         macd_fast        = self.cfg_s.macd_fast,
                         macd_slow        = self.cfg_s.macd_slow,
                         macd_signal      = self.cfg_s.macd_signal,
                         bb_period        = self.cfg_s.bb_period,
                         bb_stddev        = self.cfg_s.bb_stddev,
                         ema_short        = self.cfg_s.ema_short,
                         ema_long         = self.cfg_s.ema_long,
                         atr_period       = self.cfg_s.atr_period,
                         volume_ma_period = self.cfg_s.volume_ma_period)

        price = float(df["close"].iloc[-1])
        atr   = float(df["atr"].iloc[-1]) if "atr" in df.columns else price * 0.02
        self._live_prices[pair] = price

        # 3. Check exit conditions for open positions
        if pair in self.portfolio.positions:
            fill = self.executor.check_and_exit(pair, price)
            if fill:
                self.db.record_fill(fill)
                self.alerts.trade_closed(fill)

        # 4. Evaluate ensemble signal
        result = self.ensemble.evaluate(df, pair)
        if result:
            result.meta["atr"] = atr

            # 5. Execute trade
            fill = self.executor.execute(result, self._live_prices)
            if fill:
                self.db.record_fill(fill)
                if fill.get("side") == "BUY":
                    self.alerts.trade_opened(fill)
                else:
                    self.alerts.trade_closed(fill)

    # ─── Reporting ───────────────────────────────────────────────────────────

    def _render_dashboard(self):
        try:
            snapshot  = self.portfolio.snapshot(self._live_prices)
            positions = self.portfolio.positions_summary(self._live_prices)
            trades    = self.db.get_recent_trades(20)

            # Gather latest signals for display
            signals = []
            for pair in self.pairs:
                if self.data_mgr:
                    df = self.data_mgr.get_df(pair)
                    if not df.empty and len(df) >= 50:
                        df = compute_all(df.copy())
                        for r in self.ensemble.get_all_signals(df, pair):
                            signals.append({
                                "strategy":   r.strategy,
                                "product_id": r.product_id,
                                "signal":     r.signal.value,
                                "confidence": r.confidence,
                                "reason":     r.reason,
                            })

            full_dashboard(self.mode, self.pairs, snapshot, positions, trades, signals)
        except Exception as e:
            logger.debug(f"Dashboard render error: {e}")

    def _flush_daily_stats(self):
        try:
            stats = self.portfolio.risk.daily_summary()
            self.db.upsert_daily_stats(stats)
            self.alerts.daily_summary(stats)
        except Exception as e:
            logger.error(f"Daily stats flush error: {e}")

    def get_status(self) -> Dict:
        return {
            "running":    self._running,
            "mode":       self.mode,
            "pairs":      self.pairs,
            "snapshot":   self.portfolio.snapshot(self._live_prices),
            "positions":  self.portfolio.positions_summary(self._live_prices),
        }
