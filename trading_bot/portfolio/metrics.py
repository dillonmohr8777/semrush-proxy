"""
Portfolio performance metrics and reporting.
"""
from typing import List
from utils.types import TradeLog


def compute_metrics(trades: List[TradeLog], current_equity: float,
                    starting_balance: float, peak_equity: float) -> dict:
    """Compute comprehensive portfolio metrics."""
    if not trades:
        return {
            "total_trades": 0,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "total_pnl": 0.0,
            "total_return_pct": 0.0,
            "avg_winner": 0.0,
            "avg_loser": 0.0,
            "largest_win": 0.0,
            "largest_loss": 0.0,
            "max_consecutive_losses": 0,
            "max_drawdown_pct": 0.0,
            "avg_trade_duration": 0,
            "total_fees": 0.0,
            "expectancy": 0.0,
        }

    winners = [t for t in trades if t.pnl > 0]
    losers = [t for t in trades if t.pnl <= 0]

    win_pnls = [t.pnl for t in winners]
    loss_pnls = [t.pnl for t in losers]

    total_pnl = sum(t.pnl for t in trades)
    total_fees = sum(t.fees for t in trades)
    gross_wins = sum(win_pnls) if win_pnls else 0
    gross_losses = abs(sum(loss_pnls)) if loss_pnls else 0

    win_rate = len(winners) / len(trades) * 100 if trades else 0
    profit_factor = gross_wins / gross_losses if gross_losses > 0 else float("inf")

    # Consecutive losses
    max_consec = 0
    current_consec = 0
    for t in trades:
        if t.pnl <= 0:
            current_consec += 1
            max_consec = max(max_consec, current_consec)
        else:
            current_consec = 0

    # Expectancy: average PnL per trade
    expectancy = total_pnl / len(trades) if trades else 0

    drawdown_pct = (peak_equity - current_equity) / peak_equity * 100 if peak_equity > 0 else 0

    return {
        "total_trades": len(trades),
        "winners": len(winners),
        "losers": len(losers),
        "win_rate": round(win_rate, 1),
        "profit_factor": round(profit_factor, 2),
        "total_pnl": round(total_pnl, 2),
        "total_return_pct": round(total_pnl / starting_balance * 100, 2),
        "avg_winner": round(sum(win_pnls) / len(win_pnls), 2) if win_pnls else 0.0,
        "avg_loser": round(sum(loss_pnls) / len(loss_pnls), 2) if loss_pnls else 0.0,
        "largest_win": round(max(win_pnls), 2) if win_pnls else 0.0,
        "largest_loss": round(min(loss_pnls), 2) if loss_pnls else 0.0,
        "max_consecutive_losses": max_consec,
        "max_drawdown_pct": round(drawdown_pct, 2),
        "avg_trade_duration": round(sum(t.candles_held for t in trades) / len(trades), 1),
        "total_fees": round(total_fees, 2),
        "expectancy": round(expectancy, 2),
    }


def format_metrics_table(metrics: dict) -> str:
    """Format metrics as a readable table."""
    lines = [
        "=" * 50,
        "         PORTFOLIO METRICS",
        "=" * 50,
        f"  Total Trades:         {metrics['total_trades']}",
        f"  Win Rate:             {metrics['win_rate']}%",
        f"  Profit Factor:        {metrics['profit_factor']}",
        f"  Expectancy:           ${metrics['expectancy']}",
        f"  Total PnL:            ${metrics['total_pnl']}",
        f"  Total Return:         {metrics['total_return_pct']}%",
        "-" * 50,
        f"  Avg Winner:           ${metrics['avg_winner']}",
        f"  Avg Loser:            ${metrics['avg_loser']}",
        f"  Largest Win:          ${metrics['largest_win']}",
        f"  Largest Loss:         ${metrics['largest_loss']}",
        "-" * 50,
        f"  Max Consec Losses:    {metrics['max_consecutive_losses']}",
        f"  Max Drawdown:         {metrics['max_drawdown_pct']}%",
        f"  Total Fees:           ${metrics['total_fees']}",
        f"  Avg Duration:         {metrics['avg_trade_duration']} candles",
        "=" * 50,
    ]
    return "\n".join(lines)
