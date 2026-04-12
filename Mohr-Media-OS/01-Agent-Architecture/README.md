# Agent Architecture

Mohr OS operates as a top level orchestrator that delegates work to eight internal agents. Each agent wraps a set of real Claude Code skills located in `.claude/skills/` at the repo root.

## Design rules

1. Each agent has one clearly bounded mission
2. Each agent delegates to between 3 and 10 real skills
3. Each agent defines its own inputs, outputs, and handoffs
4. No agent writes prose or code that another agent owns
5. Every run must route through `mohr-os-orchestrator` first

## Agent list

| Agent | Mission | Primary skills |
|---|---|---|
| mohr-os-orchestrator | Route objectives to the right agents and enforce the Execution Framework | orchestration, agent-workflow-designer, self-improving-agent |
| offer-architect | Design offers, packaging, pricing, and proof | pricing-strategy, product-discovery, contract-and-proposal-writer, marketing-psychology |
| pipeline-builder | Build and run outbound and inbound pipeline | pipeline, marketing-demand-acquisition, cs-demand-gen-specialist, cold-email, email-sequence, revenue-operations |
| content-machine | Plan, produce, humanize, and distribute content | content-production, content-strategy, content-humanizer, copywriting, social-content, video-content-strategist, x-twitter-growth, programmatic-seo |
| ad-strategist | Run paid media strategy, creative, landing pages, full CRO stack | paid-ads, ad-creative, landing-page-generator, page-cro, form-cro, signup-flow-cro, onboarding-cro, popup-cro, paywall-upgrade-cro, cro-advisor |
| closer-engine | Discovery, proposals, objection handling, closing | sales-engineer, contract-and-proposal-writer, marketing-psychology, pricing-strategy |
| execution-engine | Delivery sprints, operational execution, QA | orchestration, project-management, sprint-plan, spec-driven-workflow, runbook-generator, prd |
| memory-engine | Own the Obsidian second brain and ingest every insight | llm-wiki, cs-wiki-librarian, cs-wiki-ingestor, wiki-query, wiki-ingest, wiki-init, remember |

## Delegation protocol

1. User submits objective to Mohr OS
2. `mohr-os-orchestrator` selects 3 to 5 agents for the task
3. Each selected agent runs its own loop and produces structured output
4. `execution-engine` schedules the work if the output is time sensitive
5. `memory-engine` ingests every artifact into the Obsidian vault
6. Orchestrator returns the final report in the OS output contract

## Output contract

Every agent returns:

- Objective
- Strategy
- Skills Used
- Assets Created
- Handoffs
- Next Actions

## Where the real skills live

Path: `.claude/skills/<skill-name>/SKILL.md`

See `skill-inventory.md` in this folder for the full mapping of the 325 skills available in this workspace against Mohr OS agents.
