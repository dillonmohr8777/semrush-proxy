# Skill: Audit Client

## When to use
When asked to audit a client, review an account, or check what's going on with a specific client.

## Steps

1. **Read Memory File** - Load full context via `read_memory_file`
2. **Search Obsidian** - Search for previous audits and notes on this client via `search_notes`
3. **Google Ads Pull**
   - `list_campaigns` for the client's account
   - `search_terms` for the highest-spend campaign
   - `keyword_performance` to check Quality Scores
   - `conversion_actions` to verify tracking is firing
   - `ad_performance` to check for disapprovals
   - `location_performance` if the client is location-dependent
4. **Semrush Pull**
   - `domain_overview` for the client's domain
   - `domain_organic_keywords` - top 20 organic keywords
   - `domain_paid_keywords` - what they're bidding on
   - `competitor_domains` - who's competing
5. **WordPress Pull**
   - `list_pages` on the client's site
   - `search_content` for key services to check landing page coverage
6. **Cross-Reference**
   - Are there keywords with traffic but no landing page?
   - Are there ads pointing to generic pages instead of specific ones?
   - Are there high-spend search terms that should be negative keywords?
   - Is conversion tracking working?
   - Are there geographic leaks?
7. **Report**
   - Update client note in Obsidian with findings
   - Send `send_client_report` via Slack with the standard format
   - Log any patterns to Memory File via `update_memory_file`
8. **Log** - Call `log_session` with summary
