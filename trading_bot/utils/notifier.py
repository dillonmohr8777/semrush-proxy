"""
Push notifications via ntfy.sh — free, no signup, works on iOS/Android.

Usage on your phone:
  1. Install "ntfy" app from App Store or Google Play
  2. Subscribe to the topic you set in NTFY_TOPIC
  3. Pick a unique, hard-to-guess topic name (acts as a password)

Any POST to https://ntfy.sh/<topic> delivers a push notification.
"""
import json
import urllib.request
import urllib.error
from typing import Optional


class Notifier:
    def __init__(self, topic: Optional[str], profit_threshold_usd: float = 20.0,
                 profit_threshold_pct: float = 2.0, enabled: bool = True,
                 server: str = "https://ntfy.sh", logger=None):
        self.topic = (topic or "").strip()
        self.profit_threshold_usd = profit_threshold_usd
        self.profit_threshold_pct = profit_threshold_pct
        self.enabled = enabled and bool(self.topic)
        self.server = server.rstrip("/")
        self.logger = logger

    def _post(self, title: str, message: str, priority: str = "default",
              tags: str = "") -> bool:
        """Low-level POST to ntfy. Returns True on success."""
        if not self.enabled:
            return False

        url = f"{self.server}/{self.topic}"
        try:
            req = urllib.request.Request(
                url,
                data=message.encode("utf-8"),
                method="POST",
                headers={
                    "Title": title,
                    "Priority": priority,
                    "Tags": tags,
                    "Content-Type": "text/plain; charset=utf-8",
                },
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                return 200 <= resp.status < 300
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            if self.logger:
                self.logger.warn(f"Notifier failed: {e}")
            return False
        except Exception as e:
            if self.logger:
                self.logger.warn(f"Notifier error: {e}")
            return False

    def notify_profit(self, symbol: str, side: str, pnl_usd: float,
                      pnl_pct: float, entry: float, exit_price: float,
                      leverage: float, reason: str = "") -> bool:
        """
        Fire a push notification when a trade closes with profit above threshold.
        Checks BOTH usd and pct thresholds — must exceed at least one.
        """
        if not self.enabled:
            return False

        if pnl_usd < self.profit_threshold_usd and pnl_pct < self.profit_threshold_pct:
            return False

        title = f"+${pnl_usd:.2f} {symbol} {side}"
        lines = [
            f"PnL: +${pnl_usd:.2f} ({pnl_pct:.1f}%)",
            f"Entry: ${entry:,.2f} -> Exit: ${exit_price:,.2f}",
            f"Leverage: {leverage:.0f}x",
        ]
        if reason:
            lines.append(f"Reason: {reason}")
        message = "\n".join(lines)

        # Priority: high for big wins, max for monster wins
        if pnl_usd >= self.profit_threshold_usd * 5:
            priority = "max"
            tags = "rocket,money_with_wings"
        elif pnl_usd >= self.profit_threshold_usd * 2:
            priority = "high"
            tags = "moneybag,chart_with_upwards_trend"
        else:
            priority = "default"
            tags = "green_circle,chart_with_upwards_trend"

        ok = self._post(title, message, priority=priority, tags=tags)
        if ok and self.logger:
            self.logger.event(f"PUSH SENT: {title}")
        return ok

    def notify_loss(self, symbol: str, side: str, pnl_usd: float,
                    pnl_pct: float) -> bool:
        """Optional big-loss alert (fires on losses worse than 2x profit threshold)."""
        if not self.enabled:
            return False

        loss_threshold = self.profit_threshold_usd * 2
        if abs(pnl_usd) < loss_threshold:
            return False

        title = f"-${abs(pnl_usd):.2f} {symbol} {side}"
        message = f"Loss: -${abs(pnl_usd):.2f} ({pnl_pct:.1f}%)"
        return self._post(title, message, priority="high", tags="red_circle,warning")

    def notify_event(self, title: str, message: str) -> bool:
        """Generic event notification (kill switch, etc.)."""
        return self._post(title, message, priority="high", tags="warning")
