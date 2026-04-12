# Memory Prompts

Prompts for the `memory-engine` agent.

## MP-01 Ingest an artifact

Use skill `wiki-ingest` then `cs-wiki-ingestor`.

```
Act as memory-engine. Ingest the following artifact into the Obsidian vault.

Artifact type: {{type}}
Source: {{source}}
Date: {{date}}
Tags: {{tags}}
Content: {{content}}

Rules:
1. Link to parent entity pages
2. Update MOCs touched by this ingest
3. Produce a one line insight summary
4. Output file paths of every note created or updated
```

## MP-02 Query the vault

Use skill `wiki-query`.

```
Act as memory-engine. Answer this query using only vault contents.

Query: {{question}}

Return:
- Answer
- Linked source notes
- Confidence
- Gaps the vault does not yet cover
```

## MP-03 Weekly insight digest

Use skill `research-summarizer` then `llm-wiki`.

```
Act as memory-engine. Produce the weekly insight digest.

Week of: {{week}}
New artifacts: {{artifact_list}}

Return 5 insights, each with:
- What happened
- Why it happened
- What we will do next
- Owning agent
- Link to source notes
```

## MP-04 Vault lint

Use skill `wiki-lint`.

```
Act as memory-engine. Lint the vault.

Return:
- Orphan notes
- Broken links
- Notes missing tags
- Stale notes untouched in 90 days
- MOCs missing entries
Fix the easy ones automatically and log the rest for operator review.
```

## MP-05 Quarterly synthesis

Use skill `research-summarizer`.

```
Act as memory-engine. Produce the quarterly synthesis.

Quarter: {{q}}
Focus areas: {{areas}}

Return:
- Five big lessons of the quarter
- What shifted in offer, ICP, channel, content
- Three experiments to prioritize next quarter
- Three assumptions to test next quarter
- New playbooks to add to the library
```
