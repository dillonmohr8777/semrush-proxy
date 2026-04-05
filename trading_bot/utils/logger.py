"""
Logging system: CSV trade logs, equity curve, JSON state, text events.
"""
import csv
import json
import os
from datetime import datetime
from typing import Optional
from dataclasses import asdict

from utils.types import TradeLog, EquitySnapshot


class Logger:
    def __init__(self, output_dir: str, trade_csv: str, equity_csv: str,
                 state_json: str, event_log: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

        self.trade_path = os.path.join(output_dir, trade_csv)
        self.equity_path = os.path.join(output_dir, equity_csv)
        self.state_path = os.path.join(output_dir, state_json)
        self.event_path = os.path.join(output_dir, event_log)

        self._init_trade_csv()
        self._init_equity_csv()

    def _init_trade_csv(self):
        if not os.path.exists(self.trade_path):
            with open(self.trade_path, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "id", "symbol", "side", "leverage", "bias", "confidence",
                    "entry_price", "exit_price", "stop_loss", "take_profit",
                    "liquidation_price", "quantity", "notional", "fees",
                    "pnl", "pnl_pct", "opened_at", "closed_at", "candles_held",
                    "entry_reason", "exit_reason", "regime", "setup_type"
                ])

    def _init_equity_csv(self):
        if not os.path.exists(self.equity_path):
            with open(self.equity_path, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "timestamp", "equity", "cash", "unrealized_pnl",
                    "open_positions", "drawdown_pct", "daily_pnl", "peak_equity"
                ])

    def log_trade(self, trade: TradeLog):
        with open(self.trade_path, "a", newline="") as f:
            writer = csv.writer(f)
            d = asdict(trade)
            writer.writerow(d.values())
        self.event(f"TRADE CLOSED: {trade.side} {trade.symbol} "
                   f"PnL=${trade.pnl:.2f} ({trade.exit_reason})")

    def log_equity(self, snapshot: EquitySnapshot):
        with open(self.equity_path, "a", newline="") as f:
            writer = csv.writer(f)
            d = asdict(snapshot)
            writer.writerow(d.values())

    def save_state(self, state: dict):
        with open(self.state_path, "w") as f:
            json.dump(state, f, indent=2, default=str)

    def event(self, message: str, level: str = "INFO"):
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] [{level}] {message}\n"
        with open(self.event_path, "a") as f:
            f.write(line)

    def warn(self, message: str):
        self.event(message, "WARN")

    def error(self, message: str):
        self.event(message, "ERROR")
