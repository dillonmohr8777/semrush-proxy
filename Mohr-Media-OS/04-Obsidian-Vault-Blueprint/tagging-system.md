# Tagging System

Tags are controlled. Unknown tags get flagged by wiki-lint.

## Dimensions

Every note carries tags across up to five dimensions.

### 1. Type

- `type/client`
- `type/offer`
- `type/icp`
- `type/channel`
- `type/experiment`
- `type/insight`
- `type/playbook`
- `type/person`
- `type/competitor`
- `type/tool`
- `type/call`
- `type/asset`
- `type/runbook`
- `type/retro`
- `type/report`

### 2. Stage

- `stage/pipeline`
- `stage/discovery`
- `stage/proposal`
- `stage/closed-won`
- `stage/closed-lost`
- `stage/delivery`
- `stage/retention`
- `stage/churned`

### 3. Channel

- `channel/cold-email`
- `channel/linkedin`
- `channel/paid-meta`
- `channel/paid-google`
- `channel/paid-linkedin`
- `channel/youtube`
- `channel/x`
- `channel/owned-blog`
- `channel/podcast`
- `channel/referral`

### 4. Agent

- `agent/orchestrator`
- `agent/offer-architect`
- `agent/pipeline-builder`
- `agent/content-machine`
- `agent/ad-strategist`
- `agent/closer-engine`
- `agent/execution-engine`
- `agent/memory-engine`

### 5. Status

- `status/active`
- `status/paused`
- `status/archived`
- `status/winning`
- `status/losing`

## Rules

1. Every note carries at least `type/` and `agent/`
2. Client notes always carry the client slug in the frontmatter, not as a tag
3. Tags are always lowercase with slashes
4. Do not create new tags. Propose them through `99-Meta/Improvements/` first
