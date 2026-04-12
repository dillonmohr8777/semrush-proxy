# Pipeline Stages

## Stages

| Stage | Definition | Exit criteria | Owner |
|---|---|---|---|
| 0. Prospect | Contact matches ICP and has not been contacted | First touch sent | pipeline-builder |
| 1. Contacted | First touch sent | Reply received or full sequence completed | pipeline-builder |
| 2. Engaged | Prospect replied with interest or question | Qualification call booked | pipeline-builder |
| 3. Qualified | Discovery call completed and fit confirmed | Proposal sent | closer-engine |
| 4. Proposal | Proposal delivered in writing | Decision received | closer-engine |
| 5. Negotiation | Client is reviewing terms or asking for changes | Signed contract | closer-engine |
| 6. Closed won | Contract signed | Kickoff scheduled | execution-engine |
| 7. Onboarding | Kickoff complete and sprint 1 live | First sprint demo complete | execution-engine |
| 8. Delivery | Sprints running | Contract end or renewal | execution-engine |
| 9. Renewal | Renewal conversation active | Decision received | closer-engine |
| X1. Closed lost | Explicit no with reason logged | Reactivation schedule set | closer-engine |
| X2. Disqualified | Not a fit, will not come back | Archive | closer-engine |

## Rules

- Every deal has exactly one owner
- Every deal has a next step with a date
- Any deal stuck in a stage for over 14 days without movement is flagged
- Lost reason is mandatory, not optional
