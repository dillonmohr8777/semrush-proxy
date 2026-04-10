require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const TOKENS_PATH = path.join(__dirname, '..', 'tokens.json');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Scopes for Google Ads + Google Business Profile
const SCOPES = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/business.manage',
];

// Load saved tokens if they exist
function loadTokens() {
  if (fs.existsSync(TOKENS_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    oauth2Client.setCredentials(tokens);
    console.log('Loaded saved tokens.');
    return true;
  }
  return false;
}

// Save tokens to file
function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  console.log('Tokens saved to tokens.json');
}

// Auto-refresh tokens when they expire
oauth2Client.on('tokens', (tokens) => {
  if (tokens.refresh_token) {
    const existing = fs.existsSync(TOKENS_PATH)
      ? JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'))
      : {};
    saveTokens({ ...existing, ...tokens });
  }
});

// Step 1: Redirect to Google consent screen
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
  res.redirect(authUrl);
});

// Step 2: Handle callback from Google
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    saveTokens(tokens);
    res.send(`
      <h1>Authorization successful!</h1>
      <p>Tokens saved. You can close this window.</p>
      <p>Access token expires: ${new Date(tokens.expiry_date).toLocaleString()}</p>
    `);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// Status check
app.get('/status', (req, res) => {
  const hasTokens = fs.existsSync(TOKENS_PATH);
  const tokens = hasTokens ? JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8')) : null;
  res.json({
    authenticated: hasTokens,
    expires: tokens ? new Date(tokens.expiry_date).toLocaleString() : null,
    scopes: SCOPES,
  });
});

// Google Business Profile: List accounts
app.get('/gbp/accounts', async (req, res) => {
  try {
    loadTokens();
    const mybusiness = google.mybusinessbusinessinformation({ version: 'v1', auth: oauth2Client });
    const response = await mybusiness.accounts.list();
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Google Business Profile: List locations for an account
app.get('/gbp/locations/:accountId', async (req, res) => {
  try {
    loadTokens();
    const mybusiness = google.mybusinessbusinessinformation({ version: 'v1', auth: oauth2Client });
    const response = await mybusiness.accounts.locations.list({
      parent: `accounts/${req.params.accountId}`,
      readMask: 'name,title,storefrontAddress',
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  const hasTokens = loadTokens();
  console.log(`\nGoogle OAuth Server running on http://localhost:${PORT}`);
  console.log(`Status: http://localhost:${PORT}/status`);
  if (!hasTokens) {
    console.log(`\nNo tokens found. Authorize here: http://localhost:${PORT}/auth`);
  } else {
    console.log('Authenticated and ready.');
  }
});
