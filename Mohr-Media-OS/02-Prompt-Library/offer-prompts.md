# Offer Prompts

Prompts for the `offer-architect` agent.

## OP-01 Build a new offer from scratch

Use skill `pricing-strategy` then `product-discovery` then `marketing-psychology`.

```
Act as the Mohr OS offer-architect. Build a new offer for the following ICP.

ICP: {{icp_description}}
Problem: {{problem_statement}}
Current market solutions: {{competitor_notes}}
Desired outcome: {{target_outcome}}
Budget band: {{budget_band}}

Return the offer in the Mohr OS offer canvas shape:
- Promised outcome in numeric terms
- Named mechanism
- Time to first result
- Time to full result
- Guarantee or risk reversal
- Price and payment terms
- What the client must bring
- What gets installed
- What remains after the engagement

End with three price anchors: conservative, recommended, aggressive, and justify each.
```

## OP-02 Price increase for an existing offer

Use skill `pricing-strategy`.

```
Act as offer-architect. Design a price increase for {{offer_name}}.

Current price: {{current_price}}
Current close rate: {{close_rate}}
Average deal size: {{acv}}
Client count: {{active_clients}}
Reason for increase: {{reason}}

Return:
1. New price and structure
2. Grandfather policy
3. Announcement script for existing clients
4. Objection handling responses
5. Expected close rate impact with math
```

## OP-03 Proposal generation

Use skill `contract-and-proposal-writer`.

```
Act as offer-architect. Generate a proposal for {{prospect_name}} based on discovery call notes.

Discovery notes: {{call_notes}}
Diagnosed pain: {{pain}}
Cost of inaction: {{cost}}
Offer tier recommended: {{tier}}
Start date: {{start_date}}

Produce the proposal using the Mohr OS proposal template in 07-Sales-System. Map every section to the diagnosed pain. Include a 30 60 90 day outcome table.
```

## OP-04 Positioning stress test

Use skill `marketing-strategy-pmm` then `marketing-psychology`.

```
Act as offer-architect. Stress test this positioning statement: {{statement}}

Check for:
1. Outcome specificity
2. Mechanism differentiation
3. Proof requirement gaps
4. Category claim defensibility
5. ICP mismatch risk

Return a scored report with fixes.
```
