# SOP: Delivery Sprint

Owner: execution-engine
Trigger: Sprint start day
Cadence: Every 10 working days per client
Inputs: Delivery spec, previous sprint retro, current week priorities
Outputs: Sprint plan, daily standups, demo at day 10, retro at day 10, vault entries
Failure modes: Scope creep, silent blockers, missed demo, no retro

## Steps

1. Day 0: run prompt DP-02 to produce sprint plan
2. Day 0: post sprint plan in client channel and confirm acceptance
3. Days 1 to 9: daily 10 minute standup, async or live, logged in the client channel
4. Day 5: midpoint check. If any task is red, raise to orchestrator same day
5. Day 10 morning: demo prep
6. Day 10 afternoon: demo to client
7. Day 10 late: retro using prompt DP-05
8. Ingest retro into memory-engine
9. Produce DP-04 weekly client report

## Standup shape

- What moved yesterday
- What moves today
- Blockers
- Revenue tie in one sentence

## Definition of done

- Demo delivered
- Retro captured with three concrete changes
- Sprint plan for next sprint drafted
- Vault updated with runbooks and artifacts
