# SOP: Vault Ingest

Owner: memory-engine
Trigger: Any agent produces a named artifact
Cadence: Continuous
Inputs: Artifact, source, date, tags, parent entity
Outputs: Note created in vault, MOCs updated, links resolved
Failure modes: Orphan notes, missing tags, duplicated entities, broken links

## Steps

1. Receive artifact with required metadata
2. Identify parent entities (client, offer, channel, experiment)
3. Create or update entity pages
4. Create the artifact note under the correct folder inside the Obsidian vault
5. Add tags from the tagging system in `04-Obsidian-Vault-Blueprint/tagging-system.md`
6. Link back to parent entities
7. Update relevant MOCs
8. Run wiki-lint on touched files
9. Log the ingest in the wiki-log

## Required metadata on every ingest

- source
- date
- author or agent
- parent entity slug
- tags minimum 2

## Definition of done

- Note exists in correct folder
- Parent entities linked
- MOCs updated
- Lint passes
- Wiki log entry recorded
