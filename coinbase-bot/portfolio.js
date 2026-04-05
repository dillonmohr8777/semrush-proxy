import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'portfolio-data.json');

const DEFAULT_PORTFOLIO = {
  cashUSD: 10000.00,
  holdings: {},
  trades: [],
  createdAt: new Date().toISOString()
};

export function loadPortfolio() {
  if (!existsSync(DATA_FILE)) {
    savePortfolio(DEFAULT_PORTFOLIO);
    return { ...DEFAULT_PORTFOLIO };
  }
  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
}

export function savePortfolio(portfolio) {
  writeFileSync(DATA_FILE, JSON.stringify(portfolio, null, 2));
}

export function resetPortfolio() {
  const fresh = { ...DEFAULT_PORTFOLIO, createdAt: new Date().toISOString() };
  savePortfolio(fresh);
  return fresh;
}
