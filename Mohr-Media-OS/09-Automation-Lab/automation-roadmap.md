# Automation Roadmap

Seed roadmap for the first 12 automations Mohr Media installs for itself and for clients. Replace with live data as builds ship.

## Tier A. Pipeline

1. **Lead enrichment on form fill**. Trigger: form submission. Action: enrich company and role, score against ICP, route to CRM with tags. Owner: pipeline-builder.
2. **Cold reply classifier**. Trigger: inbound reply. Action: classify intent, draft response, route to closer-engine if positive. Owner: pipeline-builder.
3. **LinkedIn connection tagger**. Trigger: new connection. Action: tag in CRM, enroll in nurture sequence. Owner: pipeline-builder.

## Tier B. Content

4. **Long form to short form splitter**. Trigger: long form marked approved. Action: generate 5 social cuts and queue for scheduler. Owner: content-machine.
5. **Publish to vault ingest**. Trigger: content published. Action: create vault note with source link and metadata. Owner: memory-engine.
6. **Metric puller**. Trigger: 14 days after publish. Action: pull metrics and update vault note. Owner: memory-engine.

## Tier C. Sales

7. **Post discovery recap draft**. Trigger: call marked complete. Action: auto draft recap from transcript using prompt SP-02. Owner: closer-engine.
8. **Proposal generator**. Trigger: deal stage 3 to 4 transition. Action: generate proposal draft from template plus discovery notes. Owner: closer-engine.
9. **Stalled deal alert**. Trigger: deal in stage over 14 days. Action: notify closer-engine and orchestrator. Owner: closer-engine.

## Tier D. Delivery and ops

10. **Weekly report generator**. Trigger: Friday 2pm. Action: auto draft client weekly report using prompt DP-04. Owner: execution-engine.
11. **Sprint retro ingest**. Trigger: retro note saved. Action: ingest into vault and update playbooks MOC. Owner: memory-engine.
12. **Weekly operator review compiler**. Trigger: Monday 8am. Action: pull all reports and draft operator review using SOP weekly-review. Owner: orchestrator.

## Prioritization

Ship in this order: 10, 1, 4, 9, 7, 5, 2, 12, 11, 8, 6, 3.
Rationale: start with the automations that unblock the weekly review loop and the cold outbound loop first, because those are the highest frequency and highest leverage.

## Rules

- Every automation has a named owner
- Every automation has a kill switch
- Every automation logs every run
- Every automation has a runbook
