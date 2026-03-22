/**
 * Signal Validator — Statistical gate before any trade is approved
 *
 * A signal must pass ALL filters to be approved:
 *   1. R:R ≥ minimum threshold (default 2.5)
 *   2. Setup win rate ≥ 55% (if enough history exists)
 *   3. EV (expectancy) > 0
 *   4. Not in a regime that disqualifies the setup
 *   5. Adaptive selectivity check (tightens during drawdowns)
 */

import { adaptiveSelectivity } from './performance-engine.js';

const DEFAULTS = {
  minRR:            2.5,
  minWinRate:       55,    // %
  minEV:            0,
  minTrades:        10,    // trades before enforcing win rate filter
};

/**
 * @param {object} signal      - from market-analyzer
 * @param {object} perf        - from performance-engine
 * @param {string} regime      - current market regime
 * @param {object} opts        - override defaults
 * @returns {{ approved: boolean, reason: string, confidence: number }}
 */
export function validateSignal(signal, perf, regime, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };

  if (!signal) {
    return { approved: false, reason: 'NO_SIGNAL', confidence: 0 };
  }

  const rr = parseFloat(signal.rr);
  const rejections = [];
  let confidenceScore = 0;

  // --- Filter 1: R:R ---
  const selectivity = adaptiveSelectivity(perf);
  const adjustedMinRR = cfg.minRR * selectivity;

  if (rr < adjustedMinRR) {
    rejections.push(`R:R ${rr} < required ${adjustedMinRR.toFixed(1)}`);
  } else {
    confidenceScore += 30;
  }

  // --- Filter 2: Win rate (only enforced with enough history) ---
  if (perf.sufficient) {
    // Per-setup win rate if available, else overall
    const setupWR = perf.bySetup[signal.setup]
      ? parseFloat(perf.bySetup[signal.setup].winRate)
      : perf.winRate;

    const adjustedMinWR = cfg.minWinRate * (selectivity > 1.2 ? 1.1 : 1);

    if (setupWR < adjustedMinWR) {
      rejections.push(`Win rate ${setupWR}% < required ${adjustedMinWR.toFixed(0)}%`);
    } else {
      confidenceScore += 30;
    }

    // --- Filter 3: EV ---
    if (perf.expectancy <= cfg.minEV) {
      rejections.push(`EV ${perf.expectancy} ≤ 0`);
    } else {
      confidenceScore += 20;
    }
  } else {
    // Not enough history — apply base confidence
    confidenceScore += 25;
  }

  // --- Filter 4: Regime gate ---
  if (regime === 'LOW_VOLATILITY_CHOP') {
    rejections.push('Regime is CHOP — no directional trades');
  } else {
    confidenceScore += 10;
  }

  // --- Filter 5: Consecutive loss streak guard ---
  if (perf.streakType === 'LOSS' && perf.currentStreak >= 4) {
    rejections.push(`Active loss streak: ${perf.currentStreak} — system paused`);
  } else {
    confidenceScore += 10;
  }

  const approved  = rejections.length === 0;
  const confidence = Math.min(100, confidenceScore) / 100;

  return {
    approved,
    reason:     approved ? 'ALL_FILTERS_PASSED' : `REJECTED — ${rejections.join(' | ')}`,
    rejections,
    confidence,
    adjustedMinRR: parseFloat(adjustedMinRR.toFixed(2)),
    selectivityFactor: parseFloat(selectivity.toFixed(2)),
  };
}

/**
 * Urgency classification — how time-sensitive is the entry
 */
export function classifyUrgency(signal, currentPrice) {
  if (!signal) return 'NONE';
  const dist = Math.abs(currentPrice - signal.entry) / signal.entry * 100;
  if (dist < 0.1)  return 'HIGH';
  if (dist < 0.35) return 'MEDIUM';
  return 'LOW';
}
