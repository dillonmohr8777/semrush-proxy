# Obsidian Vault Blueprint

The second brain that memory-engine owns. Built for compounding knowledge, not note taking.

## Design principles

1. Entities first, notes second. Every note links to at least one entity.
2. MOCs are the navigation layer. No folder tree replaces the MOCs.
3. Tags are limited and controlled. See `tagging-system.md`.
4. Every note has a source, date, and author.
5. Vault lints weekly. Orphans and broken links are real bugs.

## Files

- `folder-structure.md`
- `tagging-system.md`
- `daily-notes-template.md`
- `mocs.md`
- `entity-templates.md`

## How to initialize

1. Create a new Obsidian vault named `Mohr Media Second Brain`
2. Copy the folder structure from `folder-structure.md`
3. Install the MOC templates from `mocs.md`
4. Install the entity templates from `entity-templates.md`
5. Run `memory-engine` prompt MP-01 once to test ingest
