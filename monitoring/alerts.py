"""
Alert system: Telegram + console fallback.
All trade events, daily summaries, and errors route through here.
"""
import logging
import asyncio
from typing import Optional

from config.settings import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

logger = logging.getLogger(__name__)


class AlertManager:
    """
    Sends alerts via Telegram if configured, otherwise logs to console.
    """

    def __init__(self, token: str = TELEGRAM_BOT_TOKEN,
                 chat_id: str = TELEGRAM_CHAT_ID):
        self.token   = token
        self.chat_id = chat_id
        self._bot    = None

        if token and chat_id:
            try:
                from telegram import Bot
                self._bot = Bot(token=token)
                logger.info("Telegram alerts enabled.")
            except ImportError:
                logger.warning("python-telegram-bot not installed. "
                               "Console alerts only.")
        else:
            logger.info("Telegram not configured. Console alerts only.")

    async def _send_async(self, text: str):
        if self._bot:
            try:
                await self._bot.send_message(
                    chat_id    = self.chat_id,
                    text       = text,
                    parse_mode = "Markdown"
                )
            except Exception as e:
                logger.error(f"Telegram send failed: {e}")

    def send(self, text: str):
        logger.info(f"ALERT: {text}")
        if self._bot:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.ensure_future(self._send_async(text))
                else:
                    loop.run_until_complete(self._send_async(text))
            except Exception as e:
                logger.error(f"Alert dispatch error: {e}")

    # ─── Formatted event alerts ──────────────────────────────────────────────

    def trade_opened(self, fill: dict):
        mode_tag = "📄 PAPER" if fill.get("mode") == "paper" else "🔴 LIVE"
        msg = (
            f"{mode_tag} *TRADE OPENED*\n"
            f"Pair: `{fill['product_id']}`\n"
            f"Side: `{fill['side']}`\n"
            f"Price: `${fill['price']:,.2f}`\n"
            f"Size: `${fill['size_usd']:.2f}`\n"
            f"Qty: `{fill.get('quantity', 0):.6f}`\n"
            f"Stop: `${fill.get('stop_loss') or 'none'}`\n"
            f"Target: `${fill.get('take_profit') or 'none'}`\n"
            f"Strategy: `{fill.get('strategy', '?')}`\n"
            f"Reason: _{fill.get('reason', '')}_ "
        )
        self.send(msg)

    def trade_closed(self, fill: dict):
        pnl  = fill.get("pnl", 0)
        icon = "✅" if pnl >= 0 else "❌"
        mode_tag = "📄 PAPER" if fill.get("mode") == "paper" else "🔴 LIVE"
        msg = (
            f"{mode_tag} {icon} *TRADE CLOSED*\n"
            f"Pair: `{fill['product_id']}`\n"
            f"Price: `${fill['price']:,.2f}`\n"
            f"P&L: `{pnl:+.2f} USD`\n"
            f"Reason: _{fill.get('reason', '')}_ "
        )
        self.send(msg)

    def daily_summary(self, stats: dict):
        pnl   = stats.get("realized_pnl", 0)
        icon  = "📈" if pnl >= 0 else "📉"
        msg = (
            f"{icon} *Daily Summary* — {stats.get('date', '?')}\n"
            f"P&L: `{pnl:+.2f} USD`\n"
            f"Trades: `{stats.get('trades', 0)}`  "
            f"W/L: `{stats.get('wins', 0)}/{stats.get('losses', 0)}`  "
            f"WR: `{stats.get('win_rate', 0)*100:.1f}%`\n"
            f"Capital: `${stats.get('capital', 0):,.2f}`"
        )
        self.send(msg)

    def risk_alert(self, message: str):
        self.send(f"⚠️ *RISK ALERT*\n{message}")

    def error_alert(self, message: str):
        self.send(f"🚨 *ERROR*\n`{message}`")

    def bot_started(self, mode: str, pairs: list, capital: float):
        self.send(
            f"🤖 *Bot Started*\n"
            f"Mode: `{mode.upper()}`\n"
            f"Pairs: `{', '.join(pairs)}`\n"
            f"Capital: `${capital:,.2f}`"
        )

    def bot_stopped(self):
        self.send("🛑 *Bot Stopped*")
