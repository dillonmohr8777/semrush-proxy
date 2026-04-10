# Approval Logic

> Defines what Claude can do autonomously vs. what needs approval.

## Decision Tree

```
Is this action visible to the public?
├── NO → Auto-execute (Tier 1)
│   Examples: keyword research, content briefs, site audits, draft creation,
│   internal linking analysis, editorial calendar updates, vault updates
│
└── YES → Does it modify live content?
    ├── NO → Auto-execute (Tier 1)
    │   Examples: staging WordPress drafts, preparing social content,
    │   writing outreach drafts, generating reports
    │
    └── YES → Is it reversible and low-risk?
        ├── YES → Approval required (Tier 2)
        │   Examples: publishing blog posts, minor page edits,
        │   updating metadata, posting social content
        │
        └── NO → Never autonomous (Tier 3)
            Examples: deleting content, changing site structure,
            spending money, legal claims, controversy responses
```

## Slack Notification Rules

### Send Immediately
- New item in Approval Queue with High priority
- Technical issue detected on the site
- Ranking drop detected on a key page

### Send in Batch (Daily or Weekly)
- New content briefs created
- Keyword research updates
- Low-priority optimization suggestions

### Never Send
- Internal vault updates (session logs, calendar changes)
- Research notes
- Draft creation (only notify when ready for approval)

## Notification Format
```
[APPROVAL NEEDED] Blog draft staged: "[Title]"
Target keyword: [keyword]
Purpose: [one line]
→ Approve to publish | → Review draft
```
