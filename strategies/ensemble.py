"""
Ensemble engine: aggregates signals from all strategies.
A trade fires only when ≥ N strategies agree (configurable).
Confidence is the weighted average of agreeing strategies.
"""
import logging
from typing import List, Optional
import pandas as pd

from strategies.base import BaseStrategy, Signal, StrategyResult
from strategies.momentum import MomentumStrategy
from strategies.mean_reversion import MeanReversionStrategy
from strategies.trend_following import TrendFollowingStrategy
from config.settings import StrategyConfig, ENSEMBLE_MIN_VOTES

logger = logging.getLogger(__name__)


class EnsembleStrategy:
    """
    Runs all sub-strategies and aggregates their votes.
    Returns a final StrategyResult or None if consensus not reached.
    """

    def __init__(self, cfg: StrategyConfig = None, min_votes: int = ENSEMBLE_MIN_VOTES):
        self.cfg       = cfg or StrategyConfig()
        self.min_votes = min_votes
        self.strategies: List[BaseStrategy] = [
            MomentumStrategy(cfg),
            MeanReversionStrategy(cfg),
            TrendFollowingStrategy(cfg),
        ]

    def evaluate(self, df: pd.DataFrame, product_id: str) -> Optional[StrategyResult]:
        results = []
        for strat in self.strategies:
            try:
                r = strat.evaluate(df, product_id)
                results.append(r)
                logger.debug(f"[{strat.name}] {product_id}: {r.signal.value} "
                             f"conf={r.confidence:.3f} | {r.reason}")
            except Exception as e:
                logger.error(f"Strategy {strat.name} error on {product_id}: {e}")

        return self._aggregate(results, product_id)

    def _aggregate(self, results: List[StrategyResult],
                   product_id: str) -> Optional[StrategyResult]:
        buys  = [r for r in results if r.signal == Signal.BUY]
        sells = [r for r in results if r.signal == Signal.SELL]

        for direction, votes in [("BUY", buys), ("SELL", sells)]:
            if len(votes) >= self.min_votes:
                avg_conf   = sum(v.confidence for v in votes) / len(votes)
                price      = votes[0].price
                strategies = [v.strategy for v in votes]

                # Use tightest stop loss for safety
                stop_losses    = [v.stop_loss for v in votes if v.stop_loss]
                take_profits   = [v.take_profit for v in votes if v.take_profit]

                if direction == "BUY":
                    stop  = max(stop_losses) if stop_losses else None    # highest floor
                    tp    = min(take_profits) if take_profits else None  # nearest target
                else:
                    stop  = min(stop_losses) if stop_losses else None
                    tp    = max(take_profits) if take_profits else None

                reason = (f"Ensemble {direction}: {len(votes)}/{len(results)} "
                          f"strategies agree ({', '.join(strategies)}) | "
                          f"avg_conf={avg_conf:.3f}")

                logger.info(f"ENSEMBLE {direction} signal for {product_id}: {reason}")

                return StrategyResult(
                    signal      = Signal(direction),
                    confidence  = round(avg_conf, 3),
                    strategy    = "ensemble",
                    product_id  = product_id,
                    price       = price,
                    reason      = reason,
                    stop_loss   = stop,
                    take_profit = tp,
                    meta        = {"votes": len(votes), "strategies": strategies}
                )

        return None  # no consensus

    def get_all_signals(self, df: pd.DataFrame,
                         product_id: str) -> List[StrategyResult]:
        """Return individual signals from all strategies (for dashboard)."""
        results = []
        for strat in self.strategies:
            try:
                results.append(strat.evaluate(df, product_id))
            except Exception as e:
                logger.error(f"{strat.name} error: {e}")
        return results
