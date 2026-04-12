# Workflow: Memory

## Objective

Build and maintain the Obsidian second brain so knowledge compounds across sessions, clients, and quarters instead of being re derived every time.

## Strategy

Ingest everything. Link everything. Query everything. Review weekly. Synthesize quarterly. Treat the vault as the source of truth for Mohr Media.

## Skills Used

- llm-wiki
- cs-wiki-librarian
- cs-wiki-ingestor
- wiki-query
- wiki-ingest
- wiki-init
- wiki-lint
- wiki-log
- remember
- research-summarizer
- autoresearch-agent

## Agents Used

- memory-engine
- mohr-os-orchestrator
- every other agent as a producer of artifacts

## Execution Plan

### One time: vault init

1. Create the Obsidian vault with the structure from `04-Obsidian-Vault-Blueprint/folder-structure.md`
2. Install templates from `04-Obsidian-Vault-Blueprint/entity-templates.md`
3. Create the 10 MOCs from `04-Obsidian-Vault-Blueprint/mocs.md`
4. Run `wiki-init` to scaffold

### Continuous: ingest

1. Every artifact produced by any agent flows into `memory-engine` via prompt MP-01
2. `memory-engine` links to parent entities and updates MOCs
3. Every ingest writes a line into `99-Meta/Wiki-Log/`

### Weekly: digest and lint

1. Run prompt MP-04 to lint the vault
2. Run prompt MP-03 to produce the weekly insight digest
3. Operator reads digest during weekly review

### Quarterly: synthesis

1. Run prompt MP-05 for the quarterly synthesis
2. Archive anything older than 2 quarters that has no links
3. Update `MOC-Playbooks` with anything that earned its place

### On demand: query

Any agent can call prompt MP-02 to answer a cross session question using the vault as the only source.

## Assets Created

- Live Obsidian vault with full structure
- Weekly insight digests
- Quarterly synthesis docs
- Wiki log entry for every ingest
- Playbooks MOC that grows over time

## Next Actions

1. Initialize the vault within 48 hours of reading this
2. Make ingest non optional for every agent run
3. Never re derive insights a second time. If it was derived once, it lives in the vault.
