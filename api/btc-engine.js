/**
 * BTC/USDT Institutional Trading Engine — API Handler
 *
 * GET /api/btc-engine
 *   ?interval=15m   (optional: 1m, 5m, 15m, 1h, 4h, 1d — default 15m)
 *   &format=text    (optional: 'text' for plain-text report, 'json' for raw data — default text)
 *
 * Fetches live Binance data, runs institutional-grade analysis, returns market state.
 */

import { fetchAllMarketData } from '../lib/data-fetcher.js';
import { analyzeMarket }      from '../lib/market-analyzer.js';
import { formatReport }       from '../lib/report-formatter.js';

const VALID_INTERVALS = new Set(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const interval = VALID_INTERVALS.has(req.query.interval) ? req.query.interval : '15m';
  const format   = req.query.format === 'json' ? 'json' : 'text';

  try {
    const { candles15m, candles1h, orderBook, recentTrades, ticker } =
      await fetchAllMarketData(interval);

    // Use the requested interval candles as primary; fall back to 15m
    const primaryCandles = candles15m;

    const analysis = analyzeMarket(primaryCandles, orderBook, recentTrades);

    if (analysis.error) {
      res.status(422).json({ error: analysis.error });
      return;
    }

    // Higher-timeframe bias context (1h)
    const htfAnalysis = analyzeMarket(candles1h, null, null);
    const htfBias = htfAnalysis.error ? 'N/A' : htfAnalysis.bias;

    const timestamp = Date.now();

    if (format === 'json') {
      res.status(200).json({
        timestamp,
        interval,
        currentPrice:    analysis.currentPrice,
        bias:            analysis.bias,
        biasStrength:    analysis.biasStrength,
        htfBias,
        bullProbability: analysis.bullProbability,
        bearProbability: analysis.bearProbability,
        marketRegime:    analysis.marketRegime,
        marketIntent:    analysis.marketIntent,
        indicators:      analysis.indicators,
        liquidityTargets: analysis.liquidityTargets,
        tradeSignal:     analysis.tradeSignal,
        positioning:     analysis.positioning,
        momentumAlert:   analysis.momentumAlert,
        microUpdate:     analysis.microUpdate,
        orderFlow:       analysis.orderFlow,
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
      // Plain-text institutional report
      let report = formatReport(analysis, ticker, timestamp);

      // Inject HTF context
      const htfLine = `  HTF BIAS (1H): ${htfBias}`;
      report = report.replace('  MARKET INTENT:', htfLine + '\n  MARKET INTENT:');

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(200).send(report);
    }
  } catch (err) {
    console.error('[btc-engine] Error:', err.message);
    res.status(500).json({
      error: 'Market data fetch failed',
      detail: err.message,
    });
  }
}
