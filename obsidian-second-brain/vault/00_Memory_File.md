# Memory File - Dillon OS

> This is the master context file. Claude reads this at the start of every session.
> Update this regularly. The more complete this is, the better Claude performs.

## Who I Am
- Name: Dillon Mohr
- Role: Marketing operator / agency owner
- Business: Managing Google Ads, SEO, and landing pages for multiple clients
- Style: Direct, execution-focused, results-oriented
- Communication: Keep it concise. Lead with the action. Skip the fluff.

## How I Work
- I want Claude to operate like a senior marketing employee, not a chatbot
- I care about: revenue impact, speed, and compounding improvements
- I don't want: generic advice, over-explained reasoning, or hand-holding
- When in doubt: draft it, notify me, and move on to the next thing
- I review and approve in batches - stack up draft work and send me a summary

## My Business
- I run paid search (Google Ads) and landing page optimization for local/regional businesses
- I use Semrush for keyword research and competitive analysis
- WordPress is the primary CMS for client sites
- I track everything in Obsidian and communicate via Slack

## Active Clients

### Hardwood Artisan
- Industry: Hardwood flooring
- Services: Installation, refinishing, repair
- Geography: [FILL IN]
- Website: [FILL IN]
- Google Ads Account ID: [FILL IN]
- Status: Active
- Notes:

### Omega Landscape
- Industry: Landscaping
- Services: Retaining walls, French drains, hardscaping, lawn care
- Geography: Pittsburgh area
- Website: [FILL IN]
- Google Ads Account ID: [FILL IN]
- Status: Active
- Notes:

### NKCDC
- Industry: Community development
- Services: [FILL IN]
- Geography: [FILL IN]
- Website: [FILL IN]
- Google Ads Account ID: [FILL IN]
- Status: Active
- Notes:

### Bar Crawl USA
- Industry: Events / entertainment
- Services: Bar crawl events
- Geography: Chattanooga + other cities
- Website: [FILL IN]
- Google Ads Account ID: [FILL IN]
- Status: Active
- Notes:

### KJB
- Industry: [FILL IN]
- Services: [FILL IN]
- Geography: [FILL IN]
- Website: [FILL IN]
- Google Ads Account ID: [FILL IN]
- Status: Active
- Notes:

## My Processes
- New client onboarding: Audit Google Ads → Pull Semrush data → Inventory WordPress pages → Identify gaps → Draft improvements → Notify in Slack
- Weekly: Review all client campaigns, check for waste, update notes
- Monthly: Full audit per client, keyword gap analysis, landing page opportunities
- When I say "audit": Run the full workflow (Ads + Semrush + WordPress + Slack + Obsidian)

## My Preferences
- Landing pages: Conversion-focused, no fluff, real CTAs, match ad intent to page intent
- Ad copy: Direct, benefit-driven, no generic AI-sounding copy
- Reports: Structured format (Client / System / Status / Found / Changed / Needs Approval / Next Move)
- When something is broken: Tell me immediately via Slack urgent alert
- When something is a quick win: Just do it (if allowed by current mode) and tell me after

## Patterns and Learnings
> This section grows over time. Claude should add entries here when it discovers recurring patterns, successful strategies, or important lessons.

-

## Routing Rules
> These rules tell Claude WHERE to save different types of information in the vault.

- Meeting notes → `01_Clients/Meetings/` using meeting template
- Action items → `01_Clients/[Client Name].md` under "## Next Actions"
- Decisions → `01_Clients/[Client Name].md` under "## Notes" with date prefix
- Campaign insights → `02_Campaigns/[Campaign Name].md`
- Content ideas → `03_Content/` using content-idea template
- New SOPs discovered → `04_SOPs/` using sop template
- Session summaries → `07_Daily_Notes/[YYYY-MM-DD].md` appended under "## Notes"
- Audit results → `01_Clients/[Client Name].md` under "## Notes" AND Slack notification
- Reusable learnings → This file, under "## Patterns and Learnings"
- Errors/issues → Slack urgent alert + `01_Clients/[Client Name].md` under "## Notes"
