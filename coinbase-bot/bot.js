import { loadPortfolio, savePortfolio } from './portfolio.js';
import { getPrice, getBuyPrice, getSellPrice } from './coinbase.js';

// Simple moving-average crossover strategy (paper trading only)
// Tracks short-term vs long-term average and trades on crossovers

const CONFIG = {
  coin: process.argv[2]?.toUpperCase() || 'BTC',
  intervalSeconds: parseInt(process.argv[3]) || 30,
  shortWindow: 5,   // number of price samples for short MA
  longWindow: 15,    // number of price samples for long MA
  tradeAmountUSD: 500,
};

const priceHistory = [];
let position = null; // null = no position, 'long' = holding

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

async function tick() {
  const price = await getPrice(CONFIG.coin);
  priceHistory.push(price);

  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${CONFIG.coin} = $${price.toFixed(2)}  (samples: ${priceHistory.length})`);

  if (priceHistory.length < CONFIG.longWindow) {
    console.log(`  Collecting data... need ${CONFIG.longWindow - priceHistory.length} more samples`);
    return;
  }

  // Keep history bounded
  if (priceHistory.length > CONFIG.longWindow * 2) {
    priceHistory.splice(0, priceHistory.length - CONFIG.longWindow * 2);
  }

  const shortMA = avg(priceHistory.slice(-CONFIG.shortWindow));
  const longMA = avg(priceHistory.slice(-CONFIG.longWindow));
  const spread = ((shortMA - longMA) / longMA * 100).toFixed(3);

  console.log(`  Short MA: $${shortMA.toFixed(2)} | Long MA: $${longMA.toFixed(2)} | Spread: ${spread}%`);

  const portfolio = loadPortfolio();

  // BUY signal: short MA crosses above long MA
  if (shortMA > longMA && position !== 'long') {
    if (portfolio.cashUSD >= CONFIG.tradeAmountUSD) {
      const buyPrice = await getBuyPrice(CONFIG.coin);
      const qty = CONFIG.tradeAmountUSD / buyPrice;

      portfolio.cashUSD -= CONFIG.tradeAmountUSD;
      portfolio.holdings[CONFIG.coin] = (portfolio.holdings[CONFIG.coin] || 0) + qty;
      portfolio.trades.push({
        type: 'BUY',
        coin: CONFIG.coin,
        qty,
        pricePerCoin: buyPrice,
        totalUSD: CONFIG.tradeAmountUSD,
        timestamp: new Date().toISOString(),
        signal: 'MA_CROSSOVER_UP'
      });
      savePortfolio(portfolio);
      position = 'long';
      console.log(`  >>> BUY SIGNAL: Bought ${qty.toFixed(8)} ${CONFIG.coin} @ $${buyPrice.toFixed(2)}`);
    } else {
      console.log(`  >>> BUY SIGNAL but insufficient cash ($${portfolio.cashUSD.toFixed(2)})`);
    }
  }

  // SELL signal: short MA crosses below long MA
  if (shortMA < longMA && position === 'long') {
    const held = portfolio.holdings[CONFIG.coin] || 0;
    if (held > 0) {
      const sellPrice = await getSellPrice(CONFIG.coin);
      const totalUSD = held * sellPrice;

      portfolio.cashUSD += totalUSD;
      delete portfolio.holdings[CONFIG.coin];
      portfolio.trades.push({
        type: 'SELL',
        coin: CONFIG.coin,
        qty: held,
        pricePerCoin: sellPrice,
        totalUSD,
        timestamp: new Date().toISOString(),
        signal: 'MA_CROSSOVER_DOWN'
      });
      savePortfolio(portfolio);
      position = null;
      console.log(`  >>> SELL SIGNAL: Sold ${held.toFixed(8)} ${CONFIG.coin} @ $${sellPrice.toFixed(2)} = $${totalUSD.toFixed(2)}`);
    }
  }
}

console.log(`
=== COINBASE PAPER TRADING BOT ===
Coin:       ${CONFIG.coin}
Strategy:   Moving Average Crossover (${CONFIG.shortWindow}/${CONFIG.longWindow})
Trade size: $${CONFIG.tradeAmountUSD}
Interval:   ${CONFIG.intervalSeconds}s
Starting cash: $${loadPortfolio().cashUSD.toFixed(2)}

This is PAPER TRADING only — no real money is used.
Press Ctrl+C to stop.
`);

// Run first tick immediately, then on interval
tick().catch(err => console.error('Error:', err.message));
setInterval(() => {
  tick().catch(err => console.error('Error:', err.message));
}, CONFIG.intervalSeconds * 1000);
