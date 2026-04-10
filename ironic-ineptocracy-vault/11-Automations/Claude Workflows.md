# Claude Workflows

> All automated workflows Claude runs for book marketing.

## Workflow 1: Weekly Site Audit
**Trigger:** Weekly (Monday)
**Steps:**
1. Check ironicineptocracy.com pages for thin content, broken links, missing metadata
2. Run `url_organic_keywords` on key pages to check ranking changes
3. Compare current content inventory against keyword clusters
4. Identify new content gaps
5. Update `06-SEO/Technical SEO Checklist.md`
6. Add opportunities to `00-Command-Center/Dashboard.md`
7. Send Slack summary if action items exist

## Workflow 2: Blog Draft Pipeline
**Trigger:** 2-3x per week
**Steps:**
1. Pull next priority topic from `07-Content-Production/Editorial Calendar.md`
2. Run `keyword_overview` and `keyword_questions` for target keyword
3. Create content brief in `07-Content-Production/Content-Briefs/`
4. Draft full blog post in `07-Content-Production/Drafts/`
5. Stage in WordPress as draft
6. Add to `00-Command-Center/Approval Queue.md`
7. Send Slack approval request

## Workflow 3: Content Repurposing
**Trigger:** After any blog post is approved
**Steps:**
1. Read the approved blog post
2. Generate derivative content per `07-Content-Production/Repurposing Matrix.md`
3. Save social content to `07-Content-Production/Drafts/` with platform labels
4. Queue email angle for next newsletter
5. Log repurposing to Dashboard action log

## Workflow 4: Page Health Monitor
**Trigger:** Bi-weekly
**Steps:**
1. Check all published pages for ranking changes
2. Identify pages losing position
3. Identify pages with high impressions but low CTR (title/meta issue)
4. Stage refresh recommendations
5. Update `06-SEO/SEO Experiment Log.md` with observations

## Workflow 5: Keyword Research Refresh
**Trigger:** Monthly
**Steps:**
1. Re-run `keyword_ideas` for core seed keywords
2. Check `keyword_gap` against comp title domains
3. Update `06-SEO/Keyword Universe.md` with new opportunities
4. Update `06-SEO/Keyword Clusters.md` if new clusters emerge
5. Propose new blog topics based on findings
6. Update Editorial Calendar

## Workflow 6: Approval Queue Management
**Trigger:** Ongoing
**Steps:**
1. Check `00-Command-Center/Approval Queue.md` for items
2. Send Slack notifications for high-priority pending items
3. After approval: execute the action (publish, update, send)
4. Move item to "Recently Approved"
5. Log to Dashboard action log
