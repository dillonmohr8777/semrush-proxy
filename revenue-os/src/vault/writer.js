import fs from 'fs/promises';
import path from 'path';
import config from '../config.js';

export default class VaultWriter {
  constructor(vaultPath) {
    this.vaultPath = vaultPath || config.vault.path;
  }

  async writeNote(folder, filename, content) {
    const filePath = path.join(this.vaultPath, folder, `${filename}.md`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  async readNote(folder, filename) {
    const filePath = path.join(this.vaultPath, folder, `${filename}.md`);
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  async noteExists(folder, filename) {
    const filePath = path.join(this.vaultPath, folder, `${filename}.md`);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Deal notes

  async writeDealNote(deal, analysisData) {
    const stage = deal.stage?.toLowerCase() || 'active';
    let subfolder = 'Active';
    if (stage.includes('won')) subfolder = 'Won';
    else if (stage.includes('lost')) subfolder = 'Lost';
    else if (analysisData?.healthScore < 40) subfolder = 'At_Risk';

    const filename = sanitizeFilename(deal.name || deal.dealId);
    const content = formatDealNote(deal, analysisData);
    return this.writeNote(`02_Deals/${subfolder}`, filename, content);
  }

  // Pipeline snapshots

  async writePipelineSnapshot(snapshotData) {
    const date = new Date().toISOString().split('T')[0];
    const filename = `Pipeline_Snapshot_${date}`;
    const content = formatPipelineSnapshot(snapshotData);
    return this.writeNote('01_Pipeline/Snapshots', filename, content);
  }

  async writePipelineReview(reviewData) {
    const date = new Date().toISOString().split('T')[0];
    const filename = `Pipeline_Review_${date}`;
    const content = formatPipelineReview(reviewData);
    return this.writeNote('01_Pipeline/Reviews', filename, content);
  }

  // Forecast notes

  async writeForecastNote(forecastData) {
    const date = new Date().toISOString().split('T')[0];
    const filename = `Forecast_${date}`;
    const content = formatForecastNote(forecastData);
    return this.writeNote('03_Forecasts/Weekly', filename, content);
  }

  // Coaching notes

  async writeCoachingNote(repName, coachingData) {
    const date = new Date().toISOString().split('T')[0];
    const filename = `${sanitizeFilename(repName)}_${date}`;
    const content = formatCoachingNote(repName, coachingData);
    return this.writeNote('04_Team/Coaching', filename, content);
  }

  async writeScorecard(repName, scorecardData) {
    const date = new Date().toISOString().split('T')[0];
    const filename = `${sanitizeFilename(repName)}_Scorecard_${date}`;
    const content = formatScorecard(repName, scorecardData);
    return this.writeNote('04_Team/Scorecards', filename, content);
  }

  // Meeting notes

  async writeMeetingNote(meetingData) {
    const date = new Date().toISOString().split('T')[0];
    const typeFolder = getMeetingFolder(meetingData.meetingType);
    const filename = `${sanitizeFilename(meetingData.title || meetingData.meetingType)}_${date}`;
    const content = formatMeetingNote(meetingData);
    return this.writeNote(`05_Meetings/${typeFolder}`, filename, content);
  }

  // Executive summaries

  async writeExecutiveSummary(summaryData) {
    const date = new Date().toISOString().split('T')[0];
    const filename = `Exec_Summary_${date}`;
    const content = formatExecutiveSummary(summaryData);
    return this.writeNote('06_Leadership/Exec_Summaries', filename, content);
  }

  // Daily notes

  async writeDailyNote(dailyData) {
    const date = new Date().toISOString().split('T')[0];
    const filename = date;
    const content = formatDailyNote(dailyData);
    return this.writeNote('09_Daily_Notes', filename, content);
  }

  // Alerts

  async writeAlert(alertType, alertData) {
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    const filename = `${alertType}_${date}_${time}`;
    const content = formatAlert(alertType, alertData);
    return this.writeNote('08_Notifications/Alerts', filename, content);
  }

  // Agent logs

  async writeAgentLog(agentName, logData) {
    const date = new Date().toISOString().split('T')[0];
    const filename = `${agentName}_${date}`;
    const content = formatAgentLog(agentName, logData);
    return this.writeNote('11_Agents/Logs', filename, content);
  }

  // Reports

  async writeReport(reportType, reportData) {
    const date = new Date().toISOString().split('T')[0];
    const subfolder = reportType === 'forecast' ? 'Forecast' : reportType === 'team' ? 'Team' : 'Pipeline';
    const filename = `${reportType}_Report_${date}`;
    const content = formatReport(reportType, reportData);
    return this.writeNote(`10_Reports/${subfolder}`, filename, content);
  }
}

// Helpers

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').substring(0, 80);
}

function getMeetingFolder(type) {
  const map = {
    pipeline_review: 'Pipeline_Reviews',
    leadership: 'Leadership',
    board: 'Board',
    team: 'Team',
    rep_1on1: 'Team',
    forecast_call: 'Pipeline_Reviews',
  };
  return map[type] || 'Team';
}

function formatDealNote(deal, analysis) {
  const health = analysis?.healthScore ?? 'N/A';
  const riskLevel = analysis?.riskLevel ?? 'Unknown';
  return `---
type: deal
company: "${deal.name || ''}"
owner: "${deal.owner || ''}"
stage: "${deal.stage || ''}"
amount: ${deal.amount || 0}
close_date: "${deal.closeDate || ''}"
health_status: "${riskLevel}"
close_confidence: ${analysis?.closeConfidence ?? 0}
leadership_attention: ${analysis?.leadershipAttention ?? false}
synced: "${new Date().toISOString()}"
tags: [deal, synced]
---

# Deal: ${deal.name}

## Overview
| Field | Value |
|-------|-------|
| Owner | ${deal.owner || ''} |
| Stage | ${deal.stage || ''} |
| Amount | $${(deal.amount || 0).toLocaleString()} |
| Close Date | ${deal.closeDate || ''} |
| Health Score | ${health}/100 |
| Risk Level | ${riskLevel} |

## Summary
${analysis?.summary || '- Pending analysis'}

## Risks
${(analysis?.risks || []).map(r => `- ${r}`).join('\n') || '- None identified'}

## Recommended Actions
${(analysis?.recommendedActions || []).map(a => `- [ ] ${a}`).join('\n') || '- [ ] Pending'}

## Activity Timeline
${(analysis?.recentActivity || []).map(a => `- ${a}`).join('\n') || '- No recent activity'}

## Leadership Notes
> ${analysis?.leadershipNotes || 'No notes yet'}
`;
}

function formatPipelineSnapshot(data) {
  const date = new Date().toISOString().split('T')[0];
  return `---
type: pipeline_snapshot
date: "${date}"
total_pipeline: ${data.totalPipeline || 0}
weighted_pipeline: ${data.weightedPipeline || 0}
deal_count: ${data.dealCount || 0}
tags: [pipeline, snapshot, synced]
---

# Pipeline Snapshot - ${date}

## Summary
| Metric | Value |
|--------|-------|
| Total Pipeline | $${(data.totalPipeline || 0).toLocaleString()} |
| Weighted Pipeline | $${(data.weightedPipeline || 0).toLocaleString()} |
| Deal Count | ${data.dealCount || 0} |
| Avg Deal Size | $${(data.avgDealSize || 0).toLocaleString()} |
| Coverage Ratio | ${data.coverageRatio || 'N/A'}x |

## Stage Distribution
${(data.stages || []).map(s => `| ${s.name} | ${s.count} | $${(s.value || 0).toLocaleString()} |`).join('\n')}

## Changes Since Last Snapshot
${data.changes || '- First snapshot'}
`;
}

function formatPipelineReview(data) {
  const date = new Date().toISOString().split('T')[0];
  return `---
type: pipeline_review
date: "${date}"
tags: [pipeline, review]
---

# Pipeline Review - ${date}

## Key Metrics
| Metric | Value | Trend |
|--------|-------|-------|
| Total Pipeline | $${(data.totalPipeline || 0).toLocaleString()} | ${data.pipelineTrend || ''} |
| Weighted | $${(data.weightedPipeline || 0).toLocaleString()} | |
| Coverage | ${data.coverageRatio || ''}x | |

## Top Risks
${(data.topRisks || []).map((r, i) => `${i + 1}. ${r}`).join('\n')}

## Top Opportunities
${(data.topOpportunities || []).map((o, i) => `${i + 1}. ${o}`).join('\n')}

## Actions
${(data.actions || []).map(a => `- [ ] ${a}`).join('\n')}
`;
}

function formatForecastNote(data) {
  const date = new Date().toISOString().split('T')[0];
  return `---
type: forecast
date: "${date}"
confidence_score: ${data.confidenceScore || 0}
tags: [forecast]
---

# Forecast - ${date}

## Confidence: ${data.confidenceScore || 0}/100

## Summary
| Category | Value |
|----------|-------|
| Commit | $${(data.commitTotal || 0).toLocaleString()} |
| Best Case | $${(data.bestCaseTotal || 0).toLocaleString()} |
| Coverage | ${data.coverageRatio || 'N/A'}x |
| Quarter Target | $${(data.quarterTarget || 0).toLocaleString()} |

## Drift
${data.forecastDrift?.warning || 'No significant drift detected'}

## Risk Factors
${(data.riskFactors || []).map(r => `- ${r}`).join('\n') || '- None'}
`;
}

function formatCoachingNote(repName, data) {
  const date = new Date().toISOString().split('T')[0];
  return `---
type: rep_coaching
rep_name: "${repName}"
date: "${date}"
tags: [coaching, team]
---

# Rep Coaching - ${repName} - ${date}

## Scorecard
| Metric | Score |
|--------|-------|
| Activity | ${data.scorecard?.activityScore || 'N/A'} |
| Pipeline Quality | ${data.scorecard?.pipelineQuality || 'N/A'} |
| Forecast Reliability | ${data.scorecard?.forecastReliability || 'N/A'} |
| Follow-Up Consistency | ${data.scorecard?.followUpConsistency || 'N/A'} |
| Win Rate | ${data.scorecard?.winRate || 'N/A'} |

## Coaching Flags
${(data.coachingFlags || []).map(f => `- ${f}`).join('\n') || '- None'}

## Talking Points
${(data.talkingPoints || []).map(t => `- ${t}`).join('\n') || '- None'}

## Action Items
${(data.actionItems || []).map(a => `- [ ] ${a}`).join('\n') || '- [ ] None'}
`;
}

function formatScorecard(repName, data) {
  const date = new Date().toISOString().split('T')[0];
  return `---
type: scorecard
rep_name: "${repName}"
date: "${date}"
tags: [scorecard, team]
---

# Scorecard - ${repName} - ${date}

${JSON.stringify(data, null, 2)}
`;
}

function formatMeetingNote(data) {
  const date = new Date().toISOString().split('T')[0];
  return `---
type: meeting
meeting_type: "${data.meetingType || ''}"
date: "${date}"
tags: [meeting]
---

# ${data.title || 'Meeting'} - ${date}

## Summary
${data.cleanSummary || data.summary || ''}

## Decisions
${(data.decisions || []).map(d => `- ${d}`).join('\n') || '- None'}

## Action Items
${(data.actionItems || []).map(a => `- [ ] ${a.owner ? `@${a.owner}: ` : ''}${a.action}${a.dueDate ? ` (due: ${a.dueDate})` : ''}`).join('\n') || '- [ ] None'}

## Follow-Up
${(data.followUps || []).map(f => `- ${f}`).join('\n') || '- None'}
`;
}

function formatExecutiveSummary(data) {
  const date = new Date().toISOString().split('T')[0];
  return `---
type: executive_summary
date: "${date}"
tags: [executive, summary, leadership]
---

# Executive Summary - ${date}

## Top 3 Priorities
${(data.topPriorities || []).map((p, i) => `${i + 1}. ${p}`).join('\n')}

## Top 3 Risks
${(data.topRisks || []).map((r, i) => `${i + 1}. ${r}`).join('\n')}

## Top 3 Leverage Moves
${(data.topLeverageMoves || []).map((m, i) => `${i + 1}. ${m}`).join('\n')}

## Executive Summary
${data.executiveSummary || ''}

## Attention Required
${(data.attentionRequired || []).map(a => `- ${a}`).join('\n') || '- None'}
`;
}

function formatDailyNote(data) {
  const date = new Date().toISOString().split('T')[0];
  return `---
type: daily_note
date: "${date}"
tags: [daily]
---

# ${date}

## Priorities
${(data.priorities || []).map((p, i) => `${i + 1}. ${p}`).join('\n')}

## Pipeline Risks
${(data.pipelineRisks || []).map(r => `- ${r}`).join('\n') || '- None'}

## Rep Follow-Ups
${(data.repFollowUps || []).map(f => `- [ ] ${f}`).join('\n') || '- [ ] None'}

## Forecast Notes
${data.forecastNotes || '- No updates'}

## Key Actions
${(data.actions || []).map(a => `- [ ] ${a}`).join('\n') || '- [ ] None'}
`;
}

function formatAlert(alertType, data) {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0];
  return `---
type: alert
alert_type: "${alertType}"
date: "${date}"
time: "${time}"
priority: "${data.priority || 'medium'}"
tags: [alert, ${alertType}]
---

# Alert: ${alertType.replace(/_/g, ' ').toUpperCase()} - ${date} ${time}

## Details
${data.message || data.summary || JSON.stringify(data, null, 2)}

## Recommended Action
${data.recommendedAction || '- Review and assess'}

## Status
- [ ] Acknowledged
- [ ] Resolved
`;
}

function formatAgentLog(agentName, data) {
  const date = new Date().toISOString().split('T')[0];
  return `---
type: agent_log
agent: "${agentName}"
date: "${date}"
tags: [agent, log]
---

# Agent Log: ${agentName} - ${date}

## Run Summary
${JSON.stringify(data, null, 2)}
`;
}

function formatReport(reportType, data) {
  const date = new Date().toISOString().split('T')[0];
  return `---
type: report
report_type: "${reportType}"
date: "${date}"
tags: [report, ${reportType}]
---

# ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report - ${date}

${JSON.stringify(data, null, 2)}
`;
}
