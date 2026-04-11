import fs from 'fs/promises';
import path from 'path';
import { HubSpotClient } from './hubspot.js';
import config from '../config.js';

/**
 * Maps a HubSpot deal stage name to a vault folder category.
 *
 * @param {string} stage - The dealstage property value.
 * @returns {string} One of "Active", "Won", or "Lost".
 */
function stageToFolder(stage) {
  const normalised = (stage || '').toLowerCase().replace(/\s+/g, '_');
  if (normalised === 'closed_won' || normalised === 'closedwon') return 'Won';
  if (normalised === 'closed_lost' || normalised === 'closedlost') return 'Lost';
  return 'Active';
}

/**
 * Sanitises a string for use as a file name — strips characters that are
 * invalid on most file systems and trims whitespace.
 *
 * @param {string} name
 * @returns {string}
 */
function sanitiseFileName(name) {
  return (name || 'Untitled')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats a currency value for display in vault notes.
 *
 * @param {number|string} value
 * @returns {string}
 */
function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '$0';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Returns today's date as YYYY-MM-DD.
 *
 * @returns {string}
 */
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Deal note rendering
// ---------------------------------------------------------------------------

/**
 * Renders an Obsidian markdown note for a single deal, populating the deal
 * template's frontmatter and body sections from HubSpot properties.
 *
 * @param {object} deal       - HubSpot deal object.
 * @param {object} [owners]   - Map of ownerId -> owner display name.
 * @param {object} [activities] - Engagement activities keyed by type.
 * @returns {string} Markdown content.
 */
function renderDealNote(deal, owners = {}, activities = {}) {
  const p = deal.properties || {};
  const ownerName = owners[p.hubspot_owner_id] || p.hubspot_owner_id || '';
  const amount = formatCurrency(p.amount);
  const closeDate = p.closedate ? p.closedate.slice(0, 10) : '';
  const stage = p.dealstage || '';
  const stageLabel = config.dealStages?.[stage]?.label || stage;
  const healthStatus = p.deal_health_status || '';
  const forecastRisk = p.forecast_risk_level || '';
  const closeConfidence = p.close_confidence_score || 0;
  const leadershipAttention = (p.leadership_attention_needed || '').toLowerCase() === 'yes';
  const dealName = p.dealname || 'Untitled Deal';
  const summary = p.deal_summary_snapshot || '';
  const recommendedAction = p.agent_recommended_action || '';
  const daysSinceActivity = p.days_since_last_activity || '';

  // Build activity timeline section
  let activityTimeline = '';
  const allActivities = [];

  for (const [type, items] of Object.entries(activities)) {
    for (const item of items) {
      const ip = item.properties || {};
      const timestamp = ip.hs_timestamp || '';
      let description = '';

      switch (type) {
        case 'notes':
          description = `Note: ${(ip.hs_note_body || '').slice(0, 120)}`;
          break;
        case 'tasks':
          description = `Task: ${ip.hs_task_subject || ''}`;
          break;
        case 'meetings':
          description = `Meeting: ${ip.hs_meeting_title || ''}`;
          break;
        case 'calls':
          description = `Call: ${ip.hs_call_title || ''}`;
          break;
        case 'emails':
          description = `Email: ${ip.hs_email_subject || ''} (${ip.hs_email_direction || ''})`;
          break;
        default:
          description = `${type}: activity`;
      }

      allActivities.push({ timestamp, description });
    }
  }

  allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (allActivities.length > 0) {
    const recentEntries = allActivities.slice(0, 15);
    activityTimeline = recentEntries
      .map((a) => `- ${a.timestamp ? a.timestamp.slice(0, 10) : 'Unknown'} — ${a.description}`)
      .join('\n');
  } else {
    activityTimeline = '- No recent activity recorded';
  }

  return `---
type: deal
hubspot_id: "${deal.id}"
company: "${dealName.replace(/"/g, '\\"')}"
owner: "${ownerName.replace(/"/g, '\\"')}"
stage: "${stageLabel}"
amount: ${parseFloat(p.amount) || 0}
close_date: "${closeDate}"
health_status: "${healthStatus}"
forecast_risk: "${forecastRisk}"
close_confidence: ${parseFloat(closeConfidence) || 0}
leadership_attention: ${leadershipAttention}
days_since_activity: ${parseInt(daysSinceActivity, 10) || 0}
created: "${today()}"
updated: "${today()}"
tags: [deal, ${stageToFolder(stage).toLowerCase()}]
---

# Deal: ${dealName}

## Overview
| Field | Value |
|-------|-------|
| HubSpot ID | ${deal.id} |
| Owner | ${ownerName} |
| Stage | ${stageLabel} |
| Amount | ${amount} |
| Close Date | ${closeDate} |
| Health Status | ${healthStatus} |
| Forecast Risk | ${forecastRisk} |
| Close Confidence | ${closeConfidence} |
| Days Since Activity | ${daysSinceActivity} |

## Summary
${summary || '- Awaiting agent analysis'}

## Agent Recommended Actions
${recommendedAction || '> Awaiting agent analysis'}

## Activity Timeline
### Recent Activity
${activityTimeline}

## Leadership Notes
${leadershipAttention ? '> **This deal requires leadership attention.**' : '> No leadership attention flagged.'}

## Linked Notes
-
`;
}

// ---------------------------------------------------------------------------
// Pipeline snapshot rendering
// ---------------------------------------------------------------------------

/**
 * Renders a pipeline snapshot markdown note from a summary object.
 *
 * @param {object} summary - Output of HubSpotClient.getPipelineSummary().
 * @returns {string} Markdown content.
 */
function renderPipelineSnapshot(summary) {
  const dateStr = today();
  const dist = summary.stageDistribution || {};

  let stageRows = '';
  for (const [stage, data] of Object.entries(dist)) {
    stageRows += `| ${data.label || stage} | ${data.count} | ${formatCurrency(data.value)} | ${formatCurrency(data.weighted)} |\n`;
  }

  if (!stageRows) {
    stageRows = '| — | 0 | $0 | $0 |\n';
  }

  return `---
type: pipeline_snapshot
date: "${dateStr}"
total_pipeline: ${summary.totalPipeline}
weighted_pipeline: ${summary.weightedPipeline}
deal_count: ${summary.dealCount}
avg_deal_size: ${Math.round(summary.avgDealSize)}
generated_at: "${summary.generatedAt}"
tags: [pipeline, snapshot, automated]
---

# Pipeline Snapshot - ${dateStr}

## Summary
| Metric | Value |
|--------|-------|
| Total Pipeline | ${formatCurrency(summary.totalPipeline)} |
| Weighted Pipeline | ${formatCurrency(summary.weightedPipeline)} |
| Deal Count | ${summary.dealCount} |
| Avg Deal Size | ${formatCurrency(summary.avgDealSize)} |
| Generated At | ${summary.generatedAt} |

## Stage Distribution
| Stage | Count | Value | Weighted |
|-------|-------|-------|----------|
${stageRows}
## Notes
- Auto-generated by Revenue OS HubSpot sync.
`;
}

// ---------------------------------------------------------------------------
// HubSpotSync class
// ---------------------------------------------------------------------------

export class HubSpotSync {
  /**
   * @param {object} [options]
   * @param {string} [options.vaultPath] - Override the vault path from config.
   * @param {HubSpotClient} [options.client] - Inject a HubSpotClient instance (useful for testing).
   */
  constructor(options = {}) {
    this.vaultPath = options.vaultPath || config.vault.path;
    this.client = options.client || new HubSpotClient();
  }

  // -------------------------------------------------------------------------
  // File I/O helpers
  // -------------------------------------------------------------------------

  /**
   * Writes content to a file inside the vault, creating intermediate
   * directories as needed.
   *
   * @param {string} relativePath - Path relative to the vault root.
   * @param {string} content      - File content to write.
   */
  async _writeVaultFile(relativePath, content) {
    const fullPath = path.join(this.vaultPath, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  // -------------------------------------------------------------------------
  // Deal sync
  // -------------------------------------------------------------------------

  /**
   * Pulls all deals from HubSpot and writes/updates deal notes in the vault.
   * Deals are filed into 02_Deals/Active/, 02_Deals/Won/, or 02_Deals/Lost/
   * based on their current stage.
   *
   * @returns {Promise<{ synced: number, errors: number }>}
   */
  async syncDeals() {
    console.log('[Sync] Starting deal sync...');
    let synced = 0;
    let errors = 0;

    try {
      // Fetch deals and owners in parallel
      const [deals, owners] = await Promise.all([
        this.client.getDeals(),
        this._fetchOwnerMap(),
      ]);

      console.log(`[Sync] Fetched ${deals.length} deals from HubSpot.`);

      for (const deal of deals) {
        try {
          const dealName = deal.properties?.dealname || 'Untitled Deal';
          const stage = deal.properties?.dealstage || '';
          const folder = stageToFolder(stage);
          const fileName = `${sanitiseFileName(dealName)}.md`;
          const relativePath = path.join('02_Deals', folder, fileName);

          // Fetch activities for each deal
          let activities = {};
          try {
            activities = await this.client.getDealActivities(deal.id);
          } catch (activityError) {
            console.warn(`[Sync] Could not fetch activities for deal ${deal.id}: ${activityError.message}`);
          }

          const content = renderDealNote(deal, owners, activities);
          await this._writeVaultFile(relativePath, content);

          // Remove the deal from other stage folders to handle stage transitions
          await this._cleanStaleStageFiles(fileName, folder);

          synced += 1;
        } catch (dealError) {
          console.error(`[Sync] Failed to sync deal ${deal.id}: ${dealError.message}`);
          errors += 1;
        }
      }

      console.log(`[Sync] Deal sync complete. Synced: ${synced}, Errors: ${errors}`);
    } catch (error) {
      console.error('[Sync] Deal sync failed:', error.message);
      throw error;
    }

    return { synced, errors };
  }

  /**
   * Builds a map of owner ID -> display name for resolving deal ownership.
   *
   * @returns {Promise<object>}
   */
  async _fetchOwnerMap() {
    try {
      const owners = await this.client.getOwners();
      const map = {};
      for (const owner of owners) {
        const name = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email || owner.id;
        map[owner.id] = name;
      }
      return map;
    } catch (error) {
      console.warn('[Sync] Could not fetch owners — deal notes will use raw owner IDs:', error.message);
      return {};
    }
  }

  /**
   * When a deal moves from one stage to another (e.g. Active -> Won), the old
   * file in the previous folder becomes stale. This method removes duplicates
   * from the other two stage folders.
   *
   * @param {string} fileName    - The deal file name (e.g. "Acme Corp.md").
   * @param {string} currentFolder - The folder the deal currently belongs in.
   */
  async _cleanStaleStageFiles(fileName, currentFolder) {
    const allFolders = ['Active', 'Won', 'Lost'];

    for (const folder of allFolders) {
      if (folder === currentFolder) continue;

      const stalePath = path.join(this.vaultPath, '02_Deals', folder, fileName);
      try {
        await fs.unlink(stalePath);
        console.log(`[Sync] Removed stale file: 02_Deals/${folder}/${fileName}`);
      } catch {
        // File does not exist in this folder — expected for most deals.
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pipeline snapshot sync
  // -------------------------------------------------------------------------

  /**
   * Generates a pipeline snapshot from HubSpot and writes it to
   * 01_Pipeline/Snapshots/ with today's date as the file name.
   *
   * @returns {Promise<object>} The pipeline summary object.
   */
  async syncPipelineSnapshot() {
    console.log('[Sync] Generating pipeline snapshot...');

    try {
      const summary = await this.client.getPipelineSummary();
      const dateStr = today();
      const fileName = `Pipeline_Snapshot_${dateStr}.md`;
      const relativePath = path.join('01_Pipeline', 'Snapshots', fileName);

      const content = renderPipelineSnapshot(summary);
      await this._writeVaultFile(relativePath, content);

      console.log(`[Sync] Pipeline snapshot written to ${relativePath}`);
      return summary;
    } catch (error) {
      console.error('[Sync] Pipeline snapshot sync failed:', error.message);
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Write-back
  // -------------------------------------------------------------------------

  /**
   * Updates HubSpot with agent-generated insights for a specific deal. Only
   * the writeback-safe properties defined in HubSpotClient are accepted.
   *
   * @param {string} dealId      - HubSpot deal ID.
   * @param {object} properties  - Key/value pairs of properties to update.
   * @returns {Promise<object|null>} Updated deal object, or null if nothing to write.
   */
  async writeBackToHubSpot(dealId, properties) {
    console.log(`[Sync] Writing back properties to deal ${dealId}...`);

    try {
      const result = await this.client.updateDealProperties(dealId, properties);

      if (result) {
        console.log(`[Sync] Successfully updated deal ${dealId} in HubSpot.`);
      } else {
        console.warn(`[Sync] No valid properties to write back for deal ${dealId}.`);
      }

      return result;
    } catch (error) {
      console.error(`[Sync] Write-back failed for deal ${dealId}:`, error.message);
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Full sync
  // -------------------------------------------------------------------------

  /**
   * Runs all sync operations: deals, pipeline snapshot. Returns a combined
   * result object.
   *
   * @returns {Promise<object>} Results from each sync step.
   */
  async fullSync() {
    console.log('[Sync] Starting full sync...');
    const startTime = Date.now();
    const results = {};

    try {
      results.deals = await this.syncDeals();
    } catch (error) {
      results.deals = { error: error.message };
    }

    try {
      results.pipelineSnapshot = await this.syncPipelineSnapshot();
    } catch (error) {
      results.pipelineSnapshot = { error: error.message };
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Sync] Full sync complete in ${elapsed}s.`);

    results.elapsed = `${elapsed}s`;
    results.completedAt = new Date().toISOString();

    return results;
  }
}

export default HubSpotSync;
