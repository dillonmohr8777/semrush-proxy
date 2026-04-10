# Dillon's AI Marketing Brain

## What It Is

An AI system that manages 27+ marketing clients across Google Ads, Meta Ads, SEO, and WordPress - with a memory that gets smarter every week.

## The Stack

```
Claude (AI brain)
  ├── Google Ads  → reads campaigns, finds waste, checks tracking
  ├── Meta Ads    → reads Facebook/Instagram ads, pixels, audiences
  ├── Semrush     → keyword research, competitor gaps, SEO data
  ├── WordPress   → reads/drafts landing pages across client sites
  ├── Slack       → sends reports, alerts, approval requests
  └── Obsidian    → long-term memory that never forgets
```

## How It Works

Dillon says one sentence. The system does the rest.

**"Audit Bar Crawl USA"** →
- Pulls Google Ads performance, search terms, Quality Scores
- Pulls Semrush keyword data and competitor gaps
- Checks WordPress for missing landing pages
- Sends a structured report to Slack
- Logs everything to Obsidian so it remembers next time

**"Process these meeting notes"** →
- Structures raw notes into summary, action items, decisions
- Updates the client's note in Obsidian
- Flags anything urgent via Slack
- Every call becomes searchable context forever

**"Build a landing page for retaining walls Pittsburgh"** →
- Pulls keyword data from Semrush
- Checks existing pages on WordPress
- Drafts a conversion-focused page (never publishes without approval)
- Sends the draft link via Slack

## The Memory File

This is what makes it different from ChatGPT. There's one master file Claude reads before every session:

```markdown
# Memory File - Dillon OS

## Who I Am
- Name: Dillon Mohr
- Role: Marketing operator managing 27+ clients

## Clients
### Bar Crawl USA
- Commission: $950/mo
- Google Ads ID: 435-710-2897
- Work I do: Google Ads, landing pages, on-page SEO

### Shadow HVAC
- Commission: $250/mo
- Google Ads ID: 314-136-4176
- Work I do: Google Ads + GMB postings

... (every client listed with full context)

## Patterns and Learnings
- [2026-04-10] Bar Crawl USA scales across 10+ cities - needs templated systems
- [2026-04-15] Landing pages with FAQ sections convert better for Omega
- [2026-04-22] NKCDC search terms always include "Philadelphia"
```

**Week 1:** Claude knows the basics.
**Week 4:** Claude knows campaigns, pain points, and history.
**Week 8:** Claude catches things Dillon missed. Remembers commitments from old calls. Connects patterns across clients.

## The Code (simplified)

The Obsidian MCP server - this is what lets Claude read/write to the vault:

```javascript
// Claude says "read the memory file" → this runs
async function readNote(path) {
  const response = await fetch(`${OBSIDIAN_API}/vault/${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` }
  });
  return response.text();
}

// Claude says "log this session" → this runs
async function writeNote(path, content) {
  await fetch(`${OBSIDIAN_API}/vault/${path}`, {
    method: "PUT",
    body: content
  });
}

// Claude says "search for Bar Crawl USA" → this runs
async function searchNotes(query) {
  return fetch(`${OBSIDIAN_API}/search/?query=${query}`);
}
```

67 tools total across 6 connected systems. All read-only or draft-only right now - nothing goes live without Dillon's approval.

## Skills (On-Demand Workflows)

Instead of loading everything into memory every time, workflows load only when needed:

```
/skills
  ├── audit-client.md          → Full cross-system audit
  ├── audit-meta-ads.md        → Facebook/Instagram audit
  ├── optimize-google-ads.md   → Fix tracking, search terms, Quality Score
  ├── build-landing-page.md    → Draft conversion pages from keyword data
  ├── install-tracking.md      → Meta Pixel + Google Ads tag setup
  ├── review-search-terms.md   → Find wasted ad spend
  ├── find-keyword-gaps.md     → What competitors rank for that you don't
  ├── weekly-review.md         → Cross-client weekly summary
  ├── process-transcript.md    → Structure meeting notes automatically
  ├── onboard-client.md        → New client setup
  └── daily-summary.md         → Morning briefing
```

## Why It Compounds

Every session leaves a trace. Every meeting gets logged. Every pattern gets saved. The vault grows passively. By month 2, the AI knows more about Dillon's clients than most employees would after 6 months - because it never forgets anything.

It's not a chatbot. It's a marketing employee with perfect memory.
