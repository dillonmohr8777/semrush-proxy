#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── Configuration ──────────────────────────────────────────────────────────
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "";
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || ""; // format: act_XXXXXXXXX
const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// ── Meta Marketing API Client ──────────────────────────────────────────────

async function metaFetch(endpoint, params = {}, method = "GET", body = null) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("access_token", ACCESS_TOKEN);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }

  const options = { method };
  if (body && method === "POST") {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), options);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Meta API error: ${data.error.message} (code: ${data.error.code})`);
  }

  return data;
}

// ── Tool Implementations ───────────────────────────────────────────────────

// Account & Campaigns
async function getAdAccount(accountId) {
  const id = accountId || AD_ACCOUNT_ID;
  return metaFetch(`/${id}`, {
    fields: "name,account_id,account_status,currency,timezone_name,balance,amount_spent,business_name",
  });
}

async function listCampaigns(accountId, status = null) {
  const id = accountId || AD_ACCOUNT_ID;
  const params = {
    fields: "name,status,objective,daily_budget,lifetime_budget,budget_remaining,created_time,updated_time,effective_status,special_ad_categories",
    limit: 50,
  };
  if (status) params.filtering = [{ field: "effective_status", operator: "IN", value: [status] }];
  return metaFetch(`/${id}/campaigns`, params);
}

async function getCampaignInsights(campaignId, dateRange = "last_30d") {
  const params = {
    fields: "campaign_name,impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,cost_per_action_type,conversions,conversion_values",
    date_preset: dateRange,
  };
  return metaFetch(`/${campaignId}/insights`, params);
}

// Ad Sets
async function listAdSets(campaignId) {
  return metaFetch(`/${campaignId}/adsets`, {
    fields: "name,status,effective_status,daily_budget,lifetime_budget,targeting,optimization_goal,bid_strategy,start_time,end_time,budget_remaining",
    limit: 50,
  });
}

async function getAdSetInsights(adSetId, dateRange = "last_30d") {
  return metaFetch(`/${adSetId}/insights`, {
    fields: "adset_name,impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,cost_per_action_type",
    date_preset: dateRange,
  });
}

// Ads
async function listAds(adSetId) {
  return metaFetch(`/${adSetId}/ads`, {
    fields: "name,status,effective_status,creative,tracking_specs,conversion_specs",
    limit: 50,
  });
}

async function getAdInsights(adId, dateRange = "last_30d") {
  return metaFetch(`/${adId}/insights`, {
    fields: "ad_name,impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,cost_per_action_type",
    date_preset: dateRange,
  });
}

async function getAdCreative(creativeId) {
  return metaFetch(`/${creativeId}`, {
    fields: "name,title,body,call_to_action_type,image_url,thumbnail_url,link_url,object_story_spec,url_tags,effective_object_story_id",
  });
}

// Audience & Targeting
async function getTargetingSearch(query, type = "adinterest") {
  return metaFetch("/search", {
    type,
    q: query,
  });
}

async function getCustomAudiences(accountId) {
  const id = accountId || AD_ACCOUNT_ID;
  return metaFetch(`/${id}/customaudiences`, {
    fields: "name,approximate_count,data_source,delivery_status,operation_status,subtype",
    limit: 50,
  });
}

// Pixel
async function getPixels(accountId) {
  const id = accountId || AD_ACCOUNT_ID;
  return metaFetch(`/${id}/adspixels`, {
    fields: "name,id,code,creation_time,last_fired_time,is_created_by_business,data_use_setting",
  });
}

async function getPixelStats(pixelId, dateRange = "last_30d") {
  return metaFetch(`/${pixelId}/stats`, {
    start_time: getDateFromPreset(dateRange, "start"),
    end_time: getDateFromPreset(dateRange, "end"),
  });
}

async function getPixelEvents(pixelId) {
  return metaFetch(`/${pixelId}/assigned_users`, {
    fields: "name,id",
  });
}

function getPixelInstallCode(pixelId) {
  return `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`;
}

// Reporting
async function getAccountInsights(accountId, dateRange = "last_30d", breakdowns = null) {
  const id = accountId || AD_ACCOUNT_ID;
  const params = {
    fields: "account_name,impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,cost_per_action_type,conversions,conversion_values,purchase_roas",
    date_preset: dateRange,
    level: "account",
  };
  if (breakdowns) params.breakdowns = breakdowns;
  return metaFetch(`/${id}/insights`, params);
}

async function getAgeDemographics(accountId, campaignId, dateRange = "last_30d") {
  const id = campaignId || accountId || AD_ACCOUNT_ID;
  return metaFetch(`/${id}/insights`, {
    fields: "impressions,clicks,spend,actions,ctr,cpc",
    breakdowns: "age,gender",
    date_preset: dateRange,
  });
}

async function getPlacementBreakdown(accountId, campaignId, dateRange = "last_30d") {
  const id = campaignId || accountId || AD_ACCOUNT_ID;
  return metaFetch(`/${id}/insights`, {
    fields: "impressions,clicks,spend,actions,ctr,cpc",
    breakdowns: "publisher_platform,platform_position",
    date_preset: dateRange,
  });
}

// Helper for date ranges
function getDateFromPreset(preset, which) {
  const now = new Date();
  const end = Math.floor(now.getTime() / 1000);
  let start;

  switch (preset) {
    case "last_7d":
      start = end - 7 * 86400;
      break;
    case "last_14d":
      start = end - 14 * 86400;
      break;
    case "last_30d":
    default:
      start = end - 30 * 86400;
      break;
    case "last_90d":
      start = end - 90 * 86400;
      break;
  }

  return which === "start" ? start : end;
}

// ── MCP Server ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: "meta-ads", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_ad_account",
      description:
        "Get Meta ad account info: name, status, currency, timezone, balance, total spend.",
      inputSchema: {
        type: "object",
        properties: {
          account_id: { type: "string", description: "Ad account ID (act_XXXX). Uses default if not specified." },
        },
      },
    },
    {
      name: "list_campaigns",
      description:
        "List all campaigns in a Meta ad account with status, objective, budget, and dates.",
      inputSchema: {
        type: "object",
        properties: {
          account_id: { type: "string", description: "Ad account ID (optional)" },
          status: { type: "string", description: "Filter by status: ACTIVE, PAUSED, ARCHIVED (optional)" },
        },
      },
    },
    {
      name: "campaign_insights",
      description:
        "Get performance data for a campaign: impressions, clicks, spend, CPC, CTR, reach, conversions, cost per action.",
      inputSchema: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "Campaign ID" },
          date_range: {
            type: "string",
            description: "Date range: last_7d, last_14d, last_30d, last_90d (default: last_30d)",
          },
        },
        required: ["campaign_id"],
      },
    },
    {
      name: "list_ad_sets",
      description:
        "List all ad sets in a campaign with targeting, budget, optimization goal, and status.",
      inputSchema: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "Campaign ID" },
        },
        required: ["campaign_id"],
      },
    },
    {
      name: "ad_set_insights",
      description:
        "Get performance data for a specific ad set.",
      inputSchema: {
        type: "object",
        properties: {
          ad_set_id: { type: "string", description: "Ad set ID" },
          date_range: { type: "string", description: "Date range (default: last_30d)" },
        },
        required: ["ad_set_id"],
      },
    },
    {
      name: "list_ads",
      description:
        "List all ads in an ad set with status, creative info, and tracking specs.",
      inputSchema: {
        type: "object",
        properties: {
          ad_set_id: { type: "string", description: "Ad set ID" },
        },
        required: ["ad_set_id"],
      },
    },
    {
      name: "ad_insights",
      description:
        "Get performance data for a specific ad.",
      inputSchema: {
        type: "object",
        properties: {
          ad_id: { type: "string", description: "Ad ID" },
          date_range: { type: "string", description: "Date range (default: last_30d)" },
        },
        required: ["ad_id"],
      },
    },
    {
      name: "get_ad_creative",
      description:
        "Get the creative details for an ad: headline, body, CTA, image URL, link URL.",
      inputSchema: {
        type: "object",
        properties: {
          creative_id: { type: "string", description: "Creative ID" },
        },
        required: ["creative_id"],
      },
    },
    {
      name: "get_pixels",
      description:
        "List all Meta pixels on the ad account. Shows pixel ID, name, last fired time, and creation date. Use this to check if tracking is set up.",
      inputSchema: {
        type: "object",
        properties: {
          account_id: { type: "string", description: "Ad account ID (optional)" },
        },
      },
    },
    {
      name: "get_pixel_install_code",
      description:
        "Generate the Meta Pixel base code for installation on a website. Returns the HTML/JS snippet to add to the site header.",
      inputSchema: {
        type: "object",
        properties: {
          pixel_id: { type: "string", description: "Meta Pixel ID" },
        },
        required: ["pixel_id"],
      },
    },
    {
      name: "get_pixel_stats",
      description:
        "Get firing stats for a Meta pixel - shows if events are being received and which events are firing.",
      inputSchema: {
        type: "object",
        properties: {
          pixel_id: { type: "string", description: "Meta Pixel ID" },
          date_range: { type: "string", description: "Date range (default: last_30d)" },
        },
        required: ["pixel_id"],
      },
    },
    {
      name: "account_insights",
      description:
        "Get account-level performance summary: total spend, impressions, clicks, conversions, ROAS across all campaigns.",
      inputSchema: {
        type: "object",
        properties: {
          account_id: { type: "string", description: "Ad account ID (optional)" },
          date_range: { type: "string", description: "Date range (default: last_30d)" },
          breakdowns: { type: "string", description: "Breakdowns: age, gender, country, publisher_platform (optional)" },
        },
      },
    },
    {
      name: "demographics_breakdown",
      description:
        "Get age and gender breakdown for campaign or account performance. Shows which demographics convert best.",
      inputSchema: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "Campaign ID (optional - uses account level if omitted)" },
          account_id: { type: "string", description: "Ad account ID (optional)" },
          date_range: { type: "string", description: "Date range (default: last_30d)" },
        },
      },
    },
    {
      name: "placement_breakdown",
      description:
        "Get performance by placement (Facebook Feed, Instagram Stories, Reels, Audience Network, etc). Shows where ads perform best.",
      inputSchema: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "Campaign ID (optional)" },
          account_id: { type: "string", description: "Ad account ID (optional)" },
          date_range: { type: "string", description: "Date range (default: last_30d)" },
        },
      },
    },
    {
      name: "search_targeting",
      description:
        "Search for targeting interests, behaviors, or demographics to use in ad sets. Returns matching options with audience sizes.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (e.g., 'bar crawl', 'home renovation')" },
          type: {
            type: "string",
            description: "Type: adinterest, adinterestsuggestion, adTargetingCategory (default: adinterest)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "list_custom_audiences",
      description:
        "List all custom audiences on the account: lookalikes, website visitors, customer lists, etc.",
      inputSchema: {
        type: "object",
        properties: {
          account_id: { type: "string", description: "Ad account ID (optional)" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "get_ad_account":
        result = await getAdAccount(args.account_id);
        break;
      case "list_campaigns":
        result = await listCampaigns(args.account_id, args.status);
        break;
      case "campaign_insights":
        result = await getCampaignInsights(args.campaign_id, args.date_range);
        break;
      case "list_ad_sets":
        result = await listAdSets(args.campaign_id);
        break;
      case "ad_set_insights":
        result = await getAdSetInsights(args.ad_set_id, args.date_range);
        break;
      case "list_ads":
        result = await listAds(args.ad_set_id);
        break;
      case "ad_insights":
        result = await getAdInsights(args.ad_id, args.date_range);
        break;
      case "get_ad_creative":
        result = await getAdCreative(args.creative_id);
        break;
      case "get_pixels":
        result = await getPixels(args.account_id);
        break;
      case "get_pixel_install_code": {
        const code = getPixelInstallCode(args.pixel_id);
        result = { pixel_id: args.pixel_id, install_code: code };
        break;
      }
      case "get_pixel_stats":
        result = await getPixelStats(args.pixel_id, args.date_range);
        break;
      case "account_insights":
        result = await getAccountInsights(args.account_id, args.date_range, args.breakdowns);
        break;
      case "demographics_breakdown":
        result = await getAgeDemographics(args.account_id, args.campaign_id, args.date_range);
        break;
      case "placement_breakdown":
        result = await getPlacementBreakdown(args.account_id, args.campaign_id, args.date_range);
        break;
      case "search_targeting":
        result = await getTargetingSearch(args.query, args.type);
        break;
      case "list_custom_audiences":
        result = await getCustomAudiences(args.account_id);
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
  console.error("Meta Ads MCP server running (OBSERVE MODE)");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
