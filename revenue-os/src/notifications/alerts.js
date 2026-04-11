// Revenue OS — Alert Engine
// Core alert routing engine that coordinates email notifications, HubSpot actions,
// and vault persistence for every alert type.

import fs from 'fs/promises';
import path from 'path';
import config from '../config.js';
import EmailNotifier from './email.js';
import HubSpotNotifier from './hubspot-tasks.js';

// Alert priority levels used for routing decisions
const PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

// Which channels each priority level routes to
const ROUTING_RULES = {
  [PRIORITY.CRITICAL]: { email: true, hubspot: true, vault: true },
  [PRIORITY.HIGH]:     { email: true, hubspot: true, vault: true },
  [PRIORITY.MEDIUM]:   { email: true, hubspot: false, vault: true },
  [PRIORITY.LOW]:      { email: false, hubspot: false, vault: true },
};

class AlertEngine {
  constructor() {
    this.emailNotifier = new EmailNotifier();
    this.hubspotNotifier = new HubSpotNotifier();
    this.vaultPath = config.vault.path;
  }

  // ---------------------------------------------------------------------------
  // Daily brief
  // ---------------------------------------------------------------------------

  /**
   * Takes full analysis output, generates and sends the daily executive brief
   * via email, and creates a summary note in the vault.
   *
   * @param {object} analysisResults — Full analysis output from agents.
   * @param {object} [analysisResults.pipelineHealth] — Pipeline health metrics.
   * @param {string[]} [analysisResults.priorities]   — Top priorities.
   * @param {Array} [analysisResults.risks]            — Top risks.
   * @param {Array} [analysisResults.opportunities]    — Key opportunities.
   * @param {Array} [analysisResults.repSignals]       — Rep signals.
   * @param {string[]} [analysisResults.recommendedFocus] — Recommended focus areas.
   * @returns {Promise<{email: object|null, vault: string|null}>}
   */
  async processDailyBrief(analysisResults) {
    const date = new Date().toISOString().slice(0, 10);
    const briefData = {
      date,
      pipelineHealth: analysisResults.pipelineHealth || {},
      priorities: analysisResults.priorities || [],
      risks: analysisResults.risks || [],
      opportunities: analysisResults.opportunities || [],
      repSignals: analysisResults.repSignals || [],
      recommendedFocus: analysisResults.recommendedFocus || [],
    };

    const results = { email: null, vault: null };

    // Send email
    try {
      results.email = await this.emailNotifier.sendDailyBrief(briefData);
    } catch (error) {
      console.error('[AlertEngine] Failed to send daily brief email:', error.message);
    }

    // Write to vault
    try {
      const vaultContent = this._formatDailyBriefMarkdown(briefData);
      results.vault = await this._writeToVault(
        '09_Daily_Notes',
        `${date}.md`,
        vaultContent,
      );
    } catch (error) {
      console.error('[AlertEngine] Failed to write daily brief to vault:', error.message);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Deal risk alert
  // ---------------------------------------------------------------------------

  /**
   * When a deal is flagged at risk: updates HubSpot properties, creates a
   * HubSpot task, sends an email alert, and writes to vault.
   *
   * @param {string} dealId
   * @param {object} riskData
   * @param {string} riskData.dealName
   * @param {number} [riskData.amount]
   * @param {string} [riskData.stage]
   * @param {string} [riskData.owner]
   * @param {string} [riskData.ownerId]
   * @param {string} riskData.healthStatus — 'At Risk' | 'Critical' | etc.
   * @param {number} [riskData.daysInStage]
   * @param {string[]} [riskData.riskSignals]
   * @param {string[]} [riskData.recommendedActions]
   * @param {string} [riskData.closeDate]
   * @param {import('../integrations/hubspot.js').HubSpotClient} [hubspotClient]
   * @returns {Promise<{hubspot: object|null, email: object|null, vault: string|null}>}
   */
  async processDealRiskAlert(dealId, riskData, hubspotClient = null) {
    const results = { hubspot: null, email: null, vault: null };

    // HubSpot: update properties + create task
    if (hubspotClient) {
      try {
        results.hubspot = await this.hubspotNotifier.createRiskAlert(
          hubspotClient,
          dealId,
          {
            riskLevel: riskData.healthStatus || 'At Risk',
            signals: riskData.riskSignals || [],
            recommendedAction: (riskData.recommendedActions || [])[0] || '',
            dealName: riskData.dealName || '',
            ownerId: riskData.ownerId || '',
          },
        );
      } catch (error) {
        console.error(`[AlertEngine] HubSpot risk alert failed for deal ${dealId}:`, error.message);
      }
    }

    // Email alert
    try {
      results.email = await this.emailNotifier.sendAlert('deal_risk', {
        dealName: riskData.dealName,
        dealId,
        amount: riskData.amount,
        stage: riskData.stage,
        owner: riskData.owner,
        healthStatus: riskData.healthStatus,
        daysInStage: riskData.daysInStage,
        riskSignals: riskData.riskSignals,
        recommendedActions: riskData.recommendedActions,
        closeDate: riskData.closeDate,
        stakeholders: riskData.stakeholders,
      });
    } catch (error) {
      console.error(`[AlertEngine] Email risk alert failed for deal ${dealId}:`, error.message);
    }

    // Write to vault
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeName = this._sanitizeFilename(riskData.dealName || dealId);
      const vaultContent = this._formatRiskAlertMarkdown(dealId, riskData);
      results.vault = await this._writeToVault(
        '08_Notifications/Alerts',
        `${timestamp}_risk_${safeName}.md`,
        vaultContent,
      );
    } catch (error) {
      console.error(`[AlertEngine] Vault write failed for deal ${dealId} risk alert:`, error.message);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Forecast drift alert
  // ---------------------------------------------------------------------------

  /**
   * When forecast confidence drops: sends email alert and writes to vault.
   *
   * @param {object} forecastData
   * @param {string} [forecastData.period]
   * @param {number} [forecastData.previousForecast]
   * @param {number} [forecastData.currentForecast]
   * @param {number} [forecastData.target]
   * @param {number} [forecastData.driftPercent]
   * @param {string} [forecastData.driftDirection]
   * @param {Array}  [forecastData.commitDeals]
   * @param {Array}  [forecastData.droppedDeals]
   * @param {Array}  [forecastData.addedDeals]
   * @param {string} [forecastData.notes]
   * @returns {Promise<{email: object|null, vault: string|null}>}
   */
  async processForecastDriftAlert(forecastData) {
    const results = { email: null, vault: null };

    // Email alert
    try {
      results.email = await this.emailNotifier.sendAlert('forecast_drift', forecastData);
    } catch (error) {
      console.error('[AlertEngine] Forecast drift email failed:', error.message);
    }

    // Write to vault
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const vaultContent = this._formatForecastDriftMarkdown(forecastData);
      results.vault = await this._writeToVault(
        '08_Notifications/Alerts',
        `${timestamp}_forecast_drift.md`,
        vaultContent,
      );
    } catch (error) {
      console.error('[AlertEngine] Vault write failed for forecast drift alert:', error.message);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Rep coaching alert
  // ---------------------------------------------------------------------------

  /**
   * When a rep needs coaching: creates a HubSpot task, sends email, and writes
   * a coaching note to the vault.
   *
   * @param {object} repData
   * @param {string} repData.repName
   * @param {string} [repData.ownerId]
   * @param {string} [repData.coachingPriority]
   * @param {object} [repData.scorecard]
   * @param {string[]} [repData.strengths]
   * @param {string[]} [repData.issues]
   * @param {Array} [repData.dealsAtRisk]
   * @param {string[]} [repData.coachingFocus]
   * @param {string[]} [repData.talkingPoints]
   * @param {import('../integrations/hubspot.js').HubSpotClient} [hubspotClient]
   * @returns {Promise<{hubspot: object|null, email: object|null, vault: string|null}>}
   */
  async processRepCoachingAlert(repData, hubspotClient = null) {
    const results = { hubspot: null, email: null, vault: null };

    // HubSpot: create coaching task
    if (hubspotClient && repData.ownerId) {
      try {
        results.hubspot = await this.hubspotNotifier.createCoachingTask(
          hubspotClient,
          repData.ownerId,
          {
            repName: repData.repName,
            coachingPriority: repData.coachingPriority,
            coachingFocus: repData.coachingFocus,
            issues: repData.issues,
            talkingPoints: repData.talkingPoints,
          },
        );
      } catch (error) {
        console.error(`[AlertEngine] HubSpot coaching task failed for ${repData.repName}:`, error.message);
      }
    }

    // Email alert
    try {
      results.email = await this.emailNotifier.sendAlert('rep_coaching', repData);
    } catch (error) {
      console.error(`[AlertEngine] Coaching email failed for ${repData.repName}:`, error.message);
    }

    // Write coaching note to vault
    try {
      const date = new Date().toISOString().slice(0, 10);
      const safeName = this._sanitizeFilename(repData.repName || 'unknown');
      const vaultContent = this._formatCoachingMarkdown(repData);
      results.vault = await this._writeToVault(
        '04_Team/Coaching',
        `${date}_${safeName}.md`,
        vaultContent,
      );
    } catch (error) {
      console.error(`[AlertEngine] Vault write failed for coaching note:`, error.message);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Opportunity acceleration
  // ---------------------------------------------------------------------------

  /**
   * When a deal shows positive momentum: sends an opportunity alert email.
   *
   * @param {object} dealData
   * @param {string} dealData.dealName
   * @param {number} [dealData.amount]
   * @param {string} [dealData.stage]
   * @param {string} [dealData.owner]
   * @param {string} [dealData.momentum]
   * @param {string[]} [dealData.signals]
   * @param {string[]} [dealData.suggestedActions]
   * @param {string} [dealData.closeDate]
   * @param {number} [dealData.daysInPipeline]
   * @returns {Promise<{email: object|null, vault: string|null}>}
   */
  async processOpportunityAcceleration(dealData) {
    const results = { email: null, vault: null };

    // Email alert
    try {
      results.email = await this.emailNotifier.sendAlert('opportunity_acceleration', dealData);
    } catch (error) {
      console.error(`[AlertEngine] Opportunity acceleration email failed for ${dealData.dealName}:`, error.message);
    }

    // Write to vault
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeName = this._sanitizeFilename(dealData.dealName || 'deal');
      const vaultContent = this._formatOpportunityMarkdown(dealData);
      results.vault = await this._writeToVault(
        '08_Notifications/Alerts',
        `${timestamp}_opportunity_${safeName}.md`,
        vaultContent,
      );
    } catch (error) {
      console.error(`[AlertEngine] Vault write failed for opportunity alert:`, error.message);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Universal router
  // ---------------------------------------------------------------------------

  /**
   * Universal alert router that decides which channels to use based on alert
   * type and priority, then dispatches accordingly.
   *
   * @param {'deal_risk'|'forecast_drift'|'rep_coaching'|'opportunity_acceleration'} alertType
   * @param {object} data     — Alert-specific data payload.
   * @param {import('../integrations/hubspot.js').HubSpotClient} [hubspotClient]
   * @returns {Promise<object>} Result object with outcomes from each channel.
   */
  async routeAlert(alertType, data, hubspotClient = null) {
    const priority = this._inferPriority(alertType, data);
    const channels = ROUTING_RULES[priority] || ROUTING_RULES[PRIORITY.MEDIUM];

    console.log(`[AlertEngine] Routing "${alertType}" alert — priority: ${priority}, channels: email=${channels.email}, hubspot=${channels.hubspot}, vault=${channels.vault}`);

    switch (alertType) {
      case 'deal_risk': {
        // For deal_risk, if HubSpot is not required by routing rules, skip it
        const hsClient = channels.hubspot ? hubspotClient : null;
        return this.processDealRiskAlert(data.dealId || data.id, data, hsClient);
      }

      case 'forecast_drift':
        return this.processForecastDriftAlert(data);

      case 'rep_coaching': {
        const hsClient = channels.hubspot ? hubspotClient : null;
        return this.processRepCoachingAlert(data, hsClient);
      }

      case 'opportunity_acceleration':
        return this.processOpportunityAcceleration(data);

      default:
        console.warn(`[AlertEngine] Unknown alert type: "${alertType}" — falling back to email-only.`);
        try {
          const emailResult = await this.emailNotifier.send(
            `[Revenue OS] Alert: ${alertType}`,
            `<pre>${JSON.stringify(data, null, 2)}</pre>`,
          );
          return { email: emailResult };
        } catch (error) {
          console.error(`[AlertEngine] Fallback email failed for "${alertType}":`, error.message);
          return { email: null };
        }
    }
  }

  // ---------------------------------------------------------------------------
  // Vault persistence
  // ---------------------------------------------------------------------------

  /**
   * Writes a markdown file to the vault at the specified sub-path.
   *
   * @param {string} folder   — Vault subfolder (e.g. '08_Notifications/Alerts').
   * @param {string} filename — File name including extension.
   * @param {string} content  — Markdown content.
   * @returns {Promise<string>} Full path of the written file.
   */
  async _writeToVault(folder, filename, content) {
    const dirPath = path.join(this.vaultPath, folder);
    const filePath = path.join(dirPath, filename);

    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');

    console.log(`[AlertEngine] Vault: wrote ${folder}/${filename}`);
    return filePath;
  }

  // ---------------------------------------------------------------------------
  // Priority inference
  // ---------------------------------------------------------------------------

  /**
   * Infers an alert priority from the alert type and data payload.
   *
   * @param {string} alertType
   * @param {object} data
   * @returns {string} One of the PRIORITY values.
   */
  _inferPriority(alertType, data) {
    switch (alertType) {
      case 'deal_risk': {
        const status = String(data.healthStatus || data.riskLevel || '').toLowerCase();
        if (status === 'critical') return PRIORITY.CRITICAL;
        if (status === 'high' || status === 'at risk') return PRIORITY.HIGH;
        if (status === 'medium') return PRIORITY.MEDIUM;
        return PRIORITY.LOW;
      }

      case 'forecast_drift': {
        const drift = Math.abs(data.driftPercent || 0);
        if (drift >= 20) return PRIORITY.CRITICAL;
        if (drift >= 10) return PRIORITY.HIGH;
        if (drift >= 5) return PRIORITY.MEDIUM;
        return PRIORITY.LOW;
      }

      case 'rep_coaching': {
        const cp = String(data.coachingPriority || '').toLowerCase();
        if (cp === 'urgent') return PRIORITY.CRITICAL;
        if (cp === 'high') return PRIORITY.HIGH;
        if (cp === 'medium') return PRIORITY.MEDIUM;
        return PRIORITY.LOW;
      }

      case 'opportunity_acceleration':
        // Positive signals are typically medium priority — informational
        return PRIORITY.MEDIUM;

      default:
        return PRIORITY.MEDIUM;
    }
  }

  // ---------------------------------------------------------------------------
  // Markdown formatters for vault
  // ---------------------------------------------------------------------------

  _formatDailyBriefMarkdown(briefData) {
    const { date, pipelineHealth, priorities, risks, opportunities, repSignals, recommendedFocus } = briefData;
    const ph = pipelineHealth || {};

    return `---
type: daily_brief
date: "${date}"
total_pipeline: ${ph.totalPipeline || 0}
weighted_pipeline: ${ph.weightedPipeline || 0}
deals_at_risk: ${ph.atRiskCount || 0}
created: "${new Date().toISOString()}"
tags: [daily, brief, auto-generated]
---

# Daily Executive Brief — ${date}

## Pipeline Health
| Metric | Value |
|--------|-------|
| Total Pipeline | $${(ph.totalPipeline || 0).toLocaleString()} |
| Weighted Pipeline | $${(ph.weightedPipeline || 0).toLocaleString()} |
| Coverage Ratio | ${ph.coverageRatio || 'N/A'}x |
| Total Deals | ${ph.dealCount || 'N/A'} |
| At Risk | ${ph.atRiskCount || 0} |
| Avg Days in Stage | ${ph.avgDaysInStage || 'N/A'} |

## Top 3 Priorities
${priorities.length > 0 ? priorities.map((p, i) => `${i + 1}. ${p}`).join('\n') : '- None flagged'}

## Top 3 Risks
${risks.length > 0 ? risks.map((r, i) => `${i + 1}. ${typeof r === 'string' ? r : r.description || r.summary || JSON.stringify(r)}`).join('\n') : '- No major risks'}

## Key Opportunities
${opportunities.length > 0 ? opportunities.map(o => `- **${o.name || o.dealName || 'Unknown'}** — $${(o.amount || 0).toLocaleString()} — ${o.stage || ''} — ${o.signal || ''}`).join('\n') : '- None highlighted'}

## Rep Signals
${repSignals.length > 0 ? repSignals.map(r => `- **${r.name || ''}**: ${r.signal || r.status || ''} — ${r.detail || r.note || ''}`).join('\n') : '- No signals'}

## Recommended Focus
${recommendedFocus.length > 0 ? recommendedFocus.map((f, i) => `${i + 1}. ${f}`).join('\n') : '- No specific focus recommendations'}
`;
  }

  _formatRiskAlertMarkdown(dealId, riskData) {
    const date = new Date().toISOString();

    return `---
type: alert
alert_type: deal_risk
deal_id: "${dealId}"
deal_name: "${riskData.dealName || ''}"
health_status: "${riskData.healthStatus || 'At Risk'}"
created: "${date}"
tags: [alert, risk, auto-generated]
---

# Risk Alert — ${riskData.dealName || dealId}

**Status:** ${riskData.healthStatus || 'At Risk'}
**Generated:** ${date}

## Deal Overview
| Field | Value |
|-------|-------|
| Deal | ${riskData.dealName || ''} |
| HubSpot ID | ${dealId} |
| Amount | $${(riskData.amount || 0).toLocaleString()} |
| Stage | ${riskData.stage || ''} |
| Owner | ${riskData.owner || ''} |
| Days in Stage | ${riskData.daysInStage || ''} |
| Close Date | ${riskData.closeDate || 'Not set'} |

## Risk Signals
${(riskData.riskSignals || []).map(s => `- ⚠ ${s}`).join('\n') || '- None documented'}

## Recommended Actions
${(riskData.recommendedActions || []).map((a, i) => `${i + 1}. ${a}`).join('\n') || '- None'}
`;
  }

  _formatForecastDriftMarkdown(forecastData) {
    const date = new Date().toISOString();
    const direction = forecastData.driftDirection === 'down' ? 'Declined' : 'Improved';

    return `---
type: alert
alert_type: forecast_drift
period: "${forecastData.period || ''}"
drift_percent: ${Math.abs(forecastData.driftPercent || 0)}
drift_direction: "${forecastData.driftDirection || 'down'}"
created: "${date}"
tags: [alert, forecast, drift, auto-generated]
---

# Forecast Drift Alert — ${forecastData.period || 'Current Period'}

**Direction:** ${direction} by ${Math.abs(forecastData.driftPercent || 0).toFixed(1)}%
**Generated:** ${date}

## Forecast Comparison
| Metric | Value |
|--------|-------|
| Previous Forecast | $${(forecastData.previousForecast || 0).toLocaleString()} |
| Current Forecast | $${(forecastData.currentForecast || 0).toLocaleString()} |
| Target | $${(forecastData.target || 0).toLocaleString()} |
| Gap to Target | $${((forecastData.target || 0) - (forecastData.currentForecast || 0)).toLocaleString()} |

${(forecastData.droppedDeals || []).length > 0 ? `## Deals Dropped
${forecastData.droppedDeals.map(d => `- **${d.name || ''}** — $${(d.amount || 0).toLocaleString()} — ${d.reason || ''}`).join('\n')}` : ''}

${(forecastData.addedDeals || []).length > 0 ? `## Deals Added
${forecastData.addedDeals.map(d => `- **${d.name || ''}** — $${(d.amount || 0).toLocaleString()} — ${d.stage || ''}`).join('\n')}` : ''}

${forecastData.notes ? `## Notes\n${forecastData.notes}` : ''}
`;
  }

  _formatCoachingMarkdown(repData) {
    const date = new Date().toISOString().slice(0, 10);
    const sc = repData.scorecard || {};

    return `---
type: coaching
rep_name: "${repData.repName || ''}"
coaching_priority: "${repData.coachingPriority || 'Medium'}"
date: "${date}"
created: "${new Date().toISOString()}"
tags: [coaching, team, auto-generated]
---

# Coaching — ${repData.repName || 'Unknown Rep'} — ${date}

**Priority:** ${repData.coachingPriority || 'Medium'}

## Scorecard
| Metric | Current | Target |
|--------|---------|--------|
| Activity Level | ${sc.activityLevel || 'N/A'} | ${sc.activityTarget || ''} |
| Pipeline Value | $${(sc.pipelineValue || 0).toLocaleString()} | $${(sc.pipelineTarget || 0).toLocaleString()} |
| Win Rate | ${sc.winRate != null ? sc.winRate + '%' : 'N/A'} | ${sc.winRateTarget != null ? sc.winRateTarget + '%' : ''} |
| Forecast Reliability | ${sc.forecastReliability || 'N/A'} | |
| Stalled Deals | ${sc.stalledDeals ?? 'N/A'} | |
| Avg Deal Cycle | ${sc.avgDealCycle != null ? sc.avgDealCycle + ' days' : 'N/A'} | |

## Strengths
${(repData.strengths || []).map(s => `- ✓ ${s}`).join('\n') || '- None noted'}

## Issues
${(repData.issues || []).map(iss => `- ⚠ ${iss}`).join('\n') || '- None'}

${(repData.dealsAtRisk || []).length > 0 ? `## Deals at Risk
${repData.dealsAtRisk.map(d => `- **${d.name || ''}** — $${(d.amount || 0).toLocaleString()} — ${d.daysStalled || '?'} days stalled — ${d.issue || ''}`).join('\n')}` : ''}

## Coaching Focus
${(repData.coachingFocus || []).map((f, i) => `${i + 1}. ${f}`).join('\n') || '- None specified'}

${(repData.talkingPoints || []).length > 0 ? `## 1:1 Talking Points
${repData.talkingPoints.map(p => `- ${p}`).join('\n')}` : ''}
`;
  }

  _formatOpportunityMarkdown(dealData) {
    const date = new Date().toISOString();

    return `---
type: alert
alert_type: opportunity_acceleration
deal_name: "${dealData.dealName || ''}"
amount: ${dealData.amount || 0}
created: "${date}"
tags: [alert, opportunity, momentum, auto-generated]
---

# Opportunity Acceleration — ${dealData.dealName || 'Unknown Deal'}

**Generated:** ${date}

## Deal Snapshot
| Field | Value |
|-------|-------|
| Deal | ${dealData.dealName || ''} |
| Amount | $${(dealData.amount || 0).toLocaleString()} |
| Stage | ${dealData.stage || ''} |
| Owner | ${dealData.owner || ''} |
| Close Date | ${dealData.closeDate || 'Not set'} |
| Days in Pipeline | ${dealData.daysInPipeline || ''} |

${dealData.momentum ? `## Momentum Summary\n${dealData.momentum}` : ''}

## Positive Signals
${(dealData.signals || []).map(s => `- ▲ ${s}`).join('\n') || '- None documented'}

## Suggested Actions
${(dealData.suggestedActions || []).map((a, i) => `${i + 1}. ${a}`).join('\n') || '- None'}
`;
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Sanitizes a string for use as a filename.
   *
   * @param {string} name
   * @returns {string}
   */
  _sanitizeFilename(name) {
    return String(name)
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 80)
      .toLowerCase();
  }
}

export default AlertEngine;
