/**
 * Format market analysis into the institutional trading engine output structure
 */

function p(n, decimals = 0) {
  return '$' + Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pct(n) { return Number(n).toFixed(2) + '%'; }

export function formatReport(analysis, ticker, timestamp) {
  const {
    currentPrice, bias, biasStrength, bullProbability, bearProbability,
    marketRegime, marketIntent, indicators, liquidityTargets,
    tradeSignal, positioning, momentumAlert, microUpdate, orderFlow,
  } = analysis;

  const biasEmoji  = bias === 'BULLISH' ? '🟢' : bias === 'BEARISH' ? '🔴' : '🟡';
  const regimeLabel = {
    HIGH_VOLATILITY:       'EXPANSION — High Volatility',
    TRENDING:              'TRENDING — Directional Momentum',
    LOW_VOLATILITY_CHOP:   'CHOP / CONSOLIDATION',
  }[marketRegime] || marketRegime;

  const change24h = ticker ? parseFloat(ticker.priceChangePercent) : null;
  const change24hStr = change24h !== null
    ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`
    : 'N/A';

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `  BTC/USDT TRADING ENGINE  |  ${new Date(timestamp).toUTCString()}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `  PRICE: ${p(currentPrice)}    24H: ${change24hStr}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `🔹 CURRENT STATE`,
    ``,
    `  BIAS:            ${biasEmoji} ${bias}`,
    `  BIAS STRENGTH:   ${biasStrength}`,
    `  MARKET REGIME:   ${regimeLabel}`,
    `  MARKET INTENT:   ${marketIntent}`,
    `  BULL PROBABILITY: ${bullProbability}%   BEAR PROBABILITY: ${bearProbability}%`,
    ``,
    `  INDICATORS`,
    `  RSI (14):  ${indicators.rsi ? indicators.rsi.toFixed(1) : 'N/A'}`,
    `  EMA  9:    ${p(indicators.ema9, 0)}`,
    `  EMA 21:    ${p(indicators.ema21, 0)}`,
    `  EMA 50:    ${p(indicators.ema50, 0)}`,
    `  ATR (14):  ${p(indicators.atr, 0)}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔹 LIQUIDITY TARGETS`,
    ``,
    `  Upside Target:    ${p(liquidityTargets.upsideTarget)}  (+${liquidityTargets.upsidePct}%)`,
    `  Downside Target:  ${p(liquidityTargets.downsideTarget)}  (-${liquidityTargets.downsidePct}%)`,
    `  POC (Volume):     ${p(liquidityTargets.poc)}`,
    ``,
    `  Most Likely Path:`,
    `  → ${liquidityTargets.mostLikelyPath}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ];

  // Trade signal section
  lines.push(`🔹 TRADE SIGNAL`);
  lines.push(``);
  if (tradeSignal) {
    const ts = tradeSignal;
    lines.push(`  ⚡ SIGNAL ACTIVE`);
    lines.push(`  TRADE TYPE: ${ts.type}`);
    lines.push(`  ENTRY:  ${p(ts.entry)}`);
    lines.push(`  STOP:   ${p(ts.stop)}`);
    lines.push(`  TP1:    ${p(ts.tp1)}`);
    lines.push(`  TP2:    ${p(ts.tp2)}`);
    lines.push(`  TP3:    ${p(ts.tp3)}`);
    lines.push(`  R:R     1:${ts.rr}`);
  } else {
    lines.push(`  NO TRADE — WAITING FOR CONFIRMATION`);
    lines.push(`  Capital preservation mode active`);
  }
  lines.push(``);

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🔹 POSITIONING READ`);
  lines.push(``);
  lines.push(`  Who is trapped:    ${positioning.trapped}`);
  lines.push(`  Who is in control: ${positioning.inControl}`);
  lines.push(`  Max pain move:     ${positioning.maxPainMove}`);
  lines.push(``);

  // Order flow
  if (orderFlow.bidDepth > 0) {
    lines.push(`  ORDER BOOK DEPTH`);
    lines.push(`  Bid depth (top 20): ${orderFlow.bidDepth.toFixed(2)} BTC`);
    lines.push(`  Ask depth (top 20): ${orderFlow.askDepth.toFixed(2)} BTC`);
    lines.push(`  Bid/Ask ratio:      ${orderFlow.bidAskRatio}`);
    lines.push(``);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // Momentum alert
  if (momentumAlert) {
    lines.push(`🔹 MOMENTUM SHIFT ALERT`);
    lines.push(``);
    lines.push(`  ⚠️  ${momentumAlert}`);
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }

  lines.push(`🔹 MICRO UPDATE`);
  lines.push(``);
  lines.push(`  ${microUpdate}`);
  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return lines.join('\n');
}
