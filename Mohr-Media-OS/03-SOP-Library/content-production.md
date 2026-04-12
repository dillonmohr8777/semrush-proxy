# SOP: Content Production

Owner: content-machine
Trigger: Scheduled slot in 30 day calendar or urgent brief from orchestrator
Cadence: Weekly batch
Inputs: Pillar, topic, audience, CTA goal, proof snippet
Outputs: Long form draft, humanized version, 5 social derivatives, distribution plan, vault entry
Failure modes: Weak hook, missing proof, no CTA, published without distribution plan

## Steps

1. Pull this week's slots from `06-Content-Engine/calendar.md`
2. For each slot run prompt CP-03 to produce the long form draft
3. Run prompt CP-04 to humanize the draft
4. Run prompt CP-05 to produce social derivatives
5. Run prompt CP-06 to build the distribution plan
6. Submit for operator review if client facing
7. Schedule publish across channels
8. Ingest the final assets into `memory-engine` with pillar, channel, date tags
9. 14 days after publish, pull metrics and log to vault

## Definition of done

- Long form published on owned surface
- At least 5 short form derivatives scheduled
- Distribution plan executed
- Vault entry created with metrics placeholder

## Quality bar

- No em dashes
- Hook delivers a promise within 15 words
- Proof visible within first scroll
- Exactly one CTA
- No throat clearing openers
