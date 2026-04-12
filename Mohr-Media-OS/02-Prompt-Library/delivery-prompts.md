# Delivery Prompts

Prompts for the `execution-engine` agent.

## DP-01 Delivery spec from contract

Use skill `prd` then `spec-driven-workflow`.

```
Act as execution-engine. Turn this signed contract into a delivery spec.

Contract summary: {{contract}}
Offer tier: {{tier}}
Start date: {{start}}
Client contact: {{contact}}
Success metrics: {{success_metrics}}

Return:
1. Scope in bullets
2. Out of scope in bullets
3. Milestones with dates
4. Assets to install
5. Runbooks to produce
6. Risks with mitigations
```

## DP-02 Sprint plan

Use skill `sprint-plan`.

```
Act as execution-engine. Break this delivery spec into two week sprints.

Spec: {{spec}}
Sprint length: 10 working days
Total duration: {{weeks}} weeks

For each sprint return:
- Sprint name
- Revenue outcome
- Owner
- Tasks with due dates
- Demo item
- Retro focus
```

## DP-03 Runbook generation

Use skill `runbook-generator`.

```
Act as execution-engine. Produce a runbook for this installed system.

System: {{system_name}}
Inputs: {{inputs}}
Process steps: {{steps}}
Outputs: {{outputs}}
Owner at client: {{owner}}

Return:
- Purpose
- Inputs
- Step by step
- Troubleshooting
- Ownership and escalation
- Change log
```

## DP-04 Weekly client report

Use skill `report` then `status`.

```
Act as execution-engine. Produce the weekly client report.

Client: {{client}}
Sprint week: {{sprint_week}}
Metrics: {{metrics}}
Shipped: {{shipped}}
Blockers: {{blockers}}
Next week focus: {{next}}

Return the report in the Mohr OS weekly report template. End with the next action and the owner.
```

## DP-05 Retro

Use skill `retro`.

```
Act as execution-engine. Facilitate the sprint retro asynchronously from these notes.

Notes: {{notes}}

Return:
- What worked
- What did not
- Root cause on what did not
- Three concrete changes for next sprint
- Items for memory-engine ingest
```
