# Entity Templates

Stored under `99-Meta/Templates/`.

## Client entity

```
---
type: client
slug: {{slug}}
stage: stage/delivery
onboarded: {{date}}
offer: [[offer-name]]
tags:
  - type/client
  - agent/execution-engine
---

# {{client_name}}

## One liner
What they do and who they sell to.

## Stakeholders
- Economic buyer:
- Champion:
- Blocker watch:

## Success metrics
- Primary:
- Secondary:

## Offer bought
[[offer-name]]

## Delivery status
- Current sprint:
- Last retro:
- Next demo:

## Notes
- [[call-1]]
- [[runbook-1]]
```

## Offer entity

```
---
type: offer
slug: {{slug}}
version: 1.0
owner: offer-architect
tags:
  - type/offer
  - agent/offer-architect
---

# Offer: {{offer_name}}

## Canvas
- Promised outcome:
- Mechanism:
- Time to first result:
- Time to full result:
- Guarantee:
- Price:
- Payment terms:
- Client brings:
- Installed:
- Remains:

## Proof
- [[case-study-1]]

## Versions
- v1.0 — [[notes]]
```

## ICP entity

```
---
type: icp
slug: {{slug}}
owner: pipeline-builder
tags:
  - type/icp
  - agent/pipeline-builder
---

# ICP: {{icp_name}}

## Firmographic
- Revenue band:
- Headcount:
- Geography:

## Role
- Title:
- Authority:

## Trigger events
-

## Disqualifiers
-

## Offer fit
[[offer-name]]
```

## Experiment entity

Use the template inside `03-SOP-Library/experiment-log.md`.

## Insight entity

```
---
type: insight
date: {{date}}
owner: {{agent}}
tags:
  - type/insight
---

# {{insight_title}}

## What happened
One sentence.

## Why it happened
One sentence.

## What we will do
One sentence with owner and deadline.

## Source
Links.
```
