# Workflow: Delivery

## Objective

Run client installs on a 10 day sprint cadence, ship revenue tied outcomes every sprint, and hand off runbooks the client owns.

## Strategy

Small sprints. Revenue tied outcomes. Weekly reports. Demos every sprint. Retros every sprint. Runbooks shipped at install, not after.

## Skills Used

- orchestration
- project-management
- sprint-plan
- spec-driven-workflow
- runbook-generator
- prd
- retro
- report

## Agents Used

- execution-engine
- memory-engine
- content-machine (for deliverable copy)
- ad-strategist (for channel installs)
- closer-engine (for renewal and expansion)

## Execution Plan

### Onboarding

Follow `03-SOP-Library/client-onboarding.md`.

### Sprint loop per 10 working days

1. Day 0: sprint plan via prompt DP-02
2. Daily: standup note in client channel
3. Day 5: midpoint check
4. Day 10 morning: demo prep
5. Day 10 afternoon: demo
6. Day 10 late: retro via prompt DP-05
7. Produce weekly report via prompt DP-04 every Friday

### Runbook production

Every installed system produces a runbook via prompt DP-03 before the system goes live.

### QA gate

Every client facing asset runs through `08-Delivery-System/qa-checklist.md` before ship.

### Monthly review

First business day of new month. Economic buyer attends. Use `05-Client-Operating-System/monthly-review-template.md`.

### Case study pipeline

At day 60 if metrics are on target, start the case study pipeline from `08-Delivery-System/case-study-pipeline.md`.

## Assets Created

- Delivery spec
- Sprint plans (one per 10 days)
- Weekly reports
- Monthly reviews
- Runbooks per installed system
- Retro notes in vault
- Case study drafts when eligible

## Next Actions

1. Do not start sprint 1 without a signed delivery spec
2. Do not ship anything without QA
3. Hand off runbooks live on a shared screen, not in a dropped link
