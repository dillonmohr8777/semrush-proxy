# Handoff Runbook Template

Every installed system ships with a runbook the client can run without Mohr Media. Stored under `clients/<slug>/runbooks/`.

```
# Runbook: {{system_name}}

Owner at client: {{owner}}
Backup owner: {{backup}}
Last updated: {{date}}
Version: 1.0

## Purpose
One sentence that ties to revenue.

## Inputs
What has to exist for this system to run.

## Step by step
1.
2.
3.

## Schedule
When this runs. Daily, weekly, per deal, etc.

## Success metric
How you know it worked.

## Failure modes
| Symptom | Likely cause | Fix |
|---|---|---|
| ... | ... | ... |

## Escalation
Who to contact and when.

## Change log
- {{date}} v1.0 initial
```

## Rules

- One runbook per installed system
- Runbook is written at install, not after
- Client completes a written acknowledgment that they have read the runbook
- Runbook is re tested at day 30 after install
