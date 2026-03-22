/**
 * BTC/USDT Market Analyzer
 * Institutional-grade analysis engine: liquidity flows, positioning, momentum
 */

/**
 * Compute Exponential Moving Average over a price array
 */
function ema(prices, period) {
  const k = 2 / (period + 1);
  let result = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    result.push(prices[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/**
 * Compute RSI over a close-price array
 */
function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff >= 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Compute Average True Range
 */
function atr(candles, period = 14) {
  const trs = candles.slice(1).map((c, i) => {
    const prev = candles[i];
    return Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    );
  });
  if (trs.length < period) return trs[trs.length - 1] || 0;
  let sum = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let atrVal = sum / period;
  for (let i = period; i < trs.length; i++) {
    atrVal = (atrVal * (period - 1) + trs[i]) / period;
  }
  return atrVal;
}

/**
 * Detect swing highs and lows (liquidity pools)
 */
function detectSwings(candles, lookback = 5) {
  const highs = [], lows = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    const isSwingHigh = candles.slice(i - lookback, i).every(x => x.high <= c.high) &&
                        candles.slice(i + 1, i + lookback + 1).every(x => x.high <= c.high);
    const isSwingLow  = candles.slice(i - lookback, i).every(x => x.low >= c.low) &&
                        candles.slice(i + 1, i + lookback + 1).every(x => x.low >= c.low);
    if (isSwingHigh) highs.push(c.high);
    if (isSwingLow)  lows.push(c.low);
  }
  return { highs, lows };
}

/**
 * Compute volume-weighted price clusters (liquidity nodes)
 */
function volumeProfile(candles, buckets = 20) {
  const prices = candles.map(c => (c.high + c.low) / 2);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const step = (maxP - minP) / buckets;
  const profile = Array(buckets).fill(0);
  candles.forEach((c, i) => {
    const idx = Math.min(Math.floor((prices[i] - minP) / step), buckets - 1);
    profile[idx] += c.volume;
  });
  const poc = profile.indexOf(Math.max(...profile));
  return {
    poc: minP + poc * step + step / 2,
    valueAreaHigh: minP + (poc + 3) * step,
    valueAreaLow: Math.max(minP, minP + (poc - 3) * step),
  };
}

/**
 * Determine volatility regime
 */
function volatilityRegime(atrValue, currentPrice) {
  const atrPct = (atrValue / currentPrice) * 100;
  if (atrPct > 2.5) return 'HIGH_VOLATILITY';
  if (atrPct > 1.2) return 'TRENDING';
  return 'LOW_VOLATILITY_CHOP';
}

/**
 * Detect order block (last bearish candle before bullish impulse / vice versa)
 */
function detectOrderBlocks(candles, lookback = 10) {
  const blocks = [];
  for (let i = lookback; i < candles.length - 1; i++) {
    const c = candles[i];
    const next = candles[i + 1];
    // Bullish OB: bearish candle followed by strong bullish engulf
    if (c.close < c.open && next.close > next.open &&
        (next.close - next.open) > 1.5 * (c.open - c.close)) {
      blocks.push({ type: 'BULLISH_OB', high: c.open, low: c.low, index: i });
    }
    // Bearish OB: bullish candle followed by strong bearish engulf
    if (c.close > c.open && next.close < next.open &&
        (next.open - next.close) > 1.5 * (c.close - c.open)) {
      blocks.push({ type: 'BEARISH_OB', high: c.high, low: c.close, index: i });
    }
  }
  return blocks;
}

/**
 * Main analysis function — returns full market state
 */
export function analyzeMarket(candles, orderBook, recentTrades) {
  if (!candles || candles.length < 20) {
    return { error: 'Insufficient candle data' };
  }

  const closes  = candles.map(c => c.close);
  const currentPrice = closes[closes.length - 1];
  const lastCandle   = candles[candles.length - 1];

  // --- Trend ---
  const ema9  = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);
  const e9  = ema9[ema9.length - 1];
  const e21 = ema21[ema21.length - 1];
  const e50 = ema50.length ? ema50[ema50.length - 1] : e21;

  const rsiVal   = rsi(closes, 14);
  const atrVal   = atr(candles, 14);
  const regime   = volatilityRegime(atrVal, currentPrice);
  const swings   = detectSwings(candles, 3);
  const vp       = volumeProfile(candles);
  const obBlocks = detectOrderBlocks(candles);

  // --- Bias calculation ---
  let bullScore = 0, bearScore = 0;

  // EMA stack
  if (e9 > e21) bullScore += 2; else bearScore += 2;
  if (e21 > e50) bullScore += 2; else bearScore += 2;
  if (currentPrice > e9) bullScore += 1; else bearScore += 1;

  // RSI
  if (rsiVal !== null) {
    if (rsiVal > 55) bullScore += 2;
    else if (rsiVal < 45) bearScore += 2;
    if (rsiVal > 70) bearScore += 1; // overbought
    if (rsiVal < 30) bullScore += 1; // oversold bounce
  }

  // Recent candle momentum (last 5)
  const last5 = candles.slice(-5);
  const bullCandles = last5.filter(c => c.close > c.open).length;
  const bearCandles = 5 - bullCandles;
  bullScore += bullCandles;
  bearScore += bearCandles;

  // Volume surge
  const avgVol = candles.slice(-20, -1).reduce((s, c) => s + c.volume, 0) / 19;
  if (lastCandle.volume > avgVol * 1.5) {
    if (lastCandle.close > lastCandle.open) bullScore += 2;
    else bearScore += 2;
  }

  // Order book imbalance
  let bidDepth = 0, askDepth = 0;
  if (orderBook) {
    const topBids = orderBook.bids.slice(0, 20);
    const topAsks = orderBook.asks.slice(0, 20);
    bidDepth = topBids.reduce((s, [, qty]) => s + parseFloat(qty), 0);
    askDepth = topAsks.reduce((s, [, qty]) => s + parseFloat(qty), 0);
    if (bidDepth > askDepth * 1.3) bullScore += 2;
    else if (askDepth > bidDepth * 1.3) bearScore += 2;
  }

  const totalScore = bullScore + bearScore;
  const bullPct = totalScore > 0 ? (bullScore / totalScore) * 100 : 50;

  let bias, biasStrength;
  if (bullPct >= 65) { bias = 'BULLISH'; }
  else if (bullPct <= 35) { bias = 'BEARISH'; }
  else { bias = 'NEUTRAL'; }

  const biasEdge = Math.abs(bullPct - 50);
  if (biasEdge >= 20) biasStrength = 'STRONG';
  else if (biasEdge >= 10) biasStrength = 'MODERATE';
  else biasStrength = 'WEAK';

  // --- Liquidity targets ---
  const nearSwingHighs = swings.highs.filter(h => h > currentPrice).sort((a, b) => a - b);
  const nearSwingLows  = swings.lows.filter(l => l < currentPrice).sort((a, b) => b - a);

  const upsideTarget   = nearSwingHighs[0] || currentPrice + atrVal * 2;
  const downsideTarget = nearSwingLows[0]  || currentPrice - atrVal * 2;
  const upsidePct      = ((upsideTarget - currentPrice) / currentPrice * 100).toFixed(2);
  const downsidePct    = ((currentPrice - downsideTarget) / currentPrice * 100).toFixed(2);

  // Most likely path
  let mostLikelyPath;
  if (bias === 'BULLISH') {
    mostLikelyPath = `Sweep ${formatPrice(downsideTarget)} lows → Reverse → Target ${formatPrice(upsideTarget)}`;
  } else if (bias === 'BEARISH') {
    mostLikelyPath = `Sweep ${formatPrice(upsideTarget)} highs → Reverse → Target ${formatPrice(downsideTarget)}`;
  } else {
    mostLikelyPath = `Range-bound between ${formatPrice(downsideTarget)} — ${formatPrice(upsideTarget)}`;
  }

  // --- Positioning read ---
  let trapped, inControl, maxPainMove;
  if (bias === 'BULLISH') {
    trapped    = 'Late shorts who sold the recent dip';
    inControl  = 'Buyers — EMA stack aligned, momentum positive';
    maxPainMove = `Sharp squeeze to ${formatPrice(upsideTarget)} liquidating shorts`;
  } else if (bias === 'BEARISH') {
    trapped    = 'Late longs who bought the recent push';
    inControl  = 'Sellers — distribution in progress, structure breaking';
    maxPainMove = `Flush to ${formatPrice(downsideTarget)} liquidating longs`;
  } else {
    trapped    = 'Both sides — range is compressing';
    inControl  = 'Market makers — hunting both sides';
    maxPainMove = 'Fake breakout in either direction before reversal';
  }

  // --- Trade signal ---
  let tradeSignal = null;
  const recentOBs = obBlocks.slice(-3);
  const bullishOB = recentOBs.filter(b => b.type === 'BULLISH_OB').pop();
  const bearishOB = recentOBs.filter(b => b.type === 'BEARISH_OB').pop();

  if (bias === 'BULLISH' && biasStrength !== 'WEAK') {
    const entry = bullishOB ? bullishOB.high : e21;
    const stop  = bullishOB ? bullishOB.low - atrVal * 0.2 : e50 - atrVal * 0.5;
    const risk  = entry - stop;
    if (risk > 0 && currentPrice >= entry * 0.999 && currentPrice <= entry * 1.005) {
      tradeSignal = {
        type: 'LONG',
        entry: entry,
        stop: stop,
        tp1: entry + risk * 1.5,
        tp2: entry + risk * 2.5,
        tp3: upsideTarget,
        rr: ((upsideTarget - entry) / risk).toFixed(1),
      };
    }
  } else if (bias === 'BEARISH' && biasStrength !== 'WEAK') {
    const entry = bearishOB ? bearishOB.low : e21;
    const stop  = bearishOB ? bearishOB.high + atrVal * 0.2 : e50 + atrVal * 0.5;
    const risk  = stop - entry;
    if (risk > 0 && currentPrice <= entry * 1.001 && currentPrice >= entry * 0.995) {
      tradeSignal = {
        type: 'SHORT',
        entry: entry,
        stop: stop,
        tp1: entry - risk * 1.5,
        tp2: entry - risk * 2.5,
        tp3: downsideTarget,
        rr: ((entry - downsideTarget) / risk).toFixed(1),
      };
    }
  }

  // --- Momentum shift ---
  const prevRsi = rsi(closes.slice(0, -3), 14);
  let momentumAlert = null;
  if (rsiVal !== null && prevRsi !== null) {
    const rsiDelta = rsiVal - prevRsi;
    if (Math.abs(rsiDelta) > 5) {
      momentumAlert = rsiDelta > 0
        ? `RSI surging +${rsiDelta.toFixed(1)} pts — bullish momentum accelerating`
        : `RSI dropping ${rsiDelta.toFixed(1)} pts — bearish momentum accelerating`;
    }
    if (rsiVal > 68 && e9 > e21) momentumAlert = 'Overbought with trend — reversal risk rising';
    if (rsiVal < 32 && e9 < e21) momentumAlert = 'Oversold with trend — bounce / continuation decision point';
  }

  // --- Market intent ---
  let marketIntent;
  const priceVsPOC = currentPrice - vp.poc;
  if (Math.abs(priceVsPOC) < atrVal * 0.3) {
    marketIntent = lastCandle.volume > avgVol * 1.2 ? 'ACCUMULATION' : 'DISTRIBUTION';
  } else if (bullPct > 60 && regime !== 'LOW_VOLATILITY_CHOP') {
    marketIntent = 'TREND_CONTINUATION';
  } else if (bullPct < 40 && regime !== 'LOW_VOLATILITY_CHOP') {
    marketIntent = 'TREND_CONTINUATION';
  } else if (regime === 'LOW_VOLATILITY_CHOP') {
    marketIntent = 'CONSOLIDATION';
  } else {
    marketIntent = 'FAKE_BREAKOUT_RISK';
  }

  // --- Micro update ---
  const bidAskRatio = bidDepth > 0 && askDepth > 0
    ? (bidDepth / askDepth).toFixed(2) : 'N/A';
  const microUpdate = `Price at ${formatPrice(currentPrice)} | RSI ${rsiVal ? rsiVal.toFixed(1) : 'N/A'} | ATR ${formatPrice(atrVal)} | Bid/Ask ${bidAskRatio} | ${lastCandle.volume > avgVol * 1.3 ? 'VOLUME SURGE' : 'normal volume'}`;

  return {
    currentPrice,
    bias,
    biasStrength,
    bullProbability: bullPct.toFixed(1),
    bearProbability: (100 - bullPct).toFixed(1),
    marketRegime: regime,
    marketIntent,
    indicators: { rsi: rsiVal, ema9: e9, ema21: e21, ema50: e50, atr: atrVal },
    liquidityTargets: {
      upsideTarget,
      upsidePct,
      downsideTarget,
      downsidePct,
      mostLikelyPath,
      poc: vp.poc,
    },
    tradeSignal,
    positioning: { trapped, inControl, maxPainMove },
    momentumAlert,
    microUpdate,
    orderFlow: { bidDepth, askDepth, bidAskRatio },
  };
}

function formatPrice(p) {
  return '$' + Number(p).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
