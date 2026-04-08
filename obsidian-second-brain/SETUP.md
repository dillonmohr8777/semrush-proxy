# Obsidian Second Brain - Setup Guide

## What This Is

A system that connects Claude Code to your Obsidian vault, turning it into an AI-powered second brain. Claude can read, write, search, and organize your notes.

**Architecture:** Obsidian → Local REST API plugin → MCP Server → Claude Code

## Quick Start (15 minutes)

### Step 1: Set Up Obsidian

1. Download and install [Obsidian](https://obsidian.md)
2. Create a new vault called **Dillon OS** (or whatever you want)
3. Copy the contents of `vault/` into your new Obsidian vault:
   - All the `00_Inbox` through `08_Assets` folders
   - The `_templates` folder

### Step 2: Install the Local REST API Plugin

1. In Obsidian: Settings → Community plugins → Browse
2. Search for **"Local REST API"**
3. Install and enable it
4. Go to the plugin settings and **copy your API key**
5. Note: The default URL is `https://127.0.0.1:27124`

### Step 3: Install the MCP Server

```bash
cd obsidian-second-brain/mcp-server
npm install
```

### Step 4: Configure Claude Code

Add the MCP server to your Claude Code config. Edit your `~/.claude/settings.json` (or project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "obsidian-second-brain": {
      "command": "node",
      "args": ["/FULL/PATH/TO/obsidian-second-brain/mcp-server/index.js"],
      "env": {
        "OBSIDIAN_API_URL": "https://127.0.0.1:27124",
        "OBSIDIAN_API_KEY": "YOUR_API_KEY_FROM_STEP_2"
      }
    }
  }
}
```

Replace:
- `/FULL/PATH/TO/` with the actual absolute path
- `YOUR_API_KEY_FROM_STEP_2` with the API key from the plugin settings

### Step 5: Add the System Prompt

Copy the contents of `system-prompt.md` into your project's `CLAUDE.md` file so Claude knows how to work with your vault.

### Step 6: Test It

Restart Claude Code, then try:

```
"Create a daily note for today"
"List all notes in my vault"
"Create a new client note for Acme Corp"
```

## Available Tools

Once connected, Claude Code gets these tools:

| Tool | What It Does |
|------|-------------|
| `read_note` | Read any note from your vault |
| `write_note` | Create a new note |
| `append_to_note` | Add content to an existing note |
| `replace_note` | Overwrite an entire note |
| `search_notes` | Full-text search across all notes |
| `list_notes` | List files in a folder |
| `delete_note` | Delete a note |
| `create_from_template` | Create a note from a template (client, meeting, content-idea, daily-note, campaign, sop, offer) |
| `get_active_note` | Read whatever note is open in Obsidian right now |
| `process_inbox` | List unprocessed notes in your inbox |
| `daily_note` | Create or retrieve today's daily note |

## Vault Structure

```
/00_Inbox        → Dump anything here. Claude processes it.
/01_Clients      → Client profiles + meeting notes
/02_Campaigns    → Campaign tracking
/03_Content      → Content ideas and drafts
/04_SOPs         → Standard operating procedures
/05_Offers       → Service offers and pricing
/06_Personal     → Personal notes
/07_Daily_Notes  → Daily journals (YYYY-MM-DD.md)
/08_Assets       → Reference materials
/_templates      → Note templates
```

## Templates

Templates auto-fill `{{variables}}` when you use `create_from_template`:

- **client** → `{{Name}}` → saved to `01_Clients/`
- **meeting** → `{{Client}}`, `{{Date}}` → saved to `01_Clients/`
- **content-idea** → saved to `03_Content/`
- **daily-note** → `{{Date}}` → saved to `07_Daily_Notes/`
- **campaign** → `{{Name}}` → saved to `02_Campaigns/`
- **sop** → `{{Title}}` → saved to `04_SOPs/`
- **offer** → `{{Name}}` → saved to `05_Offers/`

## Example Workflows

### Dump Messy Meeting Notes

```
"Here are my meeting notes with John from Acme:
talked about SEO audit, they want to start in 2 weeks,
budget is 3k/month, need to send proposal by Friday,
also discussed running Google Ads for their new product launch"
```

Claude will:
1. Create a structured meeting note in `01_Clients/`
2. Update/create the Acme Corp client note
3. Extract action items (send proposal by Friday)
4. Offer to draft the proposal

### Daily Review

```
"Give me my daily review"
```

Claude will:
1. Create today's daily note
2. Pull open tasks from all client notes
3. Summarize active campaigns
4. Flag overdue items

### Content Creation

```
"Turn my notes about SEO strategy into 5 LinkedIn posts"
```

Claude will:
1. Search your vault for SEO-related notes
2. Generate 5 posts with hooks, angles, and CTAs
3. Save them as content notes

## Troubleshooting

**"Connection refused" errors:**
- Make sure Obsidian is running
- Make sure the Local REST API plugin is enabled
- Check that the port (27124) matches

**"Unauthorized" errors:**
- Double-check your API key in the Claude Code config
- Regenerate the key in the plugin settings if needed

**SSL/Certificate errors:**
- The Local REST API uses a self-signed certificate
- If you get cert errors, set `NODE_TLS_REJECT_UNAUTHORIZED=0` in the env config (only for local use)

## Phase 2 Roadmap

Once V1 is working:
- [ ] Auto-process inbox notes on a schedule
- [ ] Auto-generate daily notes every morning
- [ ] Weekly review summaries
- [ ] Voice note transcription pipeline
- [ ] Revenue tracking across clients
- [ ] AI-suggested follow-ups and content ideas
