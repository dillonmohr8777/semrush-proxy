import { loadPortfolio, savePortfolio, resetPortfolio } from './portfolio.js';
import { getPrice, getBuyPrice, getSellPrice, getPrices } from './coinbase.js';

const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

async function buy(coin, amountUSD) {
  const portfolio = loadPortfolio();
  coin = coin.toUpperCase();

  if (amountUSD > portfolio.cashUSD) {
    console.log(`Insufficient funds. You have $${portfolio.cashUSD.toFixed(2)} but tried to spend $${amountUSD.toFixed(2)}`);
    return;
  }

  const price = await getBuyPrice(coin);
  const qty = amountUSD / price;

  portfolio.cashUSD -= amountUSD;
  portfolio.holdings[coin] = (portfolio.holdings[coin] || 0) + qty;
  portfolio.trades.push({
    type: 'BUY',
    coin,
    qty,
    pricePerCoin: price,
    totalUSD: amountUSD,
    timestamp: new Date().toISOString()
  });

  savePortfolio(portfolio);
  console.log(`BUY  ${qty.toFixed(8)} ${coin} @ $${price.toFixed(2)} = $${amountUSD.toFixed(2)}`);
  console.log(`     Cash remaining: $${portfolio.cashUSD.toFixed(2)}`);
}

async function sell(coin, qty) {
  const portfolio = loadPortfolio();
  coin = coin.toUpperCase();

  const held = portfolio.holdings[coin] || 0;
  if (qty > held) {
    console.log(`Insufficient ${coin}. You hold ${held.toFixed(8)} but tried to sell ${qty.toFixed(8)}`);
    return;
  }

  const price = await getSellPrice(coin);
  const totalUSD = qty * price;

  portfolio.cashUSD += totalUSD;
  portfolio.holdings[coin] -= qty;
  if (portfolio.holdings[coin] < 0.00000001) delete portfolio.holdings[coin];

  portfolio.trades.push({
    type: 'SELL',
    coin,
    qty,
    pricePerCoin: price,
    totalUSD,
    timestamp: new Date().toISOString()
  });

  savePortfolio(portfolio);
  console.log(`SELL ${qty.toFixed(8)} ${coin} @ $${price.toFixed(2)} = $${totalUSD.toFixed(2)}`);
  console.log(`     Cash balance: $${portfolio.cashUSD.toFixed(2)}`);
}

async function sellAll(coin) {
  const portfolio = loadPortfolio();
  coin = coin.toUpperCase();
  const held = portfolio.holdings[coin] || 0;
  if (held <= 0) {
    console.log(`You don't hold any ${coin}`);
    return;
  }
  await sell(coin, held);
}

async function status() {
  const portfolio = loadPortfolio();
  const coins = Object.keys(portfolio.holdings);

  console.log('=== PAPER TRADING PORTFOLIO ===');
  console.log(`Started: ${portfolio.createdAt}`);
  console.log(`Cash:    $${portfolio.cashUSD.toFixed(2)}`);
  console.log('');

  if (coins.length === 0) {
    console.log('No crypto holdings.');
    console.log(`Total value: $${portfolio.cashUSD.toFixed(2)}`);
    return;
  }

  const prices = await getPrices(coins);
  let totalValue = portfolio.cashUSD;

  console.log('Holdings:');
  for (const coin of coins) {
    const qty = portfolio.holdings[coin];
    const price = prices[coin];
    if (price) {
      const value = qty * price;
      totalValue += value;
      console.log(`  ${coin}: ${qty.toFixed(8)} x $${price.toFixed(2)} = $${value.toFixed(2)}`);
    } else {
      console.log(`  ${coin}: ${qty.toFixed(8)} (price unavailable)`);
    }
  }

  console.log('');
  console.log(`Total portfolio value: $${totalValue.toFixed(2)}`);
  console.log(`P&L: $${(totalValue - 10000).toFixed(2)} (${((totalValue / 10000 - 1) * 100).toFixed(2)}%)`);
}

function history() {
  const portfolio = loadPortfolio();

  if (portfolio.trades.length === 0) {
    console.log('No trades yet.');
    return;
  }

  console.log('=== TRADE HISTORY ===');
  for (const t of portfolio.trades) {
    const date = new Date(t.timestamp).toLocaleString();
    console.log(`${date}  ${t.type}  ${t.qty.toFixed(8)} ${t.coin} @ $${t.pricePerCoin.toFixed(2)}  ($${t.totalUSD.toFixed(2)})`);
  }
  console.log(`Total trades: ${portfolio.trades.length}`);
}

async function price(coin) {
  coin = coin.toUpperCase();
  const p = await getPrice(coin);
  console.log(`${coin}: $${p.toFixed(2)}`);
}

function help() {
  console.log(`
Coinbase Paper Trader - Trade with $10,000 fake money using real market prices

Commands:
  node trade.js buy <COIN> <USD_AMOUNT>   Buy crypto with fake USD
  node trade.js sell <COIN> <QTY>         Sell a specific quantity
  node trade.js sellall <COIN>            Sell entire holding of a coin
  node trade.js status                    View portfolio & P/L
  node trade.js history                   View trade history
  node trade.js price <COIN>             Check current price
  node trade.js reset                     Reset portfolio to $10,000

Examples:
  node trade.js buy BTC 1000              Buy $1000 worth of Bitcoin
  node trade.js buy ETH 500               Buy $500 worth of Ethereum
  node trade.js sell BTC 0.005            Sell 0.005 BTC
  node trade.js sellall ETH               Sell all Ethereum
  node trade.js price SOL                 Check Solana price
`);
}

try {
  switch (command) {
    case 'buy':
      if (!args[1] || !args[2]) { console.log('Usage: node trade.js buy <COIN> <USD_AMOUNT>'); break; }
      await buy(args[1], parseFloat(args[2]));
      break;
    case 'sell':
      if (!args[1] || !args[2]) { console.log('Usage: node trade.js sell <COIN> <QTY>'); break; }
      await sell(args[1], parseFloat(args[2]));
      break;
    case 'sellall':
      if (!args[1]) { console.log('Usage: node trade.js sellall <COIN>'); break; }
      await sellAll(args[1]);
      break;
    case 'status':
      await status();
      break;
    case 'history':
      history();
      break;
    case 'price':
      if (!args[1]) { console.log('Usage: node trade.js price <COIN>'); break; }
      await price(args[1]);
      break;
    case 'reset':
      resetPortfolio();
      console.log('Portfolio reset to $10,000.00');
      break;
    default:
      help();
  }
} catch (err) {
  console.error('Error:', err.message);
}
