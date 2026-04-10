# Skill: Book SEO Audit

## When to use
When asked to audit the book's website, check SEO health, or find ranking opportunities for The Ironic Ineptocracy.

## Steps

1. **Read Command Center**
   - Read `ironic-ineptocracy-vault/00-Command-Center/Dashboard.md`
   - Read `ironic-ineptocracy-vault/00-Command-Center/Operating Rules.md`

2. **Technical Audit**
   - `list_pages` on ironicineptocracy.com
   - Check each key page for: title tag, meta description, H1, word count, internal links
   - Cross-reference against `ironic-ineptocracy-vault/06-SEO/On-Page SEO Rules.md`

3. **Keyword Performance Check**
   - `domain_overview` for ironicineptocracy.com
   - `domain_organic_keywords` to see current rankings
   - `url_organic_keywords` on key pages (homepage, about, book page)

4. **Content Gap Analysis**
   - Compare published pages against `ironic-ineptocracy-vault/06-SEO/Keyword Clusters.md`
   - Identify keyword targets with no corresponding page
   - Check for thin content (pages under 300 words)
   - Check for cannibalization (multiple pages targeting same keyword)

5. **Competitor Check**
   - `competitor_domains` for ironicineptocracy.com
   - `keyword_gap` against top 3 competitors
   - Note keywords competitors rank for that we don't

6. **Internal Linking Audit**
   - Check for orphan pages
   - Verify pillar pages link to cluster content
   - Update `ironic-ineptocracy-vault/06-SEO/Internal Linking Map.md`

7. **Report**
   - Update `ironic-ineptocracy-vault/06-SEO/Technical SEO Checklist.md`
   - Add opportunities to `ironic-ineptocracy-vault/00-Command-Center/Dashboard.md`
   - Update `ironic-ineptocracy-vault/00-Command-Center/KPI Snapshot.md`
   - Send Slack summary via `send_client_report`

8. **Log**
   - Update Dashboard action log
