# SOP: Weekly Review

Owner: mohr-os-orchestrator
Trigger: Monday 9am local
Cadence: Weekly
Inputs: Pipeline report, paid media report, content report, delivery reports, win loss log
Outputs: One page operator review, three priority decisions, sprint adjustments, vault entry
Failure modes: Missing data, skipped decision, no adjustments made

## Steps

1. Pull pipeline report from pipeline-builder (prompt PP-05)
2. Pull paid media report from ad-strategist (prompt AP-05)
3. Pull content to pipeline report from content-machine
4. Pull each client delivery report from execution-engine (prompt DP-04)
5. Read the week's win loss entries from closer-engine
6. Produce the one page operator review in the Mohr OS weekly template
7. Make three decisions: one hire fire tool decision, one channel decision, one offer decision
8. Push adjustments into next week's sprint plans
9. Ingest the full review into memory-engine

## Weekly review template

```
Week of: <date>

Pipeline dollars created: <n>
Gap to target: <n>
Conversations: <n>
Meetings: <n>
Proposals: <n>
Closed: <n>

Content to pipeline rate: <percent>
Paid media payback status: <on / behind / ahead>

Biggest win: <one sentence>
Biggest loss: <one sentence>
Root cause on loss: <one sentence>

Three decisions:
1. <decision>
2. <decision>
3. <decision>

Sprint adjustments: <bulleted>
```

## Definition of done

- One page review saved to vault under `04-Obsidian-Vault-Blueprint/weekly/`
- Three decisions written in plain language
- Adjustments reflected in next week's sprint plans
