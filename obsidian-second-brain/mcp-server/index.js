#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── Configuration ──────────────────────────────────────────────────────────
const OBSIDIAN_API_URL = process.env.OBSIDIAN_API_URL || "https://127.0.0.1:27124";
const OBSIDIAN_API_KEY = process.env.OBSIDIAN_API_KEY || "";

// ── Obsidian REST API Client ───────────────────────────────────────────────
async function obsidianFetch(path, options = {}) {
  const url = `${OBSIDIAN_API_URL}${path}`;
  const headers = {
    Authorization: `Bearer ${OBSIDIAN_API_KEY}`,
    ...options.headers,
  };

  // The Local REST API uses a self-signed cert by default
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Obsidian API ${response.status}: ${body}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

// ── Tool Implementations ───────────────────────────────────────────────────

async function readNote(path) {
  const content = await obsidianFetch(`/vault/${encodeURIComponent(path)}`, {
    headers: { Accept: "text/markdown" },
  });
  return content;
}

async function writeNote(path, content) {
  await obsidianFetch(`/vault/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "text/markdown" },
    body: content,
  });
  return `Note created: ${path}`;
}

async function updateNote(path, content) {
  // PATCH appends content; for full replace we use PUT after reading
  await obsidianFetch(`/vault/${encodeURIComponent(path)}`, {
    method: "PATCH",
    headers: { "Content-Type": "text/markdown" },
    body: content,
  });
  return `Note updated: ${path}`;
}

async function replaceNote(path, content) {
  await obsidianFetch(`/vault/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "text/markdown" },
    body: content,
  });
  return `Note replaced: ${path}`;
}

async function searchNotes(query) {
  const results = await obsidianFetch(
    `/search/simple/?query=${encodeURIComponent(query)}`,
    { headers: { Accept: "application/json" } }
  );
  return results;
}

async function listNotes(folder) {
  const path = folder ? `/vault/${encodeURIComponent(folder)}/` : "/vault/";
  const results = await obsidianFetch(path, {
    headers: { Accept: "application/json" },
  });
  return results;
}

async function deleteNote(path) {
  await obsidianFetch(`/vault/${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
  return `Note deleted: ${path}`;
}

async function getActiveNote() {
  const result = await obsidianFetch("/active/", {
    headers: { Accept: "text/markdown" },
  });
  return result;
}

// ── Templates ──────────────────────────────────────────────────────────────

const TEMPLATES = {
  client: `# Client: {{Name}}

## Overview
- Industry:
- Services:
- Monthly Value:

## Active Work
-

## Campaigns
-

## Pain Points
-

## Opportunities
-

## Notes
-

## Next Actions
-

## Links
- `,

  meeting: `# Meeting - {{Client}} - {{Date}}

## Summary
-

## Key Points
-

## Decisions Made
-

## Action Items
- [ ]

## Follow Up Needed
-

## Raw Notes
-`,

  "content-idea": `# Content Idea

## Idea
-

## Platform
-

## Hook
-

## Angle
-

## CTA
-

## Notes
-`,

  "daily-note": `# {{Date}}

## Priorities
-

## Tasks
- [ ]

## Wins
-

## Notes
-`,

  campaign: `# Campaign: {{Name}}

## Client
-

## Objective
-

## Platform(s)
-

## Budget
-

## Timeline
- Start:
- End:

## KPIs
-

## Status
-

## Notes
-

## Results
-`,

  sop: `# SOP: {{Title}}

## Purpose
-

## When to Use
-

## Steps
1.
2.
3.

## Tools Needed
-

## Notes
-

## Last Updated
-`,

  offer: `# Offer: {{Name}}

## Description
-

## Target Audience
-

## Price
-

## Deliverables
-

## Timeline
-

## Positioning
-

## Objections & Responses
-

## Notes
-`,

  transcript: `# Transcript - {{Client}} - {{Date}}

## Call Type
-

## Participants
-

## Summary
-

## Key Points
-

## Decisions Made
-

## Action Items
- [ ]

## Quotes / Important Statements
-

## Follow Up Needed
-

## Raw Transcript
\`\`\`
{{Transcript}}
\`\`\``,

  "session-log": `# Session Log - {{Date}}

## What Was Done
-

## Clients Touched
-

## Actions Created
- [ ]

## Decisions Made
-

## Patterns Noticed
-

## What's Next
-`,

  "weekly-review": `# Weekly Review - {{Date}}

## Client Status Overview

### Hardwood Artisan
- Status:
- Key Metrics:
- What Changed:
- Next Actions:

### Omega Landscape
- Status:
- Key Metrics:
- What Changed:
- Next Actions:

### NKCDC
- Status:
- Key Metrics:
- What Changed:
- Next Actions:

### Bar Crawl USA
- Status:
- Key Metrics:
- What Changed:
- Next Actions:

### KJB
- Status:
- Key Metrics:
- What Changed:
- Next Actions:

## Wins This Week
-

## Problems Found
-

## Patterns Noticed
-

## Top Priorities Next Week
1.
2.
3.`,
};

function renderTemplate(templateName, variables = {}) {
  let content = TEMPLATES[templateName];
  if (!content) {
    throw new Error(
      `Unknown template: ${templateName}. Available: ${Object.keys(TEMPLATES).join(", ")}`
    );
  }
  for (const [key, value] of Object.entries(variables)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return content;
}

// ── Folder mapping for templates ───────────────────────────────────────────
const TEMPLATE_FOLDERS = {
  client: "01_Clients",
  meeting: "01_Clients/Meetings",
  "content-idea": "03_Content",
  "daily-note": "07_Daily_Notes",
  campaign: "02_Campaigns",
  sop: "04_SOPs",
  offer: "05_Offers",
  transcript: "09_Transcripts",
  "session-log": "10_Sessions",
  "weekly-review": "07_Daily_Notes",
};

// ── MCP Server Setup ───────────────────────────────────────────────────────

const server = new Server(
  { name: "obsidian-second-brain", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_note",
      description:
        "Read the contents of a note from the Obsidian vault. Provide the path relative to vault root (e.g., '01_Clients/Acme Corp.md').",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the note relative to vault root",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "write_note",
      description:
        "Create a new note in the Obsidian vault. Will overwrite if the note already exists. Provide path relative to vault root.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path for the new note relative to vault root",
          },
          content: {
            type: "string",
            description: "Markdown content for the note",
          },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "append_to_note",
      description:
        "Append content to an existing note in the Obsidian vault. Useful for adding items to lists, new sections, etc.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the note relative to vault root",
          },
          content: {
            type: "string",
            description: "Markdown content to append",
          },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "replace_note",
      description:
        "Completely replace the content of an existing note. Use when you need to rewrite/restructure an entire note.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the note relative to vault root",
          },
          content: {
            type: "string",
            description: "New markdown content for the note",
          },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "search_notes",
      description:
        "Search across all notes in the Obsidian vault. Returns matching notes and context.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query string",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "list_notes",
      description:
        "List all notes in a folder (or the entire vault if no folder specified). Returns file names and paths.",
      inputSchema: {
        type: "object",
        properties: {
          folder: {
            type: "string",
            description:
              "Folder path relative to vault root (e.g., '01_Clients'). Leave empty for vault root.",
          },
        },
      },
    },
    {
      name: "delete_note",
      description: "Delete a note from the Obsidian vault.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the note relative to vault root",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "create_from_template",
      description:
        "Create a new note from a template. Templates: client, meeting, content-idea, daily-note, campaign, sop, offer, transcript, session-log, weekly-review. Automatically places the note in the correct folder.",
      inputSchema: {
        type: "object",
        properties: {
          template: {
            type: "string",
            description:
              "Template name: client, meeting, content-idea, daily-note, campaign, sop, offer, transcript, session-log, weekly-review",
            enum: [
              "client",
              "meeting",
              "content-idea",
              "daily-note",
              "campaign",
              "sop",
              "offer",
              "transcript",
              "session-log",
              "weekly-review",
            ],
          },
          filename: {
            type: "string",
            description:
              "Filename for the note (without .md extension, e.g., 'Acme Corp')",
          },
          variables: {
            type: "object",
            description:
              "Template variables to fill in (e.g., {\"Name\": \"Acme Corp\", \"Date\": \"2025-01-15\"})",
            additionalProperties: { type: "string" },
          },
        },
        required: ["template", "filename"],
      },
    },
    {
      name: "get_active_note",
      description:
        "Get the contents of the currently active/open note in Obsidian.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "process_inbox",
      description:
        "List all notes in the 00_Inbox folder for processing. Use this to review unstructured notes that need to be organized.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "daily_note",
      description:
        "Create or get today's daily note. If it exists, returns it. If not, creates it from the daily-note template.",
      inputSchema: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description:
              "Date in YYYY-MM-DD format. Defaults to today if not provided.",
          },
        },
      },
    },
    {
      name: "read_memory_file",
      description:
        "Read the Memory File - the master context document. ALWAYS call this at the start of a session to load full context about who Dillon is, his clients, processes, preferences, routing rules, and accumulated learnings.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "update_memory_file",
      description:
        "Append a new learning, pattern, or important context to the Memory File's 'Patterns and Learnings' section. Use this when you discover something reusable across clients or sessions.",
      inputSchema: {
        type: "object",
        properties: {
          learning: {
            type: "string",
            description: "The pattern, learning, or context to add (will be prefixed with date)",
          },
        },
        required: ["learning"],
      },
    },
    {
      name: "process_transcript",
      description:
        "Process a raw meeting transcript. Creates a structured transcript note in 09_Transcripts, extracts action items, key decisions, and follow-ups. Returns the structured output for further routing (update client note, log decisions, create tasks).",
      inputSchema: {
        type: "object",
        properties: {
          client: {
            type: "string",
            description: "Client name this transcript is for",
          },
          raw_transcript: {
            type: "string",
            description: "The raw transcript text to process",
          },
          call_type: {
            type: "string",
            description: "Type of call: discovery, check-in, strategy, review, onboarding",
          },
          date: {
            type: "string",
            description: "Date of the call (YYYY-MM-DD). Defaults to today.",
          },
        },
        required: ["client", "raw_transcript"],
      },
    },
    {
      name: "log_session",
      description:
        "Log what was accomplished in this session. Creates a session log in 10_Sessions and appends a summary to today's daily note. Call this at the end of every meaningful work session.",
      inputSchema: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "What was done in this session",
          },
          clients_touched: {
            type: "array",
            items: { type: "string" },
            description: "List of clients worked on",
          },
          actions_created: {
            type: "array",
            items: { type: "string" },
            description: "New action items created",
          },
          decisions_made: {
            type: "array",
            items: { type: "string" },
            description: "Decisions that were made",
          },
          patterns: {
            type: "string",
            description: "Any patterns or learnings noticed",
          },
          next_steps: {
            type: "string",
            description: "What should happen next",
          },
        },
        required: ["summary"],
      },
    },
    {
      name: "get_open_actions",
      description:
        "Search across all client notes for open action items (unchecked checkboxes). Returns a consolidated list of everything that's pending across all clients.",
      inputSchema: {
        type: "object",
        properties: {
          client: {
            type: "string",
            description: "Filter to a specific client (optional - omit for all clients)",
          },
        },
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "read_note": {
        const content = await readNote(args.path);
        return { content: [{ type: "text", text: content }] };
      }

      case "write_note": {
        const result = await writeNote(args.path, args.content);
        return { content: [{ type: "text", text: result }] };
      }

      case "append_to_note": {
        const result = await updateNote(args.path, args.content);
        return { content: [{ type: "text", text: result }] };
      }

      case "replace_note": {
        const result = await replaceNote(args.path, args.content);
        return { content: [{ type: "text", text: result }] };
      }

      case "search_notes": {
        const results = await searchNotes(args.query);
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "list_notes": {
        const results = await listNotes(args.folder || "");
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "delete_note": {
        const result = await deleteNote(args.path);
        return { content: [{ type: "text", text: result }] };
      }

      case "create_from_template": {
        const content = renderTemplate(args.template, args.variables || {});
        const folder = TEMPLATE_FOLDERS[args.template] || "00_Inbox";
        const path = `${folder}/${args.filename}.md`;
        const result = await writeNote(path, content);
        return {
          content: [
            { type: "text", text: `${result}\nCreated from template: ${args.template}\nPath: ${path}` },
          ],
        };
      }

      case "get_active_note": {
        const content = await getActiveNote();
        return { content: [{ type: "text", text: content }] };
      }

      case "process_inbox": {
        const results = await listNotes("00_Inbox");
        const files = Array.isArray(results.files) ? results.files : [];
        if (files.length === 0) {
          return {
            content: [{ type: "text", text: "Inbox is empty. Nothing to process." }],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `Found ${files.length} note(s) in inbox:\n${files.map((f) => `- ${f}`).join("\n")}\n\nRead each note to categorize and restructure it.`,
            },
          ],
        };
      }

      case "daily_note": {
        const date =
          args.date || new Date().toISOString().split("T")[0];
        const path = `07_Daily_Notes/${date}.md`;
        try {
          const existing = await readNote(path);
          return {
            content: [
              { type: "text", text: `Daily note for ${date} already exists:\n\n${existing}` },
            ],
          };
        } catch {
          const content = renderTemplate("daily-note", { Date: date });
          await writeNote(path, content);
          return {
            content: [
              { type: "text", text: `Created daily note for ${date} at ${path}` },
            ],
          };
        }
      }

      case "read_memory_file": {
        try {
          const content = await readNote("00_Memory_File.md");
          return {
            content: [{ type: "text", text: content }],
          };
        } catch {
          return {
            content: [
              {
                type: "text",
                text: "Memory File not found at 00_Memory_File.md. Create one to enable persistent context.",
              },
            ],
          };
        }
      }

      case "update_memory_file": {
        const date = new Date().toISOString().split("T")[0];
        const entry = `\n- [${date}] ${args.learning}`;
        const result = await updateNote("00_Memory_File.md", entry);
        return {
          content: [
            {
              type: "text",
              text: `Learning added to Memory File: ${args.learning}`,
            },
          ],
        };
      }

      case "process_transcript": {
        const date = args.date || new Date().toISOString().split("T")[0];
        const content = renderTemplate("transcript", {
          Client: args.client,
          Date: date,
          Transcript: args.raw_transcript,
        });

        const filename = `${date} - ${args.client}${args.call_type ? ` - ${args.call_type}` : ""}`;
        const path = `09_Transcripts/${filename}.md`;
        await writeNote(path, content);

        return {
          content: [
            {
              type: "text",
              text: `Transcript saved to ${path}\n\nNext steps:\n1. Read the transcript to extract action items, decisions, and key points\n2. Update the client note at 01_Clients/${args.client}.md\n3. Log any decisions to the Decision Log\n4. Add action items to the client's Next Actions section\n5. Note any follow-ups needed`,
            },
          ],
        };
      }

      case "log_session": {
        const date = new Date().toISOString().split("T")[0];
        const clients = args.clients_touched || [];
        const actions = args.actions_created || [];
        const decisions = args.decisions_made || [];

        let sessionContent = `# Session Log - ${date}\n\n`;
        sessionContent += `## What Was Done\n${args.summary}\n\n`;
        sessionContent += `## Clients Touched\n${clients.length > 0 ? clients.map((c) => `- ${c}`).join("\n") : "- None"}\n\n`;
        sessionContent += `## Actions Created\n${actions.length > 0 ? actions.map((a) => `- [ ] ${a}`).join("\n") : "- None"}\n\n`;
        sessionContent += `## Decisions Made\n${decisions.length > 0 ? decisions.map((d) => `- ${d}`).join("\n") : "- None"}\n\n`;
        sessionContent += `## Patterns Noticed\n${args.patterns || "- None"}\n\n`;
        sessionContent += `## What's Next\n${args.next_steps || "- TBD"}\n`;

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const sessionPath = `10_Sessions/${date}-${timestamp.split("T")[1].slice(0, 8)}.md`;
        await writeNote(sessionPath, sessionContent);

        // Also append summary to today's daily note
        const dailySummary = `\n\n---\n### Session Summary (${new Date().toLocaleTimeString()})\n${args.summary}\n${actions.length > 0 ? "\nNew actions:\n" + actions.map((a) => `- [ ] ${a}`).join("\n") : ""}`;
        try {
          await updateNote(`07_Daily_Notes/${date}.md`, dailySummary);
        } catch {
          // Daily note might not exist yet, create it
          const dailyContent = renderTemplate("daily-note", { Date: date });
          await writeNote(`07_Daily_Notes/${date}.md`, dailyContent + dailySummary);
        }

        return {
          content: [
            {
              type: "text",
              text: `Session logged to ${sessionPath} and appended to daily note.\nClients: ${clients.join(", ") || "none"}\nActions: ${actions.length}\nDecisions: ${decisions.length}`,
            },
          ],
        };
      }

      case "get_open_actions": {
        // Search for unchecked checkboxes across the vault
        const searchFolder = args.client
          ? `01_Clients/${args.client}`
          : "01_Clients";
        try {
          const results = await searchNotes("- [ ]");
          return {
            content: [
              {
                type: "text",
                text: `Open actions found:\n${JSON.stringify(results, null, 2)}`,
              },
            ],
          };
        } catch {
          return {
            content: [
              {
                type: "text",
                text: "Could not search for open actions. Try searching manually with search_notes for '- [ ]'",
              },
            ],
          };
        }
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// ── Start ──────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Obsidian Second Brain MCP server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
