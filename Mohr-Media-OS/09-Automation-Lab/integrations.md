# Integrations

The systems Mohr OS touches. Every integration has an owner, a purpose, and a fallback.

## Core stack

| Category | Tool | Purpose | Owner |
|---|---|---|---|
| CRM | Hubspot or Attio | Pipeline and deal tracking | closer-engine |
| Outbound | Smartlead or Instantly | Cold email sending | pipeline-builder |
| Enrichment | Clay or Apollo | Contact discovery and scoring | pipeline-builder |
| Scheduler | Savvycal or Calendly | Call booking | closer-engine |
| Transcription | Fathom or Fireflies | Call capture | closer-engine |
| Second brain | Obsidian | Memory engine vault | memory-engine |
| Ad accounts | Meta, Google, LinkedIn | Paid media execution | ad-strategist |
| Analytics | GA4, Fathom analytics, Plausible | Page and conversion tracking | ad-strategist |
| Content scheduling | Buffer, Hypefury, native | Social distribution | content-machine |
| Email platform | Beehiiv or ConvertKit | Newsletter | content-machine |
| Automation runtime | Make, Zapier, n8n | Cross tool glue | execution-engine |
| Version control | GitHub | Runbooks, specs, prompts | execution-engine |

## Integration rules

- No tool enters the stack without a defined purpose and owner
- Every tool has a fallback if the vendor disappears
- No tool is trusted as a source of truth for more than one domain
- Every credential is stored in the password manager, not in files
- Every integration ships with a runbook in the automation lab
