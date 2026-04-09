# Autonomous Marketing Operator - Setup Guide

## Architecture

```
Claude Code (orchestration brain)
    │
    ├── Semrush MCP ──────── Semrush API (SEO, keywords, competitors)
    ├── Google Ads MCP ───── Google Ads API (campaigns, search terms, performance)
    ├── WordPress MCP ────── WordPress REST API (pages, posts, drafts)
    ├── Slack MCP ─────────── Slack API (notifications, approvals)
    └── Obsidian MCP ──────── Obsidian Local REST API (memory, notes, logs)
```

## Quick Start

### 1. Install Dependencies

```bash
cd mcp-servers/semrush && npm install
cd ../google-ads && npm install
cd ../wordpress && npm install
cd ../slack && npm install
cd ../../obsidian-second-brain/mcp-server && npm install
```

### 2. Configure Each Connector

Copy `mcp-config.json` into your Claude Code settings (`~/.claude/settings.json`) and fill in the credentials for each service.

---

## Connector Setup Details

### Semrush

**What you need:** Semrush API key

1. Go to Semrush → Settings → API
2. Copy your API key
3. Set `SEMRUSH_API_KEY` in the config

**Available tools (10):**
- `domain_overview` - High-level domain SEO/PPC stats
- `domain_organic_keywords` - Top organic keywords
- `domain_paid_keywords` - Keywords being bid on in Google Ads
- `keyword_overview` - Volume, CPC, competition for a keyword
- `keyword_ideas` - Related keyword suggestions
- `keyword_questions` - Question-based keyword ideas
- `competitor_domains` - Find organic competitors
- `keyword_gap` - Keywords competitors rank for that you don't
- `backlinks` - Backlink profile data
- `url_organic_keywords` - Keywords for a specific landing page URL

---

### Google Ads

**What you need:** OAuth2 credentials + Developer Token

1. Create a Google Cloud project at console.cloud.google.com
2. Enable the Google Ads API
3. Create OAuth2 credentials (Desktop app type)
4. Get a developer token from your Google Ads MCC account
5. Generate a refresh token using the OAuth2 flow

```
GOOGLE_ADS_CLIENT_ID=       # OAuth2 client ID
GOOGLE_ADS_CLIENT_SECRET=   # OAuth2 client secret
GOOGLE_ADS_DEVELOPER_TOKEN= # From Google Ads MCC → Tools → API Center
GOOGLE_ADS_REFRESH_TOKEN=   # Generated via OAuth2 consent flow
GOOGLE_ADS_LOGIN_CUSTOMER_ID= # Your MCC account ID (no dashes)
```

**Available tools (11):**
- `list_accounts` - List all client accounts under MCC
- `list_campaigns` - All campaigns with performance data
- `campaign_performance` - Daily performance for a campaign
- `ad_group_performance` - Ad group breakdown
- `search_terms` - Search terms triggering ads (find waste)
- `keyword_performance` - Keyword stats + Quality Score
- `ad_performance` - Ad copy performance + approval status
- `location_performance` - Geographic performance data
- `conversion_actions` - Conversion tracking setup/status
- `account_performance` - Account-level daily summary
- `custom_query` - Run any GAQL SELECT query

**V1 Mode:** Read-only. The custom_query tool blocks any non-SELECT queries.

---

### WordPress

**What you need:** WordPress application password (per site)

1. In WordPress admin: Users → Your Profile → Application Passwords
2. Create a new application password
3. Save the generated password

Supports multiple sites via JSON config:

```json
WORDPRESS_SITES=[
  {"name":"hardwood-artisan","url":"https://hardwoodartisan.com","username":"admin","app_password":"xxxx xxxx xxxx xxxx"},
  {"name":"omega-landscape","url":"https://omegalandscape.com","username":"admin","app_password":"xxxx xxxx xxxx xxxx"}
]
```

Or single site:
```
WORDPRESS_URL=https://example.com
WORDPRESS_USERNAME=admin
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

**Available tools (8):**
- `list_sites` - Show configured WordPress sites
- `list_pages` - All pages with status, URL, modified date
- `get_page` - Full page content (raw HTML)
- `create_draft_page` - Create new page as DRAFT (never publishes)
- `update_draft_page` - Update existing page (cannot publish)
- `list_posts` - Blog post inventory
- `get_post` - Full post content
- `search_content` - Search across pages and posts

**V1 Mode:** Draft-only. The server blocks any attempt to set status to "publish".

---

### Slack

**What you need:** Slack Bot Token

1. Go to api.slack.com/apps → Create New App
2. Add Bot Token Scopes: `chat:write`, `channels:read`, `groups:read`
3. Install to workspace
4. Copy the Bot User OAuth Token (`xoxb-...`)
5. Invite the bot to your channels

```
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_DEFAULT_CHANNEL=marketing-ops
SLACK_APPROVAL_CHANNEL=marketing-approvals
```

**Available tools (6):**
- `send_client_report` - Structured report (client/system/status/found/changed/approval/next)
- `send_urgent_alert` - Critical issue alert
- `send_message` - Simple text message
- `send_approval_request` - Approval with Approve/Reject buttons
- `send_daily_summary` - Morning summary across all clients
- `list_channels` - See available channels

---

### Obsidian

**What you need:** Obsidian + Local REST API plugin

1. Install Obsidian, create vault
2. Install "Local REST API" community plugin
3. Copy API key from plugin settings

```
OBSIDIAN_API_URL=https://127.0.0.1:27124
OBSIDIAN_API_KEY=your-key
```

**Available tools (11):**
- `read_note`, `write_note`, `append_to_note`, `replace_note`
- `search_notes`, `list_notes`, `delete_note`
- `create_from_template` (client, meeting, content-idea, daily-note, campaign, sop, offer)
- `get_active_note`, `process_inbox`, `daily_note`

---

## Staging Plan

### V1 - Observe + Draft (NOW)
- Read from Google Ads, Semrush, WordPress
- Audit everything, send Slack summaries
- Draft landing pages in WordPress (never publish)
- Log everything to Obsidian
- No live changes anywhere

### V2 - Draft Creation
- Create WordPress pages in draft
- Generate ad copy suggestions
- Build keyword plans
- Log action plans in Obsidian

### V3 - Constrained Execution
- Push safe Google Ads updates (negative keywords, bid adjustments)
- Route risky actions to Slack for approval
- Still no direct publishing

### V4 - Scheduled Autonomy
- Nightly audits per client
- Weekly landing page opportunity scans
- Slack alerts for broken tracking
- Auto-generated keyword gap reports from Semrush
- Draft page suggestions from WordPress inventory

---

## Example Commands

```
"Audit Hardwood Artisan's Google Ads account"
"Find keyword gaps for NKCDC"
"Review Bar Crawl USA Chattanooga search terms"
"Build a landing page for Omega Landscape retaining walls Pittsburgh"
"Draft KJB timeline page update and notify in Slack"
"What's broken across all clients today?"
"Send me a daily summary"
```

---

## Total Tool Count: 46

| System | Tools | Mode |
|--------|-------|------|
| Semrush | 10 | Read-only |
| Google Ads | 11 | Read-only (SELECT only) |
| WordPress | 8 | Draft-only (no publish) |
| Slack | 6 | Send notifications |
| Obsidian | 11 | Full read/write |
