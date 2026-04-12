# SOP: Sales Call

Owner: closer-engine
Trigger: Meeting booked by pipeline-builder or inbound form
Cadence: Per call
Inputs: Prospect record, intake notes, offer tier hypothesis
Outputs: Discovery recap, fit score, proposal sent or disqualified, vault entry
Failure modes: Skipped prep, no next step, soft close, missing decision maker

## Steps

1. Run prompt SP-01 to prep
2. Confirm call 24 hours ahead with agenda
3. Record the call with explicit consent
4. Run the Mohr OS discovery framework live
5. Make the call decision live at the end: proposal, second call, or disqualify
6. Send recap within 4 hours using prompt SP-02
7. If proposal, send within 24 hours using OP-03
8. Log deal stage update
9. Ingest recap and recording link into memory-engine

## Qualification bar

Prospect must hit 4 of 5 to advance:

1. Fit with ICP
2. Diagnosed pain with numeric cost
3. Budget signal within offer band
4. Identified decision maker
5. Timeline within 90 days

## Definition of done

- Recap sent
- Deal record updated
- Vault entry created
- Next step booked or disqualified with reason
