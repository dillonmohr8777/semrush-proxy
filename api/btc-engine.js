/**
 * BTC/USDT Institutional Trading Engine — API Handler v2
 * Stateful | Performance-driven | Execution-ready
 *
 * GET /api/btc-engine
 *   ?interval=15m          primary candle interval (default 15m)
 *   &format=text|json      output format (default text)
 *   &account=10000         account size in USD for position sizing
 *   &risk=1                risk % per trade (default 1)
 *   &action=ingest         POST body: JSON trade log to import into history
 *   &action=close          manually close active trade at current price
 *   &action=reset          reset all state (use with caution)
 */

import { fetchAllMarketData }                        from '../lib/data-fetcher.js';
import { analyzeMarket }                             from '../lib/market-analyzer.js';
import { formatReport }                              from '../lib/report-formatter.js';
import {
  loadState, saveState,
  openTrade, updateActiveTrade, closeTrade, ingestExternalLog,
}                                                    from '../lib/state-manager.js';
import { computePerformance }                        from '../lib/performance-engine.js';
import { calculatePositionSize, adjustForConfidence } from '../lib/position-sizer.js';
import { validateSignal, classifyUrgency }           from '../lib/signal-validator.js';

const VALID_INTERVALS = new Set(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const interval    = VALID_INTERVALS.has(req.query.interval) ? req.query.interval : '15m';
  const format      = req.query.format === 'json' ? 'json' : 'text';
  const accountSize = parseFloat(req.query.account) || null;
  const riskPct     = parseFloat(req.query.risk)    || 1;
  const action      = req.query.action || null;

  // ── Load persistent state ─────────────────────────────────────────────────
  let state = loadState();

  // ── Special actions ───────────────────────────────────────────────────────
  if (action === 'reset') {
    state = { bias: 'NEUTRAL', biasStrength: 'WEAK', regime: 'UNKNOWN',
              activeTrade: null, tradeHistory: [], lastUpdated: null, loopCount: 0 };
    saveState(state);
    res.status(200).json({ ok: true, message: 'State reset' });
    return;
  }

  if (action === 'close' && state.activeTrade) {
    // Need current price — do a quick fetch
    try {
      const { candles15m } = await fetchAllMarketData('15m');
      const price = candles15m[candles15m.length - 1].close;
      state = closeTrade(state, price, 'MANUAL_CLOSE');
      saveState(state);
      res.status(200).json({ ok: true, message: `Trade closed at $${price}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (action === 'ingest' && req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const records = Array.isArray(body) ? body : body.trades || [];
      state = ingestExternalLog(state, records);
      saveState(state);
      res.status(200).json({ ok: true, imported: records.length, total: state.tradeHistory.length });
    } catch (err) {
      res.status(400).json({ error: 'Invalid trade log: ' + err.message });
    }
    return;
  }

  // ── Fetch live market data ────────────────────────────────────────────────
  let marketData;
  try {
    marketData = await fetchAllMarketData(interval);
  } catch (err) {
    console.error('[btc-engine] Data fetch failed:', err.message);
    res.status(500).json({ error: 'Market data fetch failed', detail: err.message });
    return;
  }

  const { candles15m, candles1h, orderBook, recentTrades, ticker } = marketData;

  // ── Run analysis ──────────────────────────────────────────────────────────
  const analysis = analyzeMarket(candles15m, orderBook, recentTrades);
  if (analysis.error) { res.status(422).json({ error: analysis.error }); return; }

  const htfAnalysis = analyzeMarket(candles1h, null, null);
  const htfBias     = htfAnalysis.error ? 'N/A' : htfAnalysis.bias;

  // ── Update active trade with current price ────────────────────────────────
  let tradeEvents = [], tradeStatus = {};
  if (state.activeTrade) {
    const result = updateActiveTrade(state, analysis.currentPrice);
    state        = result.state;
    tradeEvents  = result.events;
    tradeStatus  = {
      unrealizedR: result.unrealizedR,
      distToStop:  result.distToStop,
      distToTp1:   result.distToTp1,
    };
  }

  // ── Compute performance ───────────────────────────────────────────────────
  const perf = computePerformance(state.tradeHistory);

  // ── Validate new signal (only if no active trade) ─────────────────────────
  let validation = null;
  let sizing     = null;

  if (!state.activeTrade && analysis.tradeSignal) {
    validation = validateSignal(
      analysis.tradeSignal,
      perf,
      analysis.marketRegime,
    );
    validation.urgency = classifyUrgency(analysis.tradeSignal, analysis.currentPrice);

    if (validation.approved) {
      // Open trade in state
      state = openTrade(state, analysis.tradeSignal, 'EMA_OB_SIGNAL');

      // Position sizing
      if (accountSize) {
        const rawSizing = calculatePositionSize({
          accountSize,
          riskPercent: riskPct,
          entry:       analysis.tradeSignal.entry,
          stop:        analysis.tradeSignal.stop,
        });
        sizing = adjustForConfidence(rawSizing, validation.confidence);
      }
    }
  }

  // ── Detect meaningful state changes ───────────────────────────────────────
  const biasChanged   = state.bias !== analysis.bias;
  const regimeChanged = state.regime !== analysis.marketRegime;
  const hasEvents     = tradeEvents.length > 0;
  const hasSignal     = validation && validation.approved;

  const meaningfulChange = biasChanged || regimeChanged || hasEvents || hasSignal
    || state.loopCount === 0;

  // ── Update persisted state ────────────────────────────────────────────────
  state = saveState({
    ...state,
    bias:         analysis.bias,
    biasStrength: analysis.biasStrength,
    regime:       analysis.marketRegime,
  });

  const timestamp = Date.now();

  // ── Output ────────────────────────────────────────────────────────────────
  if (format === 'json') {
    res.status(200).json({
      timestamp,
      interval,
      meaningfulChange,
      currentPrice:     analysis.currentPrice,
      bias:             analysis.bias,
      biasStrength:     analysis.biasStrength,
      htfBias,
      bullProbability:  analysis.bullProbability,
      bearProbability:  analysis.bearProbability,
      marketRegime:     analysis.marketRegime,
      marketIntent:     analysis.marketIntent,
      indicators:       analysis.indicators,
      liquidityTargets: analysis.liquidityTargets,
      tradeSignal:      analysis.tradeSignal,
      validation,
      sizing,
      positioning:      analysis.positioning,
      momentumAlert:    analysis.momentumAlert,
      microUpdate:      analysis.microUpdate,
      orderFlow:        analysis.orderFlow,
      activeTrade:      state.activeTrade,
      tradeEvents,
      tradeStatus,
      performance:      perf,
      loopCount:        state.loopCount,
      ticker: ticker ? {
        priceChange:        ticker.priceChange,
        priceChangePercent: ticker.priceChangePercent,
        highPrice:          ticker.highPrice,
        lowPrice:           ticker.lowPrice,
        volume:             ticker.volume,
        quoteVolume:        ticker.quoteVolume,
      } : null,
    });
  } else {
    if (!meaningfulChange) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(200).send(
        `NO CHANGE — MAINTAIN STATE\n` +
        `Cycle #${state.loopCount} | ${new Date(timestamp).toUTCString()}\n` +
        `Bias: ${analysis.bias} (${analysis.biasStrength}) | Price: $${analysis.currentPrice.toLocaleString()}`
      );
      return;
    }

    const report = formatReport(analysis, ticker, timestamp, {
      state,
      perf,
      validation,
      sizing,
      tradeEvents,
      tradeStatus,
      htfBias,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(report);
  }
}
