/**
 * State Manager — persistent memory between API calls
 *
 * Stores to /tmp/btc-engine-state.json (survives within a process/server lifetime).
 * For production, swap the read/write layer for Redis, Upstash, or a database.
 *
 * State shape:
 * {
 *   bias:          'BULLISH' | 'BEARISH' | 'NEUTRAL'
 *   biasStrength:  'WEAK' | 'MODERATE' | 'STRONG'
 *   regime:        string
 *   activeTrade:   TradeRecord | null
 *   tradeHistory:  TradeRecord[]   (capped at 50)
 *   lastUpdated:   ISO timestamp
 *   loopCount:     number
 * }
 *
 * TradeRecord shape:
 * {
 *   id:         string (timestamp)
 *   type:       'LONG' | 'SHORT'
 *   entry:      number
 *   stop:       number
 *   tp1:        number
 *   tp2:        number
 *   tp3:        number
 *   rr:         string
 *   setup:      string      (e.g. 'EMA_PULLBACK', 'OB_REVERSAL')
 *   entryTime:  ISO string
 *   exitTime:   ISO string | null
 *   exitPrice:  number | null
 *   status:     'ACTIVE' | 'WIN' | 'LOSS' | 'BREAKEVEN'
 *   rMultiple:  number | null   (actual R achieved on close)
 *   notes:      string[]
 *   tp1Hit:     boolean
 *   tp2Hit:     boolean
 *   stopMoved:  boolean        (was stop moved to BE or beyond)
 * }
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

const STATE_PATH = '/tmp/btc-engine-state.json';
const MAX_HISTORY = 50;

const DEFAULT_STATE = {
  bias:         'NEUTRAL',
  biasStrength: 'WEAK',
  regime:       'UNKNOWN',
  activeTrade:  null,
  tradeHistory: [],
  lastUpdated:  null,
  loopCount:    0,
};

export function loadState() {
  try {
    if (existsSync(STATE_PATH)) {
      const raw = readFileSync(STATE_PATH, 'utf8');
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    }
  } catch (_) { /* corrupt file — reset */ }
  return { ...DEFAULT_STATE };
}

export function saveState(state) {
  const s = { ...state, lastUpdated: new Date().toISOString(), loopCount: (state.loopCount || 0) + 1 };
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
  return s;
}

/**
 * Open a new trade — replaces activeTrade
 */
export function openTrade(state, signal, setupLabel = 'SIGNAL') {
  const trade = {
    id:         Date.now().toString(),
    type:       signal.type,
    entry:      signal.entry,
    stop:       signal.stop,
    tp1:        signal.tp1,
    tp2:        signal.tp2,
    tp3:        signal.tp3,
    rr:         signal.rr,
    setup:      setupLabel,
    entryTime:  new Date().toISOString(),
    exitTime:   null,
    exitPrice:  null,
    status:     'ACTIVE',
    rMultiple:  null,
    notes:      [],
    tp1Hit:     false,
    tp2Hit:     false,
    stopMoved:  false,
  };
  return { ...state, activeTrade: trade };
}

/**
 * Update active trade with latest price — returns { state, events[] }
 */
export function updateActiveTrade(state, currentPrice) {
  const trade = state.activeTrade;
  if (!trade || trade.status !== 'ACTIVE') return { state, events: [] };

  const events = [];
  const risk = Math.abs(trade.entry - trade.stop);
  const iLong = trade.type === 'LONG';

  // Current unrealized R
  const pnl = iLong ? currentPrice - trade.entry : trade.entry - currentPrice;
  const unrealizedR = risk > 0 ? pnl / risk : 0;

  // Distance checks
  const distToStop = Math.abs(currentPrice - trade.stop);
  const distToTp1  = Math.abs(currentPrice - trade.tp1);

  const updated = { ...trade };

  // TP1 hit
  if (!trade.tp1Hit) {
    if ((iLong && currentPrice >= trade.tp1) || (!iLong && currentPrice <= trade.tp1)) {
      updated.tp1Hit = true;
      events.push('TP1_HIT — move stop to breakeven');
      if (!updated.stopMoved) {
        updated.stop = trade.entry;
        updated.stopMoved = true;
        updated.notes = [...updated.notes, `Stop moved to BE at TP1 (${currentPrice})`];
      }
    }
  }

  // TP2 hit
  if (updated.tp1Hit && !trade.tp2Hit) {
    if ((iLong && currentPrice >= trade.tp2) || (!iLong && currentPrice <= trade.tp2)) {
      updated.tp2Hit = true;
      events.push('TP2_HIT — partial close, trail remaining');
    }
  }

  // Stop hit
  if ((iLong && currentPrice <= updated.stop) || (!iLong && currentPrice >= updated.stop)) {
    updated.status    = unrealizedR >= -0.1 ? 'BREAKEVEN' : 'LOSS';
    updated.exitPrice = currentPrice;
    updated.exitTime  = new Date().toISOString();
    updated.rMultiple = parseFloat(unrealizedR.toFixed(2));
    events.push(`STOPPED_OUT — ${updated.status} at R=${updated.rMultiple}`);
  }

  // TP3 / full target hit
  if ((iLong && currentPrice >= trade.tp3) || (!iLong && currentPrice <= trade.tp3)) {
    updated.status    = 'WIN';
    updated.exitPrice = currentPrice;
    updated.exitTime  = new Date().toISOString();
    updated.rMultiple = parseFloat(unrealizedR.toFixed(2));
    events.push(`TP3_HIT — FULL TARGET. R=${updated.rMultiple}`);
  }

  const isClosed = ['WIN', 'LOSS', 'BREAKEVEN'].includes(updated.status);
  let newHistory = state.tradeHistory;
  if (isClosed) {
    newHistory = [updated, ...state.tradeHistory].slice(0, MAX_HISTORY);
  }

  const newState = {
    ...state,
    activeTrade:  isClosed ? null : updated,
    tradeHistory: newHistory,
  };

  return { state: newState, events, unrealizedR, distToStop, distToTp1 };
}

/**
 * Close trade manually (e.g. regime change, manual exit)
 */
export function closeTrade(state, currentPrice, reason = 'MANUAL_EXIT') {
  const trade = state.activeTrade;
  if (!trade) return state;

  const risk = Math.abs(trade.entry - trade.stop);
  const pnl  = trade.type === 'LONG' ? currentPrice - trade.entry : trade.entry - currentPrice;
  const r    = risk > 0 ? pnl / risk : 0;

  const closed = {
    ...trade,
    status:    r >= 0 ? (r < 0.1 ? 'BREAKEVEN' : 'WIN') : 'LOSS',
    exitPrice: currentPrice,
    exitTime:  new Date().toISOString(),
    rMultiple: parseFloat(r.toFixed(2)),
    notes:     [...trade.notes, reason],
  };

  return {
    ...state,
    activeTrade:  null,
    tradeHistory: [closed, ...state.tradeHistory].slice(0, MAX_HISTORY),
  };
}

/**
 * Ingest external trade log (CSV rows or JSON array) and merge into history
 * Expected JSON: [ { type, entry, stop, exitPrice, status, rMultiple, entryTime, exitTime, setup }, ... ]
 */
export function ingestExternalLog(state, records) {
  const normalized = records.map((r, i) => ({
    id:         r.id || `ext_${i}`,
    type:       r.type || 'LONG',
    entry:      parseFloat(r.entry) || 0,
    stop:       parseFloat(r.stop) || 0,
    tp1:        parseFloat(r.tp1) || 0,
    tp2:        parseFloat(r.tp2) || 0,
    tp3:        parseFloat(r.tp3) || 0,
    rr:         r.rr || '0',
    setup:      r.setup || 'EXTERNAL',
    entryTime:  r.entryTime || new Date().toISOString(),
    exitTime:   r.exitTime || new Date().toISOString(),
    exitPrice:  parseFloat(r.exitPrice) || null,
    status:     r.status || 'LOSS',
    rMultiple:  parseFloat(r.rMultiple) || null,
    notes:      r.notes || ['imported'],
    tp1Hit:     !!r.tp1Hit,
    tp2Hit:     !!r.tp2Hit,
    stopMoved:  !!r.stopMoved,
  }));

  const merged = [...normalized, ...state.tradeHistory]
    .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)
    .slice(0, MAX_HISTORY);

  return { ...state, tradeHistory: merged };
}
