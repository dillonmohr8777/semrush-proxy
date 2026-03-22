"""
Rich CLI dashboard — live updating terminal UI.
Shows portfolio snapshot, open positions, recent trades, and strategy signals.
"""
from datetime import datetime, timezone
from typing import Dict, List

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.layout import Layout
from rich.text import Text
from rich import box


console = Console()


def _pnl_color(v: float) -> str:
    return "green" if v >= 0 else "red"


def render_portfolio(snapshot: Dict):
    cap     = snapshot.get("capital_free", 0)
    deploy  = snapshot.get("capital_deployed", 0)
    total   = snapshot.get("portfolio_value", 0)
    ret_pct = snapshot.get("total_return_pct", 0)
    upnl    = snapshot.get("unrealized_pnl", 0)
    rpnl    = snapshot.get("total_pnl", 0)
    daily   = snapshot.get("daily", {})

    color = _pnl_color(ret_pct)
    text  = Text()
    text.append(f"  Portfolio Value : ", style="bold")
    text.append(f"${total:>10,.2f}\n", style=f"bold {color}")
    text.append(f"  Free Capital    : ${cap:>10,.2f}\n")
    text.append(f"  Deployed        : ${deploy:>10,.2f}\n")
    text.append(f"  Total Return    : ")
    text.append(f"{ret_pct:+.2f}%\n", style=color)
    text.append(f"  Unrealized P&L  : ")
    text.append(f"{upnl:+.2f}\n", style=_pnl_color(upnl))
    text.append(f"  Realized P&L    : ")
    text.append(f"{rpnl:+.2f}\n", style=_pnl_color(rpnl))
    text.append(f"\n  ── Today ──\n")
    text.append(f"  Day P&L  : ")
    text.append(f"{daily.get('realized_pnl', 0):+.2f}\n",
                style=_pnl_color(daily.get("realized_pnl", 0)))
    text.append(f"  Trades   : {daily.get('trades', 0)}  "
                f"W/L: {daily.get('wins', 0)}/{daily.get('losses', 0)}  "
                f"WR: {daily.get('win_rate', 0)*100:.1f}%\n")

    console.print(Panel(text, title="[bold cyan]Portfolio", border_style="cyan"))


def render_positions(positions: List[Dict]):
    if not positions:
        console.print(Panel("[dim]No open positions[/dim]",
                            title="[bold yellow]Open Positions",
                            border_style="yellow"))
        return

    tbl = Table(box=box.SIMPLE_HEAVY, border_style="yellow", show_header=True)
    for col in ["Pair", "Side", "Entry", "Current", "Qty", "Size $",
                "P&L", "Stop", "Target", "Trailing", "Opened"]:
        tbl.add_column(col, justify="right" if col not in ("Pair", "Side") else "left")

    for p in positions:
        pnl   = p.get("pnl", 0)
        color = _pnl_color(pnl)
        opened = p.get("opened_at", "")[:19].replace("T", " ")
        tbl.add_row(
            p["product"],
            f"[{'green' if p['side']=='BUY' else 'red'}]{p['side']}[/]",
            f"${p['entry']:,.2f}",
            f"${p['current']:,.2f}",
            f"{p['qty']:.5f}",
            f"${p['size_usd']:,.2f}",
            f"[{color}]{pnl:+.2f}[/{color}]",
            f"${p['stop_loss']:,.2f}" if p.get("stop_loss") else "—",
            f"${p['take_profit']:,.2f}" if p.get("take_profit") else "—",
            f"${p['trailing']:,.2f}" if p.get("trailing") else "—",
            opened,
        )
    console.print(Panel(tbl, title="[bold yellow]Open Positions",
                        border_style="yellow"))


def render_recent_trades(trades: List[Dict]):
    if not trades:
        console.print(Panel("[dim]No trades yet[/dim]",
                            title="[bold white]Recent Trades",
                            border_style="white"))
        return

    tbl = Table(box=box.SIMPLE, show_header=True)
    for col in ["Time", "Pair", "Side", "Price", "Size $", "P&L", "Strategy", "Mode"]:
        tbl.add_column(col)

    for t in trades[:20]:
        pnl   = t.get("pnl") or 0
        color = _pnl_color(pnl)
        ts    = str(t.get("timestamp", ""))[:19].replace("T", " ")
        tbl.add_row(
            ts,
            t.get("product_id", ""),
            f"[{'green' if t.get('side')=='BUY' else 'red'}]{t.get('side','?')}[/]",
            f"${t.get('price', 0):,.2f}",
            f"${t.get('size_usd', 0):,.2f}",
            f"[{color}]{pnl:+.2f}[/{color}]" if t.get("side") == "SELL" else "—",
            t.get("strategy", ""),
            f"[dim]{t.get('mode', '')}[/dim]",
        )
    console.print(Panel(tbl, title="[bold white]Recent Trades",
                        border_style="white"))


def render_signals(signals: List[Dict]):
    """signals: list of {strategy, product_id, signal, confidence, reason}"""
    if not signals:
        return
    tbl = Table(box=box.SIMPLE, show_header=True)
    for col in ["Strategy", "Pair", "Signal", "Confidence", "Reason"]:
        tbl.add_column(col)

    for s in signals:
        sig = s.get("signal", "HOLD")
        color = "green" if sig == "BUY" else ("red" if sig == "SELL" else "dim")
        tbl.add_row(
            s.get("strategy", ""),
            s.get("product_id", ""),
            f"[{color}]{sig}[/{color}]",
            f"{s.get('confidence', 0):.3f}",
            s.get("reason", "")[:60],
        )
    console.print(Panel(tbl, title="[bold magenta]Strategy Signals",
                        border_style="magenta"))


def render_header(mode: str, pairs: List[str]):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    mode_style = "bold green" if mode == "paper" else "bold red blink"
    console.print(
        Panel(
            f"[{mode_style}]MODE: {mode.upper()}[/{mode_style}]  "
            f"  Pairs: [cyan]{', '.join(pairs)}[/cyan]  "
            f"  [dim]{ts}[/dim]",
            border_style="blue"
        )
    )


def full_dashboard(mode: str, pairs: List[str], snapshot: Dict,
                   positions: List[Dict], trades: List[Dict],
                   signals: List[Dict] = None):
    console.clear()
    render_header(mode, pairs)
    render_portfolio(snapshot)
    render_positions(positions)
    render_recent_trades(trades)
    if signals:
        render_signals(signals)
