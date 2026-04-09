#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── Configuration ──────────────────────────────────────────────────────────
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || "";
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "";
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN || "";
const LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "";

const API_VERSION = "v17";
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;

// ── Auth ───────────────────────────────────────────────────────────────────

let cachedAccessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OAuth token refresh failed: ${error}`);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedAccessToken;
}

// ── Google Ads API Client (GAQL) ───────────────────────────────────────────

async function gaqlQuery(customerId, query) {
  const token = await getAccessToken();
  const cleanId = customerId.replace(/-/g, "");

  const response = await fetch(
    `${BASE_URL}/customers/${cleanId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": DEVELOPER_TOKEN,
        "login-customer-id": LOGIN_CUSTOMER_ID.replace(/-/g, ""),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Ads API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  // searchStream returns array of result batches
  const rows = [];
  if (Array.isArray(data)) {
    for (const batch of data) {
      if (batch.results) {
        rows.push(...batch.results);
      }
    }
  }
  return rows;
}

// ── Tool Implementations ───────────────────────────────────────────────────

async function listCampaigns(customerId) {
  return gaqlQuery(
    customerId,
    `SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      campaign_budget.amount_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_per_conversion
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC`
  );
}

async function campaignPerformance(customerId, campaignId, dateRange = "LAST_30_DAYS") {
  return gaqlQuery(
    customerId,
    `SELECT
      campaign.id,
      campaign.name,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_per_conversion,
      metrics.search_impression_share
    FROM campaign
    WHERE campaign.id = ${campaignId}
      AND segments.date DURING ${dateRange}
    ORDER BY segments.date DESC`
  );
}

async function adGroupPerformance(customerId, campaignId) {
  return gaqlQuery(
    customerId,
    `SELECT
      ad_group.id,
      ad_group.name,
      ad_group.status,
      ad_group.type,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_per_conversion
    FROM ad_group
    WHERE campaign.id = ${campaignId}
      AND ad_group.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC`
  );
}

async function searchTerms(customerId, campaignId, dateRange = "LAST_30_DAYS") {
  return gaqlQuery(
    customerId,
    `SELECT
      search_term_view.search_term,
      search_term_view.status,
      campaign.name,
      ad_group.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_per_conversion
    FROM search_term_view
    WHERE campaign.id = ${campaignId}
      AND segments.date DURING ${dateRange}
    ORDER BY metrics.cost_micros DESC
    LIMIT 100`
  );
}

async function keywordPerformance(customerId, campaignId) {
  return gaqlQuery(
    customerId,
    `SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.quality_info.quality_score,
      ad_group.name,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_per_conversion
    FROM keyword_view
    WHERE campaign.id = ${campaignId}
      AND ad_group_criterion.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC`
  );
}

async function adPerformance(customerId, campaignId) {
  return gaqlQuery(
    customerId,
    `SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.type,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.final_urls,
      ad_group_ad.status,
      ad_group_ad.policy_summary.approval_status,
      ad_group.name,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM ad_group_ad
    WHERE campaign.id = ${campaignId}
      AND ad_group_ad.status != 'REMOVED'
    ORDER BY metrics.impressions DESC`
  );
}

async function locationPerformance(customerId, campaignId, dateRange = "LAST_30_DAYS") {
  return gaqlQuery(
    customerId,
    `SELECT
      campaign.name,
      geographic_view.country_criterion_id,
      geographic_view.location_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.cost_per_conversion
    FROM geographic_view
    WHERE campaign.id = ${campaignId}
      AND segments.date DURING ${dateRange}
    ORDER BY metrics.cost_micros DESC
    LIMIT 50`
  );
}

async function conversionActions(customerId) {
  return gaqlQuery(
    customerId,
    `SELECT
      conversion_action.id,
      conversion_action.name,
      conversion_action.type,
      conversion_action.status,
      conversion_action.category,
      metrics.conversions,
      metrics.conversions_value,
      metrics.all_conversions
    FROM conversion_action
    ORDER BY metrics.conversions DESC`
  );
}

async function accountPerformance(customerId, dateRange = "LAST_30_DAYS") {
  return gaqlQuery(
    customerId,
    `SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_per_conversion,
      metrics.search_impression_share
    FROM customer
    WHERE segments.date DURING ${dateRange}
    ORDER BY segments.date DESC`
  );
}

async function listAccounts() {
  const token = await getAccessToken();
  const managerId = LOGIN_CUSTOMER_ID.replace(/-/g, "");

  const response = await fetch(
    `${BASE_URL}/customers/${managerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": DEVELOPER_TOKEN,
        "login-customer-id": managerId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `SELECT
          customer_client.id,
          customer_client.descriptive_name,
          customer_client.status,
          customer_client.manager,
          customer_client.currency_code,
          customer_client.time_zone
        FROM customer_client
        WHERE customer_client.status = 'ENABLED'
          AND customer_client.manager = false`,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Ads API error: ${error}`);
  }

  const data = await response.json();
  const rows = [];
  if (Array.isArray(data)) {
    for (const batch of data) {
      if (batch.results) rows.push(...batch.results);
    }
  }
  return rows;
}

// ── MCP Server ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: "google-ads", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_accounts",
      description:
        "List all Google Ads client accounts under the manager account. Returns account IDs, names, status, and timezone.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "list_campaigns",
      description:
        "List all active campaigns for a Google Ads account with performance metrics (impressions, clicks, cost, conversions, CTR, CPC).",
      inputSchema: {
        type: "object",
        properties: {
          customer_id: {
            type: "string",
            description: "Google Ads customer ID (e.g., '123-456-7890' or '1234567890')",
          },
        },
        required: ["customer_id"],
      },
    },
    {
      name: "campaign_performance",
      description:
        "Get daily performance data for a specific campaign over a date range. Shows impressions, clicks, cost, conversions, CTR, CPC, and impression share by day.",
      inputSchema: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "Google Ads customer ID" },
          campaign_id: { type: "string", description: "Campaign ID" },
          date_range: {
            type: "string",
            description:
              "Date range: LAST_7_DAYS, LAST_14_DAYS, LAST_30_DAYS, LAST_90_DAYS, THIS_MONTH, LAST_MONTH (default: LAST_30_DAYS)",
          },
        },
        required: ["customer_id", "campaign_id"],
      },
    },
    {
      name: "ad_group_performance",
      description:
        "Get performance data for all ad groups in a campaign. Shows which ad groups are performing and which are wasting budget.",
      inputSchema: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "Google Ads customer ID" },
          campaign_id: { type: "string", description: "Campaign ID" },
        },
        required: ["customer_id", "campaign_id"],
      },
    },
    {
      name: "search_terms",
      description:
        "Get search terms triggering ads in a campaign. Critical for finding wasted spend, negative keyword opportunities, and new keyword ideas.",
      inputSchema: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "Google Ads customer ID" },
          campaign_id: { type: "string", description: "Campaign ID" },
          date_range: { type: "string", description: "Date range (default: LAST_30_DAYS)" },
        },
        required: ["customer_id", "campaign_id"],
      },
    },
    {
      name: "keyword_performance",
      description:
        "Get keyword-level performance including Quality Score. Shows which keywords drive results and which have quality issues.",
      inputSchema: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "Google Ads customer ID" },
          campaign_id: { type: "string", description: "Campaign ID" },
        },
        required: ["customer_id", "campaign_id"],
      },
    },
    {
      name: "ad_performance",
      description:
        "Get ad-level performance data including headlines, descriptions, final URLs, and approval status. Identifies weak ads and policy issues.",
      inputSchema: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "Google Ads customer ID" },
          campaign_id: { type: "string", description: "Campaign ID" },
        },
        required: ["customer_id", "campaign_id"],
      },
    },
    {
      name: "location_performance",
      description:
        "Get geographic performance data for a campaign. Shows which locations drive conversions and which waste budget. Critical for local service businesses.",
      inputSchema: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "Google Ads customer ID" },
          campaign_id: { type: "string", description: "Campaign ID" },
          date_range: { type: "string", description: "Date range (default: LAST_30_DAYS)" },
        },
        required: ["customer_id", "campaign_id"],
      },
    },
    {
      name: "conversion_actions",
      description:
        "List all conversion actions for an account. Shows tracking setup, conversion types, and whether tracking is firing correctly.",
      inputSchema: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "Google Ads customer ID" },
        },
        required: ["customer_id"],
      },
    },
    {
      name: "account_performance",
      description:
        "Get account-level daily performance summary. High-level view of spend, conversions, and efficiency trends.",
      inputSchema: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "Google Ads customer ID" },
          date_range: { type: "string", description: "Date range (default: LAST_30_DAYS)" },
        },
        required: ["customer_id"],
      },
    },
    {
      name: "custom_query",
      description:
        "Run a custom GAQL (Google Ads Query Language) query. Use this for any reporting need not covered by other tools. Observe mode only - SELECT queries only.",
      inputSchema: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "Google Ads customer ID" },
          query: {
            type: "string",
            description: "GAQL query (SELECT only - no mutations allowed in observe mode)",
          },
        },
        required: ["customer_id", "query"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // OBSERVE MODE GUARD: Block any mutation queries
    if (name === "custom_query" && args.query) {
      const upper = args.query.trim().toUpperCase();
      if (!upper.startsWith("SELECT")) {
        return {
          content: [
            {
              type: "text",
              text: "BLOCKED: Only SELECT queries allowed in observe mode. Mutations require execute mode approval.",
            },
          ],
          isError: true,
        };
      }
    }

    let result;

    switch (name) {
      case "list_accounts":
        result = await listAccounts();
        break;
      case "list_campaigns":
        result = await listCampaigns(args.customer_id);
        break;
      case "campaign_performance":
        result = await campaignPerformance(args.customer_id, args.campaign_id, args.date_range);
        break;
      case "ad_group_performance":
        result = await adGroupPerformance(args.customer_id, args.campaign_id);
        break;
      case "search_terms":
        result = await searchTerms(args.customer_id, args.campaign_id, args.date_range);
        break;
      case "keyword_performance":
        result = await keywordPerformance(args.customer_id, args.campaign_id);
        break;
      case "ad_performance":
        result = await adPerformance(args.customer_id, args.campaign_id);
        break;
      case "location_performance":
        result = await locationPerformance(args.customer_id, args.campaign_id, args.date_range);
        break;
      case "conversion_actions":
        result = await conversionActions(args.customer_id);
        break;
      case "account_performance":
        result = await accountPerformance(args.customer_id, args.date_range);
        break;
      case "custom_query":
        result = await gaqlQuery(args.customer_id, args.query);
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
  console.error("Google Ads MCP server running (OBSERVE MODE)");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
