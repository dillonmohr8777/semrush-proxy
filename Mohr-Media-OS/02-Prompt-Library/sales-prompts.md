# Sales Prompts

Prompts for the `closer-engine` agent.

## SP-01 Discovery call prep

Use skill `sales-engineer` then `marketing-psychology`.

```
Act as closer-engine. Prep me for a discovery call.

Prospect: {{name}}
Company: {{company}}
Role: {{role}}
Source: {{source}}
What they said on intake: {{intake_notes}}
Offer tier likely: {{tier}}

Return:
1. Three hypotheses on their biggest pain
2. Five discovery questions ranked by leverage
3. Likely objections
4. Proof snippets to keep in pocket
5. Suggested close move at end of call
```

## SP-02 Discovery call recap

Use skill `meeting-analyzer`.

```
Act as closer-engine. Turn this raw call transcript into a structured recap.

Transcript: {{transcript}}

Return in the Mohr OS discovery framework shape:
- Context
- Current state
- Cost of inaction
- Success picture
- Decision process
- Next step
Plus a fit, pain, budget, authority, timeline scoring line.
```

## SP-03 Proposal follow up

Use skill `contract-and-proposal-writer`.

```
Act as closer-engine. Write a 3 touch followup sequence after proposal sent.

Prospect: {{name}}
Proposal summary: {{proposal_summary}}
Days since send: {{days}}
Last signal: {{last_signal}}

Each touch under 80 words. No desperation. One clear ask per touch. End with a graceful exit option at touch 3.
```

## SP-04 Objection response

Use skill `marketing-psychology` then `contract-and-proposal-writer`.

```
Act as closer-engine. Respond to this objection.

Objection: {{objection}}
Context: {{deal_context}}

Return:
1. Reframe of the objection in writing
2. Scripted verbal response
3. Follow up email version
4. Handoff trigger if it should escalate to offer-architect
```

## SP-05 Win loss entry

Use skill `remember` then `llm-wiki`.

```
Act as closer-engine. Write the win loss entry for this deal.

Deal: {{deal_name}}
Outcome: {{outcome}}
Value: {{value}}
Decision factors: {{factors}}
Competitor: {{competitor}}
Length of cycle: {{cycle_days}}

Return the entry in the Mohr OS win loss template format ready for memory-engine ingest.
```
