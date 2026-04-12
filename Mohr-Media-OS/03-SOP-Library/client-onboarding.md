# SOP: Client Onboarding

Owner: execution-engine
Trigger: Contract signed inside closer-engine
Cadence: Once per new client
Inputs: Signed contract, discovery notes, offer tier, start date
Outputs: Kickoff complete, delivery spec live, sprint 1 launched, client vault created
Failure modes: Missing stakeholder, unclear success metric, asset access not granted

## Steps

1. Within 24 hours of signature, send welcome email from `closer-engine` handoff template
2. Create client folder inside `05-Client-Operating-System/clients/<client-slug>/` with the client profile template
3. Create client entity in the Obsidian vault via `memory-engine`
4. Schedule kickoff call within 5 business days
5. Send kickoff prep packet 48 hours before call (goals, success metrics, access list)
6. Run kickoff call with the kickoff agenda in `05-Client-Operating-System/kickoff-checklist.md`
7. Produce delivery spec using DP-01 prompt
8. Produce sprint 1 plan using DP-02 prompt
9. Launch sprint 1 and post in client channel
10. Ingest kickoff artifacts into vault via `memory-engine`

## Definition of done

- Delivery spec signed off by client in writing
- Sprint 1 launched and visible to client
- Client vault entity live with first three notes
- Weekly report cadence scheduled
