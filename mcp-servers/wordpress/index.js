#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── Configuration ──────────────────────────────────────────────────────────
// Supports multiple WordPress sites via JSON config
// WORDPRESS_SITES = [{"name":"client1","url":"https://...","username":"...","app_password":"..."}]
const SITES_JSON = process.env.WORDPRESS_SITES || "[]";
const DEFAULT_SITE_URL = process.env.WORDPRESS_URL || "";
const DEFAULT_USERNAME = process.env.WORDPRESS_USERNAME || "";
const DEFAULT_APP_PASSWORD = process.env.WORDPRESS_APP_PASSWORD || "";

let sites = [];
try {
  sites = JSON.parse(SITES_JSON);
} catch {
  // fall back to single-site config
}

if (sites.length === 0 && DEFAULT_SITE_URL) {
  sites.push({
    name: "default",
    url: DEFAULT_SITE_URL,
    username: DEFAULT_USERNAME,
    app_password: DEFAULT_APP_PASSWORD,
  });
}

function getSite(siteName) {
  if (!siteName && sites.length === 1) return sites[0];
  const site = sites.find(
    (s) => s.name.toLowerCase() === (siteName || "").toLowerCase()
  );
  if (!site) {
    const available = sites.map((s) => s.name).join(", ");
    throw new Error(
      `Site "${siteName}" not found. Available sites: ${available}`
    );
  }
  return site;
}

// ── WordPress REST API Client ──────────────────────────────────────────────

async function wpFetch(site, endpoint, options = {}) {
  const url = `${site.url.replace(/\/$/, "")}/wp-json/wp/v2${endpoint}`;
  const auth = Buffer.from(`${site.username}:${site.app_password}`).toString(
    "base64"
  );

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`WordPress API ${response.status}: ${body}`);
  }

  return response.json();
}

// ── Tool Implementations ───────────────────────────────────────────────────

async function listPages(siteName, params = {}) {
  const site = getSite(siteName);
  const query = new URLSearchParams({
    per_page: String(params.per_page || 50),
    status: params.status || "publish,draft,pending",
    orderby: params.orderby || "modified",
    order: "desc",
    ...params,
  });
  const pages = await wpFetch(site, `/pages?${query}`);
  return pages.map((p) => ({
    id: p.id,
    title: p.title?.rendered || "",
    slug: p.slug,
    status: p.status,
    link: p.link,
    modified: p.modified,
    template: p.template,
    parent: p.parent,
  }));
}

async function getPage(siteName, pageId) {
  const site = getSite(siteName);
  const page = await wpFetch(site, `/pages/${pageId}?context=edit`);
  return {
    id: page.id,
    title: page.title?.raw || page.title?.rendered || "",
    slug: page.slug,
    status: page.status,
    content: page.content?.raw || page.content?.rendered || "",
    excerpt: page.excerpt?.raw || "",
    link: page.link,
    modified: page.modified,
    template: page.template,
    parent: page.parent,
    meta: page.meta,
  };
}

async function createDraftPage(siteName, title, content, options = {}) {
  const site = getSite(siteName);
  const body = {
    title,
    content,
    status: "draft", // ALWAYS draft - never publish directly
    ...options,
  };

  // Force draft status regardless of what's passed
  body.status = "draft";

  const page = await wpFetch(site, "/pages", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    id: page.id,
    title: page.title?.rendered || title,
    slug: page.slug,
    status: page.status,
    link: page.link,
    edit_link: `${site.url}/wp-admin/post.php?post=${page.id}&action=edit`,
  };
}

async function updatePage(siteName, pageId, updates) {
  const site = getSite(siteName);

  // Block status changes to "publish" in draft mode
  if (updates.status && updates.status === "publish") {
    throw new Error(
      "BLOCKED: Cannot publish pages directly. Pages can only be set to draft or pending. Publishing requires manual approval."
    );
  }

  const page = await wpFetch(site, `/pages/${pageId}`, {
    method: "POST",
    body: JSON.stringify(updates),
  });

  return {
    id: page.id,
    title: page.title?.rendered || "",
    slug: page.slug,
    status: page.status,
    link: page.link,
    modified: page.modified,
  };
}

async function listPosts(siteName, params = {}) {
  const site = getSite(siteName);
  const query = new URLSearchParams({
    per_page: String(params.per_page || 20),
    status: params.status || "publish,draft,pending",
    orderby: params.orderby || "modified",
    order: "desc",
  });
  if (params.search) query.set("search", params.search);

  const posts = await wpFetch(site, `/posts?${query}`);
  return posts.map((p) => ({
    id: p.id,
    title: p.title?.rendered || "",
    slug: p.slug,
    status: p.status,
    link: p.link,
    modified: p.modified,
    categories: p.categories,
    tags: p.tags,
  }));
}

async function getPost(siteName, postId) {
  const site = getSite(siteName);
  const post = await wpFetch(site, `/posts/${postId}?context=edit`);
  return {
    id: post.id,
    title: post.title?.raw || post.title?.rendered || "",
    slug: post.slug,
    status: post.status,
    content: post.content?.raw || post.content?.rendered || "",
    excerpt: post.excerpt?.raw || "",
    link: post.link,
    modified: post.modified,
    categories: post.categories,
    tags: post.tags,
    meta: post.meta,
  };
}

async function searchContent(siteName, query) {
  const site = getSite(siteName);
  const params = new URLSearchParams({
    search: query,
    per_page: "20",
    subtype: "page,post",
  });
  return wpFetch(site, `/../wp/v2/search?${params}`);
}

async function listSites() {
  return sites.map((s) => ({
    name: s.name,
    url: s.url,
  }));
}

// ── MCP Server ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: "wordpress", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_sites",
      description: "List all configured WordPress sites.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_pages",
      description:
        "List all pages on a WordPress site. Returns title, slug, status, URL, and last modified date. Use to audit landing page inventory.",
      inputSchema: {
        type: "object",
        properties: {
          site: { type: "string", description: "Site name (optional if only one site configured)" },
          status: {
            type: "string",
            description: "Filter by status: publish, draft, pending (default: all)",
          },
          per_page: { type: "number", description: "Results per page (default: 50)" },
        },
      },
    },
    {
      name: "get_page",
      description:
        "Get full content of a WordPress page including raw HTML/blocks. Use to review landing page content, structure, and CTAs.",
      inputSchema: {
        type: "object",
        properties: {
          site: { type: "string", description: "Site name" },
          page_id: { type: "number", description: "WordPress page ID" },
        },
        required: ["page_id"],
      },
    },
    {
      name: "create_draft_page",
      description:
        "Create a new landing page as a DRAFT (never published directly). Use for building new pages based on ad/keyword intent. Returns the draft URL and edit link.",
      inputSchema: {
        type: "object",
        properties: {
          site: { type: "string", description: "Site name" },
          title: { type: "string", description: "Page title" },
          content: {
            type: "string",
            description: "Page content in HTML. Should be conversion-focused with strong CTAs.",
          },
          slug: { type: "string", description: "URL slug (optional)" },
          parent: { type: "number", description: "Parent page ID (optional)" },
        },
        required: ["title", "content"],
      },
    },
    {
      name: "update_draft_page",
      description:
        "Update an existing page's content, title, or slug. Cannot publish - can only set status to draft or pending. Use for improving existing landing pages.",
      inputSchema: {
        type: "object",
        properties: {
          site: { type: "string", description: "Site name" },
          page_id: { type: "number", description: "WordPress page ID" },
          title: { type: "string", description: "New title (optional)" },
          content: { type: "string", description: "New content (optional)" },
          slug: { type: "string", description: "New slug (optional)" },
          status: {
            type: "string",
            enum: ["draft", "pending"],
            description: "New status - draft or pending only (optional)",
          },
        },
        required: ["page_id"],
      },
    },
    {
      name: "list_posts",
      description:
        "List blog posts on a WordPress site. Use to audit content inventory and find SEO opportunities.",
      inputSchema: {
        type: "object",
        properties: {
          site: { type: "string", description: "Site name" },
          status: { type: "string", description: "Filter by status (default: all)" },
          search: { type: "string", description: "Search posts by keyword" },
          per_page: { type: "number", description: "Results per page (default: 20)" },
        },
      },
    },
    {
      name: "get_post",
      description: "Get full content of a blog post including raw HTML.",
      inputSchema: {
        type: "object",
        properties: {
          site: { type: "string", description: "Site name" },
          post_id: { type: "number", description: "WordPress post ID" },
        },
        required: ["post_id"],
      },
    },
    {
      name: "search_content",
      description:
        "Search across all pages and posts on a WordPress site. Use to find existing content before creating duplicates.",
      inputSchema: {
        type: "object",
        properties: {
          site: { type: "string", description: "Site name" },
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "list_sites":
        result = await listSites();
        break;
      case "list_pages":
        result = await listPages(args.site, {
          status: args.status,
          per_page: args.per_page,
        });
        break;
      case "get_page":
        result = await getPage(args.site, args.page_id);
        break;
      case "create_draft_page":
        result = await createDraftPage(args.site, args.title, args.content, {
          slug: args.slug,
          parent: args.parent,
        });
        break;
      case "update_draft_page": {
        const updates = {};
        if (args.title) updates.title = args.title;
        if (args.content) updates.content = args.content;
        if (args.slug) updates.slug = args.slug;
        if (args.status) updates.status = args.status;
        result = await updatePage(args.site, args.page_id, updates);
        break;
      }
      case "list_posts":
        result = await listPosts(args.site, {
          status: args.status,
          search: args.search,
          per_page: args.per_page,
        });
        break;
      case "get_post":
        result = await getPost(args.site, args.post_id);
        break;
      case "search_content":
        result = await searchContent(args.site, args.query);
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
  console.error("WordPress MCP server running (DRAFT MODE - no direct publishing)");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
