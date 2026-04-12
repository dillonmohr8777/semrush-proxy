# Workflow: System Building

## Objective

Keep Mohr OS itself improving over time by shipping new agents, prompts, SOPs, and automations on a predictable cadence.

## Strategy

Mohr OS is a product that the operator ships to themselves. Every week, at least one piece of the OS gets upgraded. Every month, at least one new automation gets shipped.

## Skills Used

- agent-workflow-designer
- agent-designer
- self-improving-agent
- orchestration
- prompt-engineer-toolkit
- senior-prompt-engineer
- prompt-governance
- spec-driven-workflow
- mcp-server-builder

## Agents Used

- mohr-os-orchestrator
- execution-engine
- memory-engine

## Execution Plan

### Weekly OS improvement loop

1. `memory-engine` produces a list of friction points from the past week via prompt MP-03
2. `orchestrator` picks the highest leverage item
3. `execution-engine` schedules the upgrade into the next sprint
4. Ship the upgrade as a PR to this repo or as a new file inside Mohr-Media-OS
5. Log the upgrade in `99-Meta/Improvements/` inside the vault

### Monthly automation loop

1. Pull the next item from `09-Automation-Lab/automation-roadmap.md`
2. Produce a workflow spec using the template in `09-Automation-Lab/workflow-specs.md`
3. Build, test, ship
4. Write the runbook
5. Log in the wiki

### Quarterly system review

1. Run `self-improving-agent` against the last 90 days of orchestrator runs
2. Identify agents that are overused and underused
3. Rebalance skill mappings in `01-Agent-Architecture/skill-inventory.md`
4. Retire any prompt, SOP, or workflow that has not produced revenue in 90 days

## Assets Created

- Weekly improvement PRs
- Monthly automation builds
- Quarterly system review doc
- Refreshed skill inventory

## Next Actions

1. Add a weekly 30 minute block for system building on the operator calendar
2. Track OS improvements shipped per month as a Mohr OS health metric
3. Use the quarterly review to set the next quarter's build roadmap
