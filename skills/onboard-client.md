# Skill: Onboard Client

## When to use
When a new client is added, when asked to set up or onboard a client.

## Steps

1. **Read Memory File** - Load context via `read_memory_file`
2. **Create Client Note**
   - `create_from_template` using client template
   - Fill in everything known: industry, services, geography, website, account IDs
3. **Initial Audit**
   - Run the full audit-client skill (read skills/audit-client.md)
4. **Keyword Baseline**
   - `domain_overview` for their domain
   - `domain_organic_keywords` - what they currently rank for
   - `domain_paid_keywords` - what they're currently bidding on
   - `competitor_domains` - who they're up against
5. **WordPress Inventory**
   - `list_pages` - full page inventory
   - Note which services have pages and which don't
6. **Identify Quick Wins**
   - Landing pages that should exist but don't
   - Keywords with easy ranking potential
   - Google Ads waste that can be cut immediately
   - Tracking issues that need fixing
7. **Build Onboarding Report**
   - Client overview with current state
   - Top 3 immediate opportunities
   - Top 3 risks or problems
   - Recommended first actions
8. **Notify and Log**
   - `send_client_report` via Slack
   - Update Memory File with new client context
   - `log_session`
