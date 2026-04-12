# Prompt Library

Reusable, parameterized prompts for every Mohr OS agent. Each prompt calls real skills from `.claude/skills/` by name. Parameters are written in `{{double_braces}}` so they can be filled from a CLI, a web form, or the agent runtime.

## How to invoke

On your Windows machine where all 325 skills live, run Claude Code CLI in the repo root and paste the full prompt. Claude will auto route to the named skill. From the web sandbox the prompts still document exactly what to run and which skill to pick.

## Files

- `offer-prompts.md`
- `pipeline-prompts.md`
- `content-prompts.md`
- `ad-prompts.md`
- `sales-prompts.md`
- `delivery-prompts.md`
- `memory-prompts.md`
