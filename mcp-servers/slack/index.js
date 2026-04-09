#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── Configuration ──────────────────────────────────────────────────────────
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";
const DEFAULT_CHANNEL = process.env.SLACK_DEFAULT_CHANNEL || "";
const APPROVAL_CHANNEL = process.env.SLACK_APPROVAL_CHANNEL || DEFAULT_CHANNEL;

// ── Slack API Client ───────────────────────────────────────────────────────

async function slackAPI(method, body = {}) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack API error (${method}): ${data.error}`);
  }
  return data;
}

// ── Message Formatting ─────────────────────────────────────────────────────

function formatClientReport({ client, system, status, found, changed, needsApproval, nextMove }) {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `${client} - ${system}` },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Status:*\n${status}` },
        { type: "mrkdwn", text: `*System:*\n${system}` },
      ],
    },
  ];

  if (found) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*What I found:*\n${found}` },
    });
  }

  if (changed) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*What I changed:*\n${changed}` },
    });
  }

  if (needsApproval) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:warning: *Needs your approval:*\n${needsApproval}`,
      },
    });
  }

  if (nextMove) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Recommended next move:*\n${nextMove}` },
    });
  }

  blocks.push({ type: "divider" });

  return blocks;
}

function formatUrgentAlert({ client, issue, impact, recommendation }) {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: `:rotating_light: URGENT - ${client}` },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Issue:* ${issue}\n*Impact:* ${impact}\n*Recommendation:* ${recommendation}`,
      },
    },
    { type: "divider" },
  ];
}

// ── Tool Implementations ───────────────────────────────────────────────────

async function sendClientReport(channel, report) {
  const blocks = formatClientReport(report);
  const text = `${report.client} - ${report.system}: ${report.status}`;

  return slackAPI("chat.postMessage", {
    channel: channel || DEFAULT_CHANNEL,
    text,
    blocks,
  });
}

async function sendUrgentAlert(channel, alert) {
  const blocks = formatUrgentAlert(alert);
  const text = `:rotating_light: URGENT - ${alert.client}: ${alert.issue}`;

  return slackAPI("chat.postMessage", {
    channel: channel || DEFAULT_CHANNEL,
    text,
    blocks,
  });
}

async function sendMessage(channel, message) {
  return slackAPI("chat.postMessage", {
    channel: channel || DEFAULT_CHANNEL,
    text: message,
  });
}

async function sendApprovalRequest(description, details, actionId) {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: ":clipboard: Approval Needed" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${description}*\n\n${details}`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve" },
          style: "primary",
          action_id: `approve_${actionId}`,
          value: actionId,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Reject" },
          style: "danger",
          action_id: `reject_${actionId}`,
          value: actionId,
        },
      ],
    },
    { type: "divider" },
  ];

  return slackAPI("chat.postMessage", {
    channel: APPROVAL_CHANNEL,
    text: `Approval needed: ${description}`,
    blocks,
  });
}

async function sendDailySummary(channel, summary) {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `:sunrise: Daily Marketing Summary` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: summary },
    },
    { type: "divider" },
  ];

  return slackAPI("chat.postMessage", {
    channel: channel || DEFAULT_CHANNEL,
    text: "Daily Marketing Summary",
    blocks,
  });
}

async function listChannels() {
  const data = await slackAPI("conversations.list", {
    types: "public_channel,private_channel",
    limit: 100,
  });
  return (data.channels || []).map((c) => ({
    id: c.id,
    name: c.name,
    is_private: c.is_private,
  }));
}

// ── MCP Server ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: "slack", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "send_client_report",
      description:
        "Send a structured client report to Slack. Use after completing an audit, making changes, or finding issues. Follows the standard format: client, system, status, what was found, what changed, what needs approval, next move.",
      inputSchema: {
        type: "object",
        properties: {
          channel: {
            type: "string",
            description: "Slack channel ID or name (uses default if not specified)",
          },
          client: { type: "string", description: "Client name" },
          system: {
            type: "string",
            description: "System involved: Google Ads, Semrush, WordPress, etc.",
          },
          status: {
            type: "string",
            description: "Current status: Audit Complete, Changes Made, Issue Found, Draft Ready, etc.",
          },
          found: { type: "string", description: "What was discovered (markdown supported)" },
          changed: { type: "string", description: "What actions were taken (markdown supported)" },
          needs_approval: {
            type: "string",
            description: "Items requiring manual approval (markdown supported)",
          },
          next_move: {
            type: "string",
            description: "Recommended next action (markdown supported)",
          },
        },
        required: ["client", "system", "status"],
      },
    },
    {
      name: "send_urgent_alert",
      description:
        "Send an urgent alert for critical issues: broken tracking, policy violations, major budget waste, site down, etc.",
      inputSchema: {
        type: "object",
        properties: {
          channel: { type: "string", description: "Slack channel (uses default if not specified)" },
          client: { type: "string", description: "Client name" },
          issue: { type: "string", description: "What's wrong" },
          impact: { type: "string", description: "Business impact of the issue" },
          recommendation: { type: "string", description: "What should be done" },
        },
        required: ["client", "issue", "impact", "recommendation"],
      },
    },
    {
      name: "send_message",
      description: "Send a simple text message to a Slack channel. Use for quick updates.",
      inputSchema: {
        type: "object",
        properties: {
          channel: { type: "string", description: "Slack channel (uses default if not specified)" },
          message: { type: "string", description: "Message text (markdown supported)" },
        },
        required: ["message"],
      },
    },
    {
      name: "send_approval_request",
      description:
        "Send an approval request with Approve/Reject buttons. Use when an action needs explicit sign-off before execution (publishing pages, budget changes, campaign launches).",
      inputSchema: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Short description of what needs approval",
          },
          details: {
            type: "string",
            description: "Detailed explanation of the proposed action",
          },
          action_id: {
            type: "string",
            description: "Unique identifier for this approval request",
          },
        },
        required: ["description", "details", "action_id"],
      },
    },
    {
      name: "send_daily_summary",
      description:
        "Send a daily marketing summary covering all clients. Use at the end of a morning audit cycle.",
      inputSchema: {
        type: "object",
        properties: {
          channel: { type: "string", description: "Slack channel (uses default if not specified)" },
          summary: {
            type: "string",
            description:
              "Full daily summary in markdown. Should cover: what's broken, what's underperforming, what was drafted, what needs approval.",
          },
        },
        required: ["summary"],
      },
    },
    {
      name: "list_channels",
      description: "List available Slack channels the bot has access to.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "send_client_report":
        result = await sendClientReport(args.channel, {
          client: args.client,
          system: args.system,
          status: args.status,
          found: args.found,
          changed: args.changed,
          needsApproval: args.needs_approval,
          nextMove: args.next_move,
        });
        break;
      case "send_urgent_alert":
        result = await sendUrgentAlert(args.channel, {
          client: args.client,
          issue: args.issue,
          impact: args.impact,
          recommendation: args.recommendation,
        });
        break;
      case "send_message":
        result = await sendMessage(args.channel, args.message);
        break;
      case "send_approval_request":
        result = await sendApprovalRequest(
          args.description,
          args.details,
          args.action_id
        );
        break;
      case "send_daily_summary":
        result = await sendDailySummary(args.channel, args.summary);
        break;
      case "list_channels":
        result = await listChannels();
        break;
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Slack MCP server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
