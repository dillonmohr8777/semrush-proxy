/**
 * Performance Engine
 * Computes win rate, expectancy, profit factor, drawdown, and per-setup stats
 * from the trade history stored in state.
 */

/**
 * Core stats from a closed trade array
 */
export function computePerformance(tradeHistory) {
  const closed = tradeHistory.filter(t =>
    ['WIN', 'LOSS', 'BREAKEVEN'].includes(t.status) && t.rMultiple !== null
  );

  if (closed.length === 0) {
    return {
      tradeCount:   0,
      winRate:      null,
      avgR:         null,
      expectancy:   null,
      profitFactor: null,
      maxDrawdown:  null,
      currentStreak: 0,
      streakType:   null,
      bySetup:      {},
      sufficient:   false,  // need ≥ 10 trades for meaningful stats
    };
  }

  const wins      = closed.filter(t => t.status === 'WIN');
  const losses    = closed.filter(t => t.status === 'LOSS');
  const breakeven = closed.filter(t => t.status === 'BREAKEVEN');

  const winRate = wins.length / closed.length;

  const avgWinR  = wins.length   ? avg(wins.map(t => t.rMultiple))   : 0;
  const avgLossR = losses.length ? avg(losses.map(t => Math.abs(t.rMultiple))) : 0;

  // Expectancy: (winRate * avgWin) - (lossRate * avgLoss) in R
  const expectancy = (winRate * avgWinR) - ((1 - winRate) * avgLossR);

  // Profit factor: gross profit / gross loss
  const grossProfit = wins.reduce((s, t) => s + t.rMultiple, 0);
  const grossLoss   = losses.reduce((s, t) => s + Math.abs(t.rMultiple), 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Max drawdown (in R) — running peak vs trough
  let peak = 0, trough = 0, maxDD = 0, running = 0;
  [...closed].reverse().forEach(t => {
    running += t.rMultiple;
    if (running > peak) { peak = running; trough = running; }
    if (running < trough) {
      trough = running;
      maxDD  = Math.max(maxDD, peak - trough);
    }
  });

  // Current streak
  let streak = 0, streakType = null;
  for (const t of closed) {
    if (streakType === null) {
      streakType = t.status === 'WIN' ? 'WIN' : 'LOSS';
      streak = 1;
    } else if (t.status === streakType || (streakType === 'WIN' && t.status === 'BREAKEVEN')) {
      streak++;
    } else {
      break;
    }
  }

  // Per-setup breakdown
  const setups = {};
  closed.forEach(t => {
    const s = t.setup || 'UNKNOWN';
    if (!setups[s]) setups[s] = { count: 0, wins: 0, totalR: 0 };
    setups[s].count++;
    if (t.status === 'WIN') setups[s].wins++;
    setups[s].totalR += t.rMultiple;
  });
  const bySetup = {};
  Object.entries(setups).forEach(([k, v]) => {
    bySetup[k] = {
      count:    v.count,
      winRate:  (v.wins / v.count * 100).toFixed(1) + '%',
      avgR:     (v.totalR / v.count).toFixed(2),
    };
  });

  return {
    tradeCount:    closed.length,
    winCount:      wins.length,
    lossCount:     losses.length,
    breakevenCount: breakeven.length,
    winRate:       parseFloat((winRate * 100).toFixed(1)),
    avgR:          parseFloat(avg(closed.map(t => t.rMultiple)).toFixed(2)),
    avgWinR:       parseFloat(avgWinR.toFixed(2)),
    avgLossR:      parseFloat(avgLossR.toFixed(2)),
    expectancy:    parseFloat(expectancy.toFixed(3)),
    profitFactor:  parseFloat(profitFactor.toFixed(2)),
    maxDrawdown:   parseFloat(maxDD.toFixed(2)),
    grossProfitR:  parseFloat(grossProfit.toFixed(2)),
    grossLossR:    parseFloat(grossLoss.toFixed(2)),
    currentStreak: streak,
    streakType,
    bySetup,
    sufficient:    closed.length >= 10,
  };
}

/**
 * Adaptive selectivity multiplier:
 * - Returns 1.0 (normal) when performance is healthy
 * - Returns > 1.0 (more selective) when performance is degrading
 * - Returns < 1.0 (more aggressive) when EV is rising
 */
export function adaptiveSelectivity(perf) {
  if (!perf.sufficient) return 1.0;

  let factor = 1.0;

  // Tighten if win rate falling
  if (perf.winRate < 50) factor += 0.3;
  if (perf.winRate < 45) factor += 0.2;

  // Tighten if drawdown is large
  if (perf.maxDrawdown > 5)  factor += 0.2;
  if (perf.maxDrawdown > 10) factor += 0.3;

  // Loosen if expectancy is strong
  if (perf.expectancy > 0.5) factor -= 0.15;
  if (perf.expectancy > 1.0) factor -= 0.1;

  // Tighten on losing streak
  if (perf.streakType === 'LOSS' && perf.currentStreak >= 3) factor += 0.25;

  return Math.max(0.7, Math.min(1.8, factor));
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
