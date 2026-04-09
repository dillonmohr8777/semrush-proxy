# Skill: Find Keyword Gaps

## When to use
When asked to find keyword gaps, competitive opportunities, or what competitors rank for that a client doesn't.

## Steps

1. **Read Memory File** - Load context via `read_memory_file`
2. **Search Obsidian** - Check for previous keyword research on this client
3. **Identify Competitors**
   - `competitor_domains` for the client's domain
   - Pick top 3-4 most relevant competitors (same geography, same services)
4. **Run Gap Analysis**
   - `keyword_gap` with client domain + competitor domains
   - `domain_organic_keywords` for each top competitor to see what they rank for
5. **Filter Opportunities**
   - Focus on keywords with commercial intent
   - Prioritize by: search volume, competition level, relevance to client services
   - Flag keywords where competitors rank in top 10 but client doesn't rank at all
6. **Check Landing Page Coverage**
   - `list_pages` on client's WordPress to see which keywords already have pages
   - Identify gaps: high-value keywords with no landing page
7. **Build Recommendations**
   - Priority keyword targets (quick wins: high volume, low competition)
   - Landing pages that should be built
   - Content clusters (groups of related keywords that could share a page)
8. **Report**
   - `send_client_report` via Slack
   - Save keyword research to `02_Campaigns/` in Obsidian
   - Update client note with opportunities
9. **Log** - Call `log_session`
