# SEO Monitoring Flow

> How Claude tracks and responds to SEO performance.

## Weekly Checks
1. **Ranking changes** - Check key pages via `url_organic_keywords`
2. **New indexing** - Verify recently published pages are indexed
3. **Content gaps** - Compare keyword targets against published content
4. **Competitor moves** - Check `competitor_domains` for new entrants
5. **Technical issues** - Broken links, slow pages, missing metadata

## Trigger → Response

### Ranking Drop (>5 positions)
1. Check if the page was recently modified
2. Check if a competitor published new content on that keyword
3. Assess content freshness and depth
4. Stage a content refresh if needed
5. Add to Approval Queue

### New Keyword Opportunity Found
1. Check if we already have a page targeting it
2. If no: create content brief and add to Editorial Calendar
3. If yes: assess if the existing page needs expansion
4. Update `06-SEO/Keyword Universe.md`

### Page Not Indexed After 7 Days
1. Check for noindex tags, robots.txt blocks
2. Verify internal links point to the page
3. Submit to Search Console manually
4. Log to Technical SEO Checklist

### Competitor Publishes on Our Keyword
1. Analyze their content quality and angle
2. Assess if our content needs updating to compete
3. Stage improvements if needed
4. Log to SEO Experiment Log

## Monthly Report
- Rankings summary (up, down, new)
- Content published vs. planned
- Keyword universe growth
- Technical health status
- Top opportunities for next month
