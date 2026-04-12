# Pipeline Prompts

Prompts for the `pipeline-builder` agent.

## PP-01 Build ICP scoring model

Use skill `marketing-demand-acquisition` then `persona`.

```
Act as pipeline-builder. Build an ICP scoring model for {{offer_name}}.

Known wins: {{win_list}}
Known losses: {{loss_list}}
Offer shape: {{offer_summary}}

Return a 10 point scoring rubric with:
1. Firmographic filters
2. Technographic signals
3. Trigger events
4. Role filters
5. Disqualifiers

Include SQL or filter logic if the operator runs Clay, Apollo, or Hubspot.
```

## PP-02 Cold email sequence

Use skill `cold-email`.

```
Act as pipeline-builder. Write a 5 touch cold outbound sequence for this ICP and offer.

ICP: {{icp}}
Offer: {{offer}}
Trigger: {{trigger_event}}
Proof: {{proof_snippet}}
Sender persona: {{sender_role}}

Return:
- Touch 1 Hook with trigger
- Touch 2 Value with proof
- Touch 3 Direct ask
- Touch 4 Break up
- Touch 5 30 day recovery
Each under 75 words. Include plain text only. No corporate jargon. No emojis.
```

## PP-03 LinkedIn DM sequence

Use skill `cold-email` then `marketing-psychology`.

```
Act as pipeline-builder. Write a 4 touch LinkedIn DM sequence to pair with email for the same ICP.

Same variables as PP-02.

Each touch under 40 words. No voice notes prompts. No calendar links in first two touches.
```

## PP-04 Reply classifier

Use skill `cs-demand-gen-specialist`.

```
Act as pipeline-builder. Classify these outbound replies and produce next actions.

Replies: {{raw_replies}}

For each reply return:
- Classification: positive, soft no, hard no, objection, question, referral
- Confidence: low, medium, high
- Recommended response snippet
- Handoff: to closer-engine or not
```

## PP-05 Weekly pipeline report

Use skill `revenue-operations` then `pipeline`.

```
Act as pipeline-builder. Produce the weekly pipeline report.

Inputs:
- New contacts added: {{new_contacts}}
- Conversations started: {{new_convos}}
- Meetings booked: {{meetings}}
- Proposals sent: {{proposals}}
- Deals closed: {{closed}}
- Revenue booked: {{revenue}}

Return:
1. Pipeline dollars created
2. Gap to weekly target
3. Conversion rate per stage
4. Top reply objections
5. Three recommended fixes for next week
```
