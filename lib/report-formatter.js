/**
 * Format market analysis into the institutional trading engine output structure
 * v2: adds SYSTEM STATE, TRADE STATUS, EXECUTION SIGNAL, PERFORMANCE SNAPSHOT
 */

function p(n, decimals = 0) {
  return '$' + Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatReport(analysis, ticker, timestamp, {
  state,
  perf,
  validation,
  sizing,
  tradeEvents,
  tradeStatus,
  htfBias,
} = {}) {
  const {
    currentPrice, bias, biasStrength, bullProbability, bearProbability,
    marketRegime, marketIntent, indicators, liquidityTargets,
    tradeSignal, positioning, momentumAlert, microUpdate, orderFlow,
  } = analysis;

  const biasEmoji = bias === 'BULLISH' ? '🟢' : bias === 'BEARISH' ? '🔴' : '🟡';
  const regimeLabel = {
    HIGH_VOLATILITY:     'EXPANSION — High Volatility',
    TRENDING:            'TRENDING — Directional Momentum',
    LOW_VOLATILITY_CHOP: 'CHOP / CONSOLIDATION',
  }[marketRegime] || marketRegime;

  const change24h    = ticker ? parseFloat(ticker.priceChangePercent) : null;
  const change24hStr = change24h !== null
    ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%` : 'N/A';

  const loopCount = state ? state.loopCount : '—';

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `  BTC/USDT TRADING ENGINE  |  CYCLE #${loopCount}`,
    `  ${new Date(timestamp).toUTCString()}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `  PRICE: ${p(currentPrice)}    24H: ${change24hStr}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `🔹 SYSTEM STATE`,
    ``,
    `  Active Trade:   ${state && state.activeTrade ? 'YES — ' + state.activeTrade.type : 'NO'}`,
    `  Current Bias:   ${biasEmoji} ${bias} (${biasStrength})`,
    `  HTF Bias (1H):  ${htfBias || 'N/A'}`,
    `  Regime:         ${regimeLabel}`,
    `  Market Intent:  ${marketIntent}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔹 CURRENT STATE`,
    ``,
    `  BIAS:            ${biasEmoji} ${bias}`,
    `  BIAS STRENGTH:   ${biasStrength}`,
    `  BULL PROBABILITY: ${bullProbability}%   BEAR PROBABILITY: ${bearProbability}%`,
    ``,
    `  INDICATORS`,
    `  RSI (14):  ${indicators.rsi ? indicators.rsi.toFixed(1) : 'N/A'}`,
    `  EMA  9:    ${p(indicators.ema9)}`,
    `  EMA 21:    ${p(indicators.ema21)}`,
    `  EMA 50:    ${p(indicators.ema50)}`,
    `  ATR (14):  ${p(indicators.atr)}`,
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

  // ── TRADE STATUS (if active) ──────────────────────────────────────────────
  if (state && state.activeTrade) {
    const t   = state.activeTrade;
    const ts  = tradeStatus || {};
    const r   = ts.unrealizedR !== undefined ? ts.unrealizedR.toFixed(2) : '—';
    const sign = parseFloat(r) >= 0 ? '+' : '';
    lines.push(`🔹 TRADE STATUS — ${t.type} ACTIVE`);
    lines.push(``);
    lines.push(`  Entry Hit:        ${t.entryTime ? 'YES' : 'NO'}`);
    lines.push(`  Entry Price:      ${p(t.entry)}`);
    lines.push(`  Current Price:    ${p(currentPrice)}`);
    lines.push(`  Unrealized R:     ${sign}${r}R`);
    lines.push(`  TP1 Hit:          ${t.tp1Hit ? 'YES ✓' : 'NO'}`);
    lines.push(`  TP2 Hit:          ${t.tp2Hit ? 'YES ✓' : 'NO'}`);
    lines.push(`  Stop Moved to BE: ${t.stopMoved ? 'YES ✓' : 'NO'}`);
    lines.push(`  Distance to TP1:  ${ts.distToTp1 !== undefined ? p(ts.distToTp1) : '—'}`);
    lines.push(`  Distance to Stop: ${ts.distToStop !== undefined ? p(ts.distToStop) : '—'}`);
    if (tradeEvents && tradeEvents.length > 0) {
      lines.push(`  EVENTS:           ${tradeEvents.join(' | ')}`);
    }
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }

  // ── EXECUTION SIGNAL ─────────────────────────────────────────────────────
  lines.push(`🔹 EXECUTION SIGNAL`);
  lines.push(``);

  if (validation && validation.approved && tradeSignal) {
    const ts      = tradeSignal;
    const urgency = validation.urgency || 'MEDIUM';
    lines.push(`  ⚡ SIGNAL APPROVED`);
    lines.push(`  Action:     ENTER`);
    lines.push(`  Urgency:    ${urgency}`);
    lines.push(`  Direction:  ${ts.type}`);
    lines.push(`  Entry:      ${p(ts.entry)}`);
    lines.push(`  Stop:       ${p(ts.stop)}`);
    lines.push(`  TP1:        ${p(ts.tp1)}`);
    lines.push(`  TP2:        ${p(ts.tp2)}`);
    lines.push(`  TP3:        ${p(ts.tp3)}`);
    lines.push(`  R:R:        1:${ts.rr}`);
    lines.push(`  Confidence: ${((validation.confidence || 0) * 100).toFixed(0)}%`);
    if (sizing) {
      lines.push(``);
      lines.push(`  POSITION SIZING`);
      lines.push(`  Account:       $${sizing.accountSize.toLocaleString()}`);
      lines.push(`  Risk (${sizing.riskPercent}%):    $${sizing.dollarRisk}`);
      lines.push(`  BTC Size:      ${sizing.btcSize} BTC`);
      lines.push(`  Notional:      $${sizing.notionalUSD.toLocaleString()}`);
      lines.push(`  Impl. Leverage: ${sizing.leverageEquiv}x`);
    }
  } else if (state && state.activeTrade) {
    lines.push(`  Action:  HOLD`);
    lines.push(`  Urgency: LOW`);
    lines.push(`  Reason:  Manage active trade`);
  } else if (validation) {
    lines.push(`  REJECT TRADE — INSUFFICIENT EDGE`);
    lines.push(`  ${validation.reason}`);
    if (validation.rejections && validation.rejections.length) {
      validation.rejections.forEach(r => lines.push(`  • ${r}`));
    }
  } else {
    lines.push(`  NO TRADE — WAITING FOR CONFIRMATION`);
    lines.push(`  Capital preservation mode active`);
  }
  lines.push(``);

  // ── POSITIONING READ ──────────────────────────────────────────────────────
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🔹 POSITIONING READ`);
  lines.push(``);
  lines.push(`  Who is trapped:    ${positioning.trapped}`);
  lines.push(`  Who is in control: ${positioning.inControl}`);
  lines.push(`  Max pain move:     ${positioning.maxPainMove}`);
  lines.push(``);

  if (orderFlow && orderFlow.bidDepth > 0) {
    lines.push(`  ORDER BOOK DEPTH`);
    lines.push(`  Bid depth (top 20): ${orderFlow.bidDepth.toFixed(2)} BTC`);
    lines.push(`  Ask depth (top 20): ${orderFlow.askDepth.toFixed(2)} BTC`);
    lines.push(`  Bid/Ask ratio:      ${orderFlow.bidAskRatio}`);
    lines.push(``);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // ── MOMENTUM SHIFT ALERT ─────────────────────────────────────────────────
  if (momentumAlert) {
    lines.push(`🔹 MOMENTUM SHIFT ALERT`);
    lines.push(``);
    lines.push(`  ⚠️  ${momentumAlert}`);
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }

  // ── PERFORMANCE SNAPSHOT ─────────────────────────────────────────────────
  lines.push(`🔹 PERFORMANCE SNAPSHOT`);
  lines.push(``);
  if (perf && perf.tradeCount > 0) {
    const streak = perf.currentStreak
      ? `${perf.currentStreak} ${perf.streakType} streak`
      : 'No streak';
    lines.push(`  Trades Logged:  ${perf.tradeCount}  (W:${perf.winCount} L:${perf.lossCount} BE:${perf.breakevenCount})`);
    lines.push(`  Win Rate:       ${perf.winRate}%`);
    lines.push(`  Avg R:          ${perf.avgR > 0 ? '+' : ''}${perf.avgR}R`);
    lines.push(`  Expectancy:     ${perf.expectancy > 0 ? '+' : ''}${perf.expectancy}R / trade`);
    lines.push(`  Profit Factor:  ${perf.profitFactor}`);
    lines.push(`  Max Drawdown:   ${perf.maxDrawdown}R`);
    lines.push(`  Streak:         ${streak}`);
    if (validation) {
      lines.push(`  Selectivity:    ${validation.selectivityFactor}x  (1.0 = normal)`);
    }
    if (perf.sufficient === false) {
      lines.push(`  ⚠️  < 10 trades — statistical filters partially suspended`);
    }
  } else {
    lines.push(`  No trades logged yet — baseline mode`);
    lines.push(`  Statistical filters will activate after 10 closed trades`);
  }
  lines.push(``);

  // ── MICRO UPDATE ─────────────────────────────────────────────────────────
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🔹 MICRO UPDATE`);
  lines.push(``);
  lines.push(`  ${microUpdate}`);
  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return lines.join('\n');
}
