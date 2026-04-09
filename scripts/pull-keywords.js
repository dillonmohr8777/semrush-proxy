const domain = process.argv[2] || 'barcrawlusa.com';
const apiKey = process.argv[3] || process.env.SEMRUSH_API_KEY;

if (!apiKey) {
  console.error('Usage: node pull-keywords.js <domain> <api_key>');
  console.error('   or: SEMRUSH_API_KEY=xxx node pull-keywords.js <domain>');
  process.exit(1);
}

const params = new URLSearchParams({
  type: 'domain_organic',
  key: apiKey,
  display_limit: '500',
  export_columns: 'Ph,Po,Nq,Cp,Ur,Co,Td',
  domain: domain,
  database: 'us'
});

const url = `https://api.semrush.com/?${params}`;

async function pull() {
  console.error(`Pulling organic keywords for ${domain}...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`API error: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.error(body);
    process.exit(1);
  }
  const text = await res.text();
  if (text.startsWith('ERROR')) {
    console.error(`Semrush error: ${text}`);
    process.exit(1);
  }
  const fs = require('fs');
  const path = require('path');
  const outDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${domain.replace(/\./g, '_')}_keywords.csv`);
  fs.writeFileSync(outFile, text);
  const lines = text.trim().split('\n');
  console.error(`Saved ${lines.length - 1} keywords to ${outFile}`);
  console.log(text);
}

pull().catch(err => {
  console.error(err);
  process.exit(1);
});
