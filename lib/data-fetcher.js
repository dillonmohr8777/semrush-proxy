/**
 * Binance public API data fetcher for BTC/USDT
 * No API key required — uses public endpoints
 */

const BINANCE_BASE = 'https://api.binance.com/api/v3';

/**
 * Fetch OHLCV candles
 * @param {string} interval - '1m','5m','15m','1h','4h','1d'
 * @param {number} limit    - number of candles (max 1000)
 */
export async function fetchCandles(interval = '15m', limit = 100) {
  const url = `${BINANCE_BASE}/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines error: ${res.status}`);
  const raw  = await res.json();
  return raw.map(k => ({
    openTime:  k[0],
    open:      parseFloat(k[1]),
    high:      parseFloat(k[2]),
    low:       parseFloat(k[3]),
    close:     parseFloat(k[4]),
    volume:    parseFloat(k[5]),
    closeTime: k[6],
  }));
}

/**
 * Fetch order book snapshot
 * @param {number} limit - depth levels (5,10,20,50,100)
 */
export async function fetchOrderBook(limit = 20) {
  const url = `${BINANCE_BASE}/depth?symbol=BTCUSDT&limit=${limit}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Binance depth error: ${res.status}`);
  return res.json();
}

/**
 * Fetch recent aggregate trades
 */
export async function fetchRecentTrades(limit = 100) {
  const url = `${BINANCE_BASE}/trades?symbol=BTCUSDT&limit=${limit}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Binance trades error: ${res.status}`);
  return res.json();
}

/**
 * Fetch 24h ticker stats
 */
export async function fetch24hTicker() {
  const url = `${BINANCE_BASE}/ticker/24hr?symbol=BTCUSDT`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Binance ticker error: ${res.status}`);
  return res.json();
}

/**
 * Fetch all data concurrently
 */
export async function fetchAllMarketData(candleInterval = '15m') {
  const [candles1m, candles15m, candles1h, orderBook, recentTrades, ticker] =
    await Promise.all([
      fetchCandles('1m',  60),
      fetchCandles(candleInterval, 100),
      fetchCandles('1h',  50),
      fetchOrderBook(20),
      fetchRecentTrades(100),
      fetch24hTicker(),
    ]);

  return { candles1m, candles15m, candles1h, orderBook, recentTrades, ticker };
}
