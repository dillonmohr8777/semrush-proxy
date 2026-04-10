# Slack Workflow

> How Claude uses Slack for book marketing.

## Channel Setup
- **#book-marketing** - Default channel for reports and updates
- **#book-approvals** - Approval requests only
- **#book-alerts** - Urgent issues (broken pages, ranking drops)

## Message Types

### Publish Approval
```
[PUBLISH APPROVAL]
Blog draft: "7 Political Thriller Themes Readers Are Obsessed With"
SEO score: [estimate]
Target keyword: political thriller themes
WordPress draft: [link]
→ Approve to publish?
```

### SEO Opportunity
```
[SEO OPPORTUNITY]
Ranking gap: No dedicated page for "surveillance state fiction"
Estimated value: Medium (500+ monthly searches)
Recommendation: Draft landing page
→ Approve draft creation?
```

### Content Refresh
```
[REFRESH NEEDED]
Page: /about-the-book/
Issue: Thin content, no internal links, outdated meta
Proposed changes staged
→ Approve update?
```

### Technical Alert
```
[TECHNICAL ALERT]
Broken internal link on /blog/meritocracy-fiction/
Fix staged
→ Approve live update?
```

### Weekly Summary
```
[WEEKLY SUMMARY]
Published: 2 blog posts, 1 page refresh
Staged: 3 drafts waiting approval
Opportunities: 2 new keyword gaps identified
Rankings: [key changes]
Next week: [priorities]
```

## Rules
- Keep notifications decision-focused, not informational
- One clear action per notification
- Never send more than 3 notifications in a day unless urgent
