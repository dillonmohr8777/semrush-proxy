# Skill: Review Search Terms

## When to use
When asked to review, clean up, or analyze search terms for a campaign or client.

## Steps

1. **Read Memory File** - Load context via `read_memory_file`
2. **Search Obsidian** - Check for previous search term reviews for this client
3. **Pull Search Terms**
   - `search_terms` for the specified campaign (LAST_30_DAYS)
   - If no campaign specified, `list_campaigns` first to find highest-spend campaigns
4. **Analyze**
   - Flag irrelevant search terms (no commercial intent, wrong service, wrong location)
   - Flag high-cost zero-conversion terms
   - Flag terms that suggest landing page gaps (specific services without matching pages)
   - Identify new keyword opportunities from converting terms
   - Check for brand term waste
5. **Cross-Reference with Semrush**
   - `keyword_overview` on promising search terms to validate opportunity
6. **Build Recommendations**
   - Negative keyword list (grouped by theme)
   - New keyword opportunities
   - Landing page gaps
7. **Report**
   - `send_client_report` via Slack with findings and recommendations
   - Update client note in Obsidian
   - Log patterns to Memory File (e.g., "Bar Crawl USA consistently gets 'pub crawl' terms - evaluate if worth targeting")
8. **Log** - Call `log_session`
