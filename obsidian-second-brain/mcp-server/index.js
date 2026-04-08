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
  meeting: "01_Clients",
  "content-idea": "03_Content",
  "daily-note": "07_Daily_Notes",
  campaign: "02_Campaigns",
  sop: "04_SOPs",
  offer: "05_Offers",
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
        "Create a new note from a template. Templates: client, meeting, content-idea, daily-note, campaign, sop, offer. Automatically places the note in the correct folder.",
      inputSchema: {
        type: "object",
        properties: {
          template: {
            type: "string",
            description:
              "Template name: client, meeting, content-idea, daily-note, campaign, sop, offer",
            enum: [
              "client",
              "meeting",
              "content-idea",
              "daily-note",
              "campaign",
              "sop",
              "offer",
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
