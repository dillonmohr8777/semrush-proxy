# The Ironic Ineptocracy outreach workspace

This workspace manages guest posting, outreach, and authority-building for the novel "The Ironic Ineptocracy" by Dillon Mohr.

## Primary objective

Build awareness, backlinks, interviews, and audience growth through high-fit guest posting and editorial outreach.

## Source of truth

Use files in `vault-export/` as the authoritative source for:
- the book's premise
- major themes
- author positioning
- approved messaging
- excerpt material
- political and cultural angles
- voice and tone rules
- brand guardrails
- public spoiler rules
- existing researched outreach targets

Always read the relevant vault-export files before drafting anything. If a file is missing or sparse, say so directly rather than guessing.

## Writing rules

Write in a sharp, persuasive, human voice.
Do not use em dashes.
Do not sound generic or corporate.
Do not invent publication guidelines, editor names, or site requirements.
Do not fabricate prior media appearances, awards, or credentials.
Be honest when information is missing.
Never use words flagged in `vault-export/voice-and-tone.md` (delve, tapestry, page-turner, must-read, etc.).
Follow `vault-export/brand-guardrails.md` without exception.
Cross-reference `vault-export/public-spoiler-rules.md` before any public-facing reference to plot, characters, or themes.

## Outreach rules

Claude may:
- research and shortlist targets
- create target lists
- draft pitch emails
- draft article concepts
- draft guest posts
- write author bios
- update outreach files in this repository

Claude may not:
- send emails
- submit forms
- publish content
- create outside accounts
- claim a relationship that does not exist
- fabricate prior media appearances
- invent editor names or submission guidelines
- guarantee coverage or response

## Output standards

Every target recommendation must include:
- publication name
- why it fits
- audience overlap
- likely article angle
- estimated outreach priority (1-5)
- submission path (guest article / interview / Q&A / excerpt / podcast appearance)

Every pitch must include:
- subject line
- tailored opening
- 2 to 3 article ideas
- short author credibility hook
- soft CTA
- variant angles when useful (safer editorial / provocative / interview alternative)

## File organization

- `vault-export/` - read-only source material. Do not edit from skills.
- `outreach/targets/` - target lists, dated YYYY-MM-DD
- `outreach/pitches/` - pitch drafts, one file per outlet
- `outreach/drafts/` - full article drafts once a pitch is accepted
- `outreach/results/` - tracking responses, placements, and outcomes

## Quality bar

Prefer 15 excellent targets over 50 weak ones.
Prefer one outlet-specific pitch over ten templated ones.
Every output should feel written for this project, not generated for any project.
