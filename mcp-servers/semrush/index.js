#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── Configuration ──────────────────────────────────────────────────────────
const SEMRUSH_API_KEY = process.env.SEMRUSH_API_KEY || "";
const SEMRUSH_API_BASE = "https://api.semrush.com";

// ── Semrush API Client ─────────────────────────────────────────────────────

async function semrushRequest(params) {
  const query = new URLSearchParams({
    key: SEMRUSH_API_KEY,
    ...params,
  });

  const response = await fetch(`${SEMRUSH_API_BASE}/?${query}`);
  const text = await response.text();

  if (!response.ok || text.startsWith("ERROR")) {
    throw new Error(`Semrush API error: ${text.trim()}`);
  }

  return text;
}

function parseSemrushResponse(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(";");
  return lines.slice(1).map((line) => {
    const values = line.split(";");
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
}

// ── Tool Implementations ───────────────────────────────────────────────────

async function domainOverview(domain, database = "us") {
  const text = await semrushRequest({
    type: "domain_ranks",
    domain,
    database,
    export_columns:
      "Db,Dt,Dn,Rk,Or,Ot,Oc,Ad,At,Ac,Sh,Sv",
  });
  return parseSemrushResponse(text);
}

async function domainOrganicKeywords(domain, database = "us", limit = 20) {
  const text = await semrushRequest({
    type: "domain_organic",
    domain,
    database,
    display_limit: String(limit),
    export_columns: "Ph,Po,Pp,Pd,Nq,Cp,Ur,Tr,Tc,Co,Nr,Td",
    display_sort: "tr_desc",
  });
  return parseSemrushResponse(text);
}

async function domainPaidKeywords(domain, database = "us", limit = 20) {
  const text = await semrushRequest({
    type: "domain_adwords",
    domain,
    database,
    display_limit: String(limit),
    export_columns: "Ph,Po,Pp,Nq,Cp,Tr,Tc,Co,Nr,Td,Ur",
    display_sort: "tr_desc",
  });
  return parseSemrushResponse(text);
}

async function keywordOverview(keyword, database = "us") {
  const text = await semrushRequest({
    type: "phrase_all",
    phrase: keyword,
    database,
    export_columns: "Ph,Nq,Cp,Co,Nr,Td",
  });
  return parseSemrushResponse(text);
}

async function keywordIdeas(keyword, database = "us", limit = 20) {
  const text = await semrushRequest({
    type: "phrase_related",
    phrase: keyword,
    database,
    display_limit: String(limit),
    export_columns: "Ph,Nq,Cp,Co,Nr,Td",
    display_sort: "nq_desc",
  });
  return parseSemrushResponse(text);
}

async function keywordQuestions(keyword, database = "us", limit = 20) {
  const text = await semrushRequest({
    type: "phrase_questions",
    phrase: keyword,
    database,
    display_limit: String(limit),
    export_columns: "Ph,Nq,Cp,Co,Nr,Td",
    display_sort: "nq_desc",
  });
  return parseSemrushResponse(text);
}

async function competitorDomains(domain, database = "us", limit = 10) {
  const text = await semrushRequest({
    type: "domain_organic_organic",
    domain,
    database,
    display_limit: String(limit),
    export_columns: "Dn,Cr,Np,Or,Ot,Oc,Ad",
  });
  return parseSemrushResponse(text);
}

async function keywordGap(domains, database = "us", limit = 20) {
  // domains should be an array of up to 5 domains
  const params = {
    type: "domain_domains",
    domains: domains
      .map((d, i) => `${i === 0 ? "+" : "-"}|or|${d}`)
      .join("|*|"),
    database,
    display_limit: String(limit),
    export_columns: "Ph,Nq,Cp,Co,Nr,Td," + domains.map((_, i) => `P${i}`).join(","),
    display_sort: "nq_desc",
  };
  const text = await semrushRequest(params);
  return parseSemrushResponse(text);
}

async function backlinks(domain, limit = 20) {
  const text = await semrushRequest({
    type: "backlinks",
    target: domain,
    target_type: "root_domain",
    display_limit: String(limit),
    export_columns:
      "source_url,source_title,external_num,internal_num,last_seen,first_seen,anchor,target_url",
  });
  return parseSemrushResponse(text);
}

async function urlOrganicKeywords(url, database = "us", limit = 20) {
  const text = await semrushRequest({
    type: "url_organic",
    url,
    database,
    display_limit: String(limit),
    export_columns: "Ph,Po,Pp,Nq,Cp,Tr,Tc,Co,Nr,Td",
    display_sort: "tr_desc",
  });
  return parseSemrushResponse(text);
}

// ── MCP Server ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: "semrush", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "domain_overview",
      description:
        "Get a high-level overview of a domain's SEO and paid search performance. Returns rank, organic traffic, paid traffic, costs, and search visibility.",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Domain to analyze (e.g., 'example.com')" },
          database: { type: "string", description: "Country database (default: 'us')", default: "us" },
        },
        required: ["domain"],
      },
    },
    {
      name: "domain_organic_keywords",
      description:
        "Get the top organic keywords a domain ranks for. Shows positions, search volume, traffic share, competition, and ranking URLs.",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Domain to analyze" },
          database: { type: "string", description: "Country database (default: 'us')" },
          limit: { type: "number", description: "Number of results (default: 20, max: 100)" },
        },
        required: ["domain"],
      },
    },
    {
      name: "domain_paid_keywords",
      description:
        "Get keywords a domain is bidding on in Google Ads. Shows ad positions, search volume, CPC, traffic, and landing URLs.",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Domain to analyze" },
          database: { type: "string", description: "Country database (default: 'us')" },
          limit: { type: "number", description: "Number of results (default: 20, max: 100)" },
        },
        required: ["domain"],
      },
    },
    {
      name: "keyword_overview",
      description:
        "Get data for a specific keyword: search volume, CPC, competition, number of results, and trend.",
      inputSchema: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Keyword to research" },
          database: { type: "string", description: "Country database (default: 'us')" },
        },
        required: ["keyword"],
      },
    },
    {
      name: "keyword_ideas",
      description:
        "Get related keyword ideas based on a seed keyword. Returns semantically related keywords with volume, CPC, and competition data.",
      inputSchema: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Seed keyword" },
          database: { type: "string", description: "Country database (default: 'us')" },
          limit: { type: "number", description: "Number of results (default: 20)" },
        },
        required: ["keyword"],
      },
    },
    {
      name: "keyword_questions",
      description:
        "Get question-based keyword ideas (who, what, where, when, why, how). Great for content planning and FAQ pages.",
      inputSchema: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Seed keyword" },
          database: { type: "string", description: "Country database (default: 'us')" },
          limit: { type: "number", description: "Number of results (default: 20)" },
        },
        required: ["keyword"],
      },
    },
    {
      name: "competitor_domains",
      description:
        "Find organic search competitors for a domain. Shows overlap, competing keywords, and relative visibility.",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Domain to find competitors for" },
          database: { type: "string", description: "Country database (default: 'us')" },
          limit: { type: "number", description: "Number of results (default: 10)" },
        },
        required: ["domain"],
      },
    },
    {
      name: "keyword_gap",
      description:
        "Compare keyword profiles between domains. First domain is your site, remaining are competitors. Shows keywords competitors rank for that you don't.",
      inputSchema: {
        type: "object",
        properties: {
          domains: {
            type: "array",
            items: { type: "string" },
            description: "Array of domains to compare (first = your domain, rest = competitors, max 5)",
          },
          database: { type: "string", description: "Country database (default: 'us')" },
          limit: { type: "number", description: "Number of results (default: 20)" },
        },
        required: ["domains"],
      },
    },
    {
      name: "backlinks",
      description:
        "Get backlink data for a domain. Shows referring URLs, anchors, first/last seen dates.",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Domain to check backlinks for" },
          limit: { type: "number", description: "Number of results (default: 20)" },
        },
        required: ["domain"],
      },
    },
    {
      name: "url_organic_keywords",
      description:
        "Get organic keywords for a specific URL/landing page. Use this to audit landing page keyword coverage and identify gaps.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL to analyze" },
          database: { type: "string", description: "Country database (default: 'us')" },
          limit: { type: "number", description: "Number of results (default: 20)" },
        },
        required: ["url"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "domain_overview":
        result = await domainOverview(args.domain, args.database);
        break;
      case "domain_organic_keywords":
        result = await domainOrganicKeywords(args.domain, args.database, args.limit);
        break;
      case "domain_paid_keywords":
        result = await domainPaidKeywords(args.domain, args.database, args.limit);
        break;
      case "keyword_overview":
        result = await keywordOverview(args.keyword, args.database);
        break;
      case "keyword_ideas":
        result = await keywordIdeas(args.keyword, args.database, args.limit);
        break;
      case "keyword_questions":
        result = await keywordQuestions(args.keyword, args.database, args.limit);
        break;
      case "competitor_domains":
        result = await competitorDomains(args.domain, args.database, args.limit);
        break;
      case "keyword_gap":
        result = await keywordGap(args.domains, args.database, args.limit);
        break;
      case "backlinks":
        result = await backlinks(args.domain, args.limit);
        break;
      case "url_organic_keywords":
        result = await urlOrganicKeywords(args.url, args.database, args.limit);
        break;
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
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
  console.error("Semrush MCP server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
