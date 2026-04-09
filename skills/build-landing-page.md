# Skill: Build Landing Page

## When to use
When asked to build, draft, or create a landing page for a client service or keyword target.

## Steps

1. **Read Memory File** - Load context via `read_memory_file`
2. **Search Obsidian** - Check if a page or recommendation for this already exists
3. **Keyword Research**
   - `keyword_overview` for the target keyword
   - `keyword_ideas` for related terms to include
   - `keyword_questions` for FAQ section content
4. **Check Existing Pages**
   - `search_content` on the client's WordPress site for similar pages
   - `list_pages` to see full inventory
   - If a page exists, `get_page` to review current content
5. **Check Ad Alignment**
   - `domain_paid_keywords` to see what ads exist for this service
   - Match page intent to ad intent
6. **Draft the Page**
   - Build conversion-focused HTML content
   - Match the client's geography, services, tone, and offers
   - Include: headline, subheadline, service description, benefits, social proof/trust signals, FAQ from keyword questions, strong CTA
   - No generic AI copy - use the client's actual differentiators
7. **Create in WordPress**
   - `create_draft_page` with the content (ALWAYS draft, never publish)
   - Return the edit link to me
8. **Notify**
   - `send_client_report` via Slack: draft ready, edit link, what keywords it targets
9. **Log**
   - Update client note in Obsidian with the new page draft
   - `log_session` with summary
