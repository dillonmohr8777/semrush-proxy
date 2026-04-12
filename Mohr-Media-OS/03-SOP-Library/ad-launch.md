# SOP: Ad Launch

Owner: ad-strategist
Trigger: New campaign approved in media plan
Cadence: Per campaign
Inputs: Offer, creative angles, landing page, budget, targeting, kill criteria
Outputs: Live campaign, baseline report, day 7 checkpoint, day 14 decision
Failure modes: Ad promise mismatch with landing, tracking not firing, budget pacing wrong

## Steps

1. Finalize creative angles using prompt AP-02
2. Produce landing page spec using prompt AP-03
3. QA tracking on landing page before any spend
4. Load campaigns, ad sets, ads with naming convention `<brand>-<channel>-<objective>-<angle>`
5. Set budget caps and kill criteria inside the platform
6. Launch with 24 hour learning window
7. Day 3 checkpoint: pause ads below half of target CTR
8. Day 7 checkpoint: run prompt AP-05 for full report
9. Day 14 decision: scale, iterate, or kill
10. Log every decision into `memory-engine`

## Kill criteria

- CAC above 150% of target after 200 clicks
- ROAS below target floor after 48 hours on retargeting
- Landing CR below half of baseline after 500 sessions
- Creative fatigue CTR drop above 30% week over week

## Definition of done

- Campaign live with tracking verified
- Day 7 report delivered
- Kill scale iterate decision logged in vault
