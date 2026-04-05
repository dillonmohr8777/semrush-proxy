const BASE_URL = 'https://api.coinbase.com/v2';
const DEMO_MODE = process.env.DEMO === '1';

// Demo prices for testing when Coinbase API is unreachable
const DEMO_PRICES = { BTC: 67357, ETH: 2069, SOL: 80.94, DOGE: 0.09, XRP: 1.32, ADA: 0.65 };

export async function getPrice(coin = 'BTC') {
  const symbol = coin.toUpperCase();
  if (DEMO_MODE) {
    const base = DEMO_PRICES[symbol] || 100;
    return base * (1 + (Math.random() - 0.5) * 0.02); // +/- 1% jitter
  }
  const res = await fetch(`${BASE_URL}/prices/${symbol}-USD/spot`);
  if (!res.ok) throw new Error(`Failed to fetch price for ${symbol}: ${res.statusText}`);
  const data = await res.json();
  return parseFloat(data.data.amount);
}

export async function getPrices(coins) {
  const results = {};
  await Promise.all(
    coins.map(async (coin) => {
      try {
        results[coin.toUpperCase()] = await getPrice(coin);
      } catch {
        results[coin.toUpperCase()] = null;
      }
    })
  );
  return results;
}

export async function getBuyPrice(coin = 'BTC') {
  const symbol = coin.toUpperCase();
  if (DEMO_MODE) return (await getPrice(symbol)) * 1.005; // 0.5% spread
  const res = await fetch(`${BASE_URL}/prices/${symbol}-USD/buy`);
  if (!res.ok) throw new Error(`Failed to fetch buy price for ${symbol}`);
  const data = await res.json();
  return parseFloat(data.data.amount);
}

export async function getSellPrice(coin = 'BTC') {
  const symbol = coin.toUpperCase();
  if (DEMO_MODE) return (await getPrice(symbol)) * 0.995; // 0.5% spread
  const res = await fetch(`${BASE_URL}/prices/${symbol}-USD/sell`);
  if (!res.ok) throw new Error(`Failed to fetch sell price for ${symbol}`);
  const data = await res.json();
  return parseFloat(data.data.amount);
}
