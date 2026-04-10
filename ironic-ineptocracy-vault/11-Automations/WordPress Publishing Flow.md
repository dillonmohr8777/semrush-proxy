# WordPress Publishing Flow

> End-to-end flow from idea to published page.

## The Pipeline

```
Keyword Research → Content Brief → Draft → WordPress Staging → Approval → Publish → Repurpose → Log
```

## Step-by-Step

### 1. Research
- `keyword_overview` for target keyword
- `keyword_ideas` for related terms
- `keyword_questions` for FAQ content
- Check existing pages for overlap
- Save brief to `07-Content-Production/Content-Briefs/`

### 2. Draft
- Write full article following `08-Website-Growth/Blog Templates.md`
- Include: title, meta description, slug, categories, tags, internal links, CTA
- Save to `07-Content-Production/Drafts/`

### 3. Stage
- `create_draft_page` or stage as blog post in WordPress
- Set status: DRAFT (never publish directly)
- Set slug, categories, tags
- Add featured image concept note

### 4. Approval
- Add to `00-Command-Center/Approval Queue.md`
- Send Slack notification with:
  - Draft title
  - Target keyword
  - WordPress draft link
  - Purpose + expected value
  - Clear approve/revise decision

### 5. Publish (After Approval)
- Update status to publish (requires V2+ mode or manual action)
- Verify page loads correctly
- Check meta tags are correct
- Submit URL to Google Search Console for indexing

### 6. Repurpose
- Run repurposing workflow (see `07-Content-Production/Repurposing Matrix.md`)
- Generate social, email, and community content

### 7. Log
- Move to `07-Content-Production/Final-Copy/`
- Update `07-Content-Production/Editorial Calendar.md`
- Update `06-SEO/Internal Linking Map.md`
- Log to `00-Command-Center/Dashboard.md`

## Quality Checklist (Pre-Approval)
- [ ] Title tag under 60 characters with primary keyword
- [ ] Meta description under 155 characters with keyword + hook
- [ ] H1 includes primary keyword
- [ ] Minimum 800 words
- [ ] 2+ internal links
- [ ] CTA present
- [ ] No canon violations (checked against `01-Story-Core/`)
- [ ] No spoiler violations (checked against `03-Plot-and-World/Public Spoiler Rules.md`)
- [ ] Tone matches `04-Brand/Voice and Tone.md`
