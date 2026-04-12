# Workflow: Sales

## Objective

Close qualified conversations into signed contracts with a scripted discovery, closing framework, and objection system.

## Strategy

Never wing it. Every call has prep, a framework, a recap, and a next step.

## Skills Used

- sales-engineer
- contract-and-proposal-writer
- marketing-psychology
- pricing-strategy
- meeting-analyzer

## Agents Used

- closer-engine
- offer-architect
- memory-engine

## Execution Plan

### Before the call

1. `closer-engine` runs prompt SP-01
2. Read the prospect's last 3 touches and any replies
3. Confirm the call 24 hours ahead with the agenda
4. Decide the likely offer tier hypothesis

### During the call

1. Run the Mohr OS discovery framework from `07-Sales-System/discovery-call-script.md`
2. Write down numeric details live
3. Make the call decision live (proposal, second call, or disqualify)

### After the call

1. `closer-engine` runs prompt SP-02 to produce the recap
2. Send recap within 4 hours
3. If proposal, run prompt OP-03 within 24 hours
4. Update the deal record stage with next step and date
5. `memory-engine` ingests call notes and recording link

### If stuck

1. Run prompt SP-04 on the objection
2. If objection is price or packaging, escalate to `offer-architect`
3. If objection repeats across 3 deals, update `07-Sales-System/objection-handling.md`

### Win loss loop

1. On every close, `closer-engine` runs prompt SP-05
2. Entry lands in `memory-engine`
3. Monthly synthesis updates the objection playbook and offer canvas

## Assets Created

- Filled in discovery recap per prospect
- Custom proposal per deal
- Objection playbook updated
- Win loss ledger in vault

## Next Actions

1. Block the first 10 minutes of every call for the Mohr OS opening
2. Use the closing framework on every call, even if you think you will win
3. No deal moves stages without a written next step
