# Content Prompts

Prompts for the `content-machine` agent.

## CP-01 Pillar definition

Use skill `content-strategy`.

```
Act as content-machine. Define 3 to 5 content pillars for {{brand}}.

ICP: {{icp}}
Offer: {{offer}}
Tone: {{tone}}
Channels planned: {{channels}}

For each pillar return:
- Pillar name
- Core belief
- Audience pain it speaks to
- Offer tie in
- 10 starter topic ideas
- Formats this pillar performs best in
```

## CP-02 30 day calendar

Use skill `content-strategy`.

```
Act as content-machine. Build a 30 day content calendar from these pillars.

Pillars: {{pillars}}
Publishing cadence per channel: {{cadence}}

Return a table with date, pillar, format, channel, hook, CTA, supporting repurposes.
```

## CP-03 Long form draft

Use skill `content-production`.

```
Act as content-machine. Draft a long form post on this topic.

Topic: {{topic}}
Pillar: {{pillar}}
Audience: {{icp}}
Desired outcome: {{cta_goal}}
Proof available: {{proof}}

Structure:
- Hook
- Context
- Core insight
- Counter intuitive point
- Proof
- Actionable framework
- CTA

Length: 900 to 1200 words. No em dashes. No throat clearing. No filler openers.
```

## CP-04 Humanize a draft

Use skill `content-humanizer`.

```
Act as content-machine. Humanize this draft for the {{brand}} voice.

Draft: {{draft}}
Voice reference: {{voice_example}}

Rules:
- Cut every AI tell
- Short sentences where rhythm demands it
- Remove corporate softeners
- Keep proof and claims intact
```

## CP-05 Social repurpose

Use skill `social-content` and `x-twitter-growth`.

```
Act as content-machine. Repurpose this long form into 5 social posts and 1 thread.

Source: {{long_form}}

For each post return:
- Platform
- Hook
- Body
- CTA
- Visual direction
Thread: 8 to 12 posts with a single narrative arc.
```

## CP-06 Distribution plan

Use skill `content-strategy`.

```
Act as content-machine. Produce the distribution plan for this piece.

Piece: {{piece}}
Channels: {{channels}}
Audience segments: {{segments}}

Return a table with channel, time, format, copy variant, measurement.
```
