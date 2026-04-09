const fs = require('fs');
const path = require('path');

const domain = process.argv[2] || 'barcrawlusa.com';
const apiKey = process.argv[3] || process.env.SEMRUSH_API_KEY;
const database = process.argv[4] || 'us';
const limit = process.argv[5] || '500';

if (!apiKey) {
  console.error('Usage: node pull-keywords.js <domain> <api_key> [database] [limit]');
  console.error('   or: SEMRUSH_API_KEY=xxx node pull-keywords.js <domain>');
  console.error('');
  console.error('Example: node pull-keywords.js barcrawlusa.com YOUR_KEY us 500');
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'data');

const params = new URLSearchParams({
  type: 'domain_organic',
  key: apiKey,
  display_limit: limit,
  export_columns: 'Ph,Po,Nq,Cp,Ur,Co,Td',
  domain: domain,
  database: database
});

const url = `https://api.semrush.com/?${params}`;

async function pull() {
  console.log(`Pulling organic keywords for ${domain} (db=${database}, limit=${limit})...`);
  const res = await fetch(url);
  const text = await res.text();

  if (text.startsWith('ERROR')) {
    console.error(`Semrush API error: ${text}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${domain.replace(/\./g, '_')}_keywords.csv`);
  fs.writeFileSync(outFile, text);

  const lines = text.trim().split('\n');
  console.log(`Saved ${lines.length - 1} keywords to ${outFile}`);
}

pull().catch(err => {
  console.error(err);
  process.exit(1);
});
