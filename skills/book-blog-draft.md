# Skill: Book Blog Draft

## When to use
When asked to draft a blog post for The Ironic Ineptocracy website, or when running the blog pipeline workflow.

## Steps

1. **Read Context**
   - Read `ironic-ineptocracy-vault/00-Command-Center/Operating Rules.md`
   - Read `ironic-ineptocracy-vault/04-Brand/Voice and Tone.md`
   - Read `ironic-ineptocracy-vault/04-Brand/Brand Guardrails.md`

2. **Select Topic**
   - Check `ironic-ineptocracy-vault/07-Content-Production/Editorial Calendar.md` for scheduled topics
   - If no scheduled topic, pull from `ironic-ineptocracy-vault/07-Content-Production/Blog Ideas.md`
   - Confirm the topic maps to a keyword cluster in `ironic-ineptocracy-vault/06-SEO/Keyword Clusters.md`

3. **Keyword Research**
   - `keyword_overview` for the target keyword
   - `keyword_ideas` for related terms to weave in
   - `keyword_questions` for FAQ/question content

4. **Create Content Brief**
   - Target keyword, secondary keywords, search intent
   - Outline with H2/H3 structure
   - Internal link targets
   - CTA selection from `ironic-ineptocracy-vault/07-Content-Production/CTA Library.md`
   - Save to `ironic-ineptocracy-vault/07-Content-Production/Content-Briefs/`

5. **Canon Check**
   - If referencing the book, characters, or themes:
   - Cross-reference `ironic-ineptocracy-vault/01-Story-Core/` for accuracy
   - Check `ironic-ineptocracy-vault/03-Plot-and-World/Public Spoiler Rules.md` for spoiler safety
   - Verify tone matches `ironic-ineptocracy-vault/04-Brand/Voice and Tone.md`

6. **Draft the Post**
   - Follow template from `ironic-ineptocracy-vault/08-Website-Growth/Blog Templates.md`
   - Include: title, meta description, slug, categories, tags, internal links, CTA
   - Minimum 800 words
   - Save to `ironic-ineptocracy-vault/07-Content-Production/Drafts/`

7. **Quality Check**
   - Run through `ironic-ineptocracy-vault/11-Automations/WordPress Publishing Flow.md` quality checklist
   - Title tag under 60 chars? Meta under 155 chars? 2+ internal links? CTA present?

8. **Stage and Request Approval**
   - `create_draft_page` in WordPress (DRAFT status)
   - Add to `ironic-ineptocracy-vault/00-Command-Center/Approval Queue.md`
   - Send Slack approval request via `send_approval_request`

9. **Log**
   - Update Editorial Calendar with draft status
   - Update Dashboard action log
