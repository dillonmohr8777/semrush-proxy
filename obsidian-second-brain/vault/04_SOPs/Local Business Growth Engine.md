# SOP: Local Business Growth Engine

## Purpose
Repeatable system for growing a local service business from "just running ads" to a compounding marketing machine. Covers Google Ads, SEO, landing pages, and automation. Designed to be run quarterly as a full cycle, with monthly check-ins on each pillar.

## When to Use
- New client onboarding (after initial audit)
- Quarterly growth planning for any local/regional service business
- When a client is stalled and needs a structured path to more revenue
- When expanding services or geography for an existing client

## The 5 Pillars

### Pillar 1: Foundation Audit
**Goal:** Know exactly where the client stands before making moves.

1. Pull Google Ads data: campaigns, search terms, keyword performance, conversion tracking, location targeting
2. Pull Semrush data: domain overview, organic keywords, paid keywords, competitor domains
3. Inventory WordPress pages: which services have dedicated landing pages, which don't
4. Check Google Business Profile: postings, reviews, categories, service area
5. Cross-reference: identify gaps between what the client offers and what's visible online

**Output:** Audit summary in client note + Slack notification

### Pillar 2: Keyword & Competitor Intelligence
**Goal:** Find where the money is hiding.

1. Run `keyword_overview` for each core service + geography (e.g., "retaining walls Pittsburgh")
2. Run `keyword_ideas` to expand the keyword map
3. Run `keyword_questions` for FAQ/content opportunities
4. Run `competitor_domains` to see who's winning and why
5. Run `keyword_gap` analysis vs. top 3 competitors
6. Map every keyword to: existing page, needed page, or blog opportunity

**Output:** Keyword map saved to `02_Campaigns/` + gaps flagged

### Pillar 3: Landing Page Engine
**Goal:** Every service + geo combination has a conversion-focused page.

1. For each gap identified in Pillar 2, draft a landing page:
   - Headline matching search intent
   - Service description with local specifics
   - Trust signals (reviews, credentials, years in business)
   - FAQ section from keyword questions
   - Strong CTA (call, form, or both)
2. Create as WordPress drafts (NEVER publish directly)
3. Link landing pages to corresponding ad groups
4. Track in campaign log

**Output:** Draft pages in WordPress + notification for review

### Pillar 4: Google Ads Optimization
**Goal:** Stop waste, improve quality, drive conversions.

1. Review search terms: negative out irrelevant queries, add high-intent terms as keywords
2. Check Quality Scores: improve ad relevance and landing page experience
3. Verify conversion tracking: make sure calls, forms, and actions are firing
4. Check geographic targeting: no budget leaking to wrong areas
5. Review ad copy: test new variants, pause underperformers
6. Structure: ensure each service has its own ad group with matched landing page

**Output:** Optimization recommendations + Slack report

### Pillar 5: Growth Compounding
**Goal:** Build systems that generate leads without more ad spend.

1. Google Business Profile optimization: weekly posts, review response, photo updates
2. Review generation system: post-service follow-up requesting reviews
3. Content/SEO: monthly blog posts targeting long-tail keywords from Pillar 2
4. Retargeting: Meta pixel on landing pages for remarketing
5. Email/SMS reactivation: quarterly reach-out to past customers
6. Referral system: structured ask for referrals after positive reviews

**Output:** Automation recommendations in client note

## Execution Cadence

| Frequency | Action |
|---|---|
| Week 1 | Run Pillar 1 (Audit) + Pillar 2 (Keywords) |
| Week 2-3 | Execute Pillar 3 (Landing Pages) + Pillar 4 (Ads) |
| Week 4 | Pillar 5 (Growth Systems) + Monthly Report |
| Monthly | Quick audit check, search term review, content publish |
| Quarterly | Full cycle restart - re-run all 5 pillars |

## Tools Needed
- Google Ads MCP (campaigns, search terms, keywords, conversions, locations)
- Semrush MCP (domain overview, keywords, competitors, gaps)
- WordPress MCP (pages, drafts, content search)
- Obsidian MCP (client notes, campaign logs, memory file)
- Slack MCP (notifications, reports, approvals)

## Success Metrics
- Cost per lead trending down
- Number of service-specific landing pages increasing
- Organic keyword rankings improving
- Google Ads Quality Scores above 7
- Review count and rating growing
- Wasted ad spend decreasing month-over-month

## Notes
- This SOP is recursive: each quarterly run builds on the last
- Always check Obsidian for previous findings before re-auditing
- Log every pattern to the Memory File so the system compounds
- This works for ANY local service business - adjust pillar emphasis based on client maturity

## Last Updated
2026-04-10
