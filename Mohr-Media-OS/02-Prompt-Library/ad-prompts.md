# Ad Prompts

Prompts for the `ad-strategist` agent.

## AP-01 Media plan

Use skill `paid-ads`.

```
Act as ad-strategist. Build a 90 day media plan for {{brand}}.

Offer: {{offer}}
ACV: {{acv}}
Target CAC: {{target_cac}}
Payback target: {{payback_days}}
Budget: {{monthly_budget}}
Channels available: {{channels}}

Return:
1. Channel mix with percent split and rationale
2. Campaign structure per channel
3. Creative angles per channel
4. Measurement plan
5. Kill criteria per campaign
```

## AP-02 Creative angles

Use skill `ad-creative` then `marketing-psychology`.

```
Act as ad-strategist. Generate 10 creative angles for {{offer}}.

Target pain: {{pain}}
Target audience: {{icp}}
Proof available: {{proof}}

For each angle return:
- Angle name
- Hook copy 40 chars max
- Primary text 125 chars
- Body copy 250 chars
- Visual direction
- Mental model used
```

## AP-03 Landing page spec

Use skill `landing-page-generator` then `page-cro`.

```
Act as ad-strategist. Produce a landing page spec for this ad campaign.

Campaign: {{campaign}}
Ad promise: {{ad_promise}}
Offer: {{offer}}
Proof: {{proof}}

Return:
- Above the fold block copy and layout
- Proof block
- Mechanism explanation
- Objection section
- Guarantee
- Primary CTA text and placement
- Secondary CTA
- Mobile specific adjustments
```

## AP-04 CRO audit

Use skill `cro-advisor` then channel specific cro skills.

```
Act as ad-strategist. Audit this conversion surface.

Page URL or mock: {{asset}}
Current conversion rate: {{cr}}
Traffic source: {{source}}
Target CR: {{target_cr}}

Run the Mohr OS CRO audit checklist and return prioritized fixes with expected lift.
```

## AP-05 Weekly paid media report

Use skill `campaign-analytics`.

```
Act as ad-strategist. Produce the weekly paid media report.

Inputs: {{campaign_metrics_table}}

Return:
1. Spend, CAC, ROAS per campaign
2. Payback status
3. Kill list
4. Scale list
5. Creative refresh list
6. Three experiments queued for next week
```
