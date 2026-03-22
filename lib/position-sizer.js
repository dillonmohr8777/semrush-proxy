/**
 * Position Sizing Engine
 * Calculates position size, dollar risk, and leverage equivalent
 * given account size, risk %, entry, and stop.
 *
 * Default risk: 1% per trade
 */

export function calculatePositionSize({
  accountSize,          // USD
  riskPercent = 1,      // % of account to risk
  entry,                // trade entry price
  stop,                 // stop loss price
  leverage = null,      // if provided, calculate leveraged position
}) {
  if (!accountSize || !entry || !stop) {
    return null;
  }

  const dollarRisk  = accountSize * (riskPercent / 100);
  const stopDist    = Math.abs(entry - stop);
  const stopPct     = (stopDist / entry) * 100;

  if (stopDist === 0) return null;

  // Position size in BTC
  const btcSize = dollarRisk / stopDist;

  // Notional value (USD)
  const notionalUSD = btcSize * entry;

  // Leverage equivalent (what leverage this implies on account)
  const leverageEquiv = notionalUSD / accountSize;

  // If a specific leverage is provided, adjust for margin
  let marginRequired = null;
  let maxBtcAtLeverage = null;
  if (leverage) {
    marginRequired    = notionalUSD / leverage;
    maxBtcAtLeverage  = (accountSize * leverage) / entry;
  }

  return {
    accountSize:      accountSize,
    riskPercent:      riskPercent,
    dollarRisk:       parseFloat(dollarRisk.toFixed(2)),
    stopDistance:     parseFloat(stopDist.toFixed(2)),
    stopPercent:      parseFloat(stopPct.toFixed(3)),
    btcSize:          parseFloat(btcSize.toFixed(6)),
    notionalUSD:      parseFloat(notionalUSD.toFixed(2)),
    leverageEquiv:    parseFloat(leverageEquiv.toFixed(2)),
    marginRequired:   marginRequired ? parseFloat(marginRequired.toFixed(2)) : null,
    maxBtcAtLeverage: maxBtcAtLeverage ? parseFloat(maxBtcAtLeverage.toFixed(6)) : null,
  };
}

/**
 * Risk-adjust position size based on confidence level
 * confidence: 0–1 (maps to 0.5x–1x of base risk)
 */
export function adjustForConfidence(sizing, confidence) {
  if (!sizing) return null;
  const multiplier = 0.5 + (confidence * 0.5);  // 0.5 at low conf, 1.0 at full conf
  return {
    ...sizing,
    dollarRisk:    parseFloat((sizing.dollarRisk * multiplier).toFixed(2)),
    btcSize:       parseFloat((sizing.btcSize    * multiplier).toFixed(6)),
    notionalUSD:   parseFloat((sizing.notionalUSD * multiplier).toFixed(2)),
    confidenceMultiplier: parseFloat(multiplier.toFixed(2)),
  };
}
