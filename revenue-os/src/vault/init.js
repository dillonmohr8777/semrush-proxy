import fs from 'fs/promises';
import path from 'path';

const VAULT_FOLDERS = [
  '00_Inbox',
  '01_Pipeline',
  '01_Pipeline/Snapshots',
  '01_Pipeline/Reviews',
  '02_Deals',
  '02_Deals/Active',
  '02_Deals/Won',
  '02_Deals/Lost',
  '02_Deals/At_Risk',
  '03_Forecasts',
  '03_Forecasts/Weekly',
  '03_Forecasts/Monthly',
  '03_Forecasts/Quarterly',
  '04_Team',
  '04_Team/Scorecards',
  '04_Team/Coaching',
  '04_Team/1on1s',
  '05_Meetings',
  '05_Meetings/Pipeline_Reviews',
  '05_Meetings/Leadership',
  '05_Meetings/Board',
  '05_Meetings/Team',
  '06_Leadership',
  '06_Leadership/Strategy',
  '06_Leadership/Quarterly_Planning',
  '06_Leadership/Exec_Summaries',
  '07_Playbooks',
  '07_Playbooks/Sales_Process',
  '07_Playbooks/Objection_Handling',
  '07_Playbooks/Competitive',
  '08_Notifications',
  '08_Notifications/Alerts',
  '08_Notifications/Archive',
  '09_Daily_Notes',
  '10_Reports',
  '10_Reports/Pipeline',
  '10_Reports/Forecast',
  '10_Reports/Team',
  '11_Agents',
  '11_Agents/Logs',
  '11_Agents/Configs',
  '_templates',
];

export async function initVault(vaultPath) {
  console.log(`Initializing Revenue OS vault at: ${vaultPath}`);

  for (const folder of VAULT_FOLDERS) {
    const fullPath = path.join(vaultPath, folder);
    await fs.mkdir(fullPath, { recursive: true });
    console.log(`  Created: ${folder}/`);
  }

  await writeTemplates(vaultPath);
  await writeVaultConfig(vaultPath);

  console.log('\nRevenue OS vault initialized successfully.');
  console.log('Open this folder as a new vault in Obsidian.');
  console.log('DO NOT add this to any existing vault.');
}

async function writeVaultConfig(vaultPath) {
  const obsidianDir = path.join(vaultPath, '.obsidian');
  await fs.mkdir(obsidianDir, { recursive: true });

  const appConfig = {
    alwaysUpdateLinks: true,
    newFileLocation: 'folder',
    newFileFolderPath: '00_Inbox',
    attachmentFolderPath: '_attachments',
    showUnsupportedFiles: false,
    defaultViewMode: 'source',
  };

  await fs.writeFile(
    path.join(obsidianDir, 'app.json'),
    JSON.stringify(appConfig, null, 2)
  );

  const dailyNotesConfig = {
    folder: '09_Daily_Notes',
    format: 'YYYY-MM-DD',
    template: '_templates/Daily_Note',
  };

  await fs.writeFile(
    path.join(obsidianDir, 'daily-notes.json'),
    JSON.stringify(dailyNotesConfig, null, 2)
  );

  const templatesConfig = {
    folder: '_templates',
  };

  await fs.writeFile(
    path.join(obsidianDir, 'templates.json'),
    JSON.stringify(templatesConfig, null, 2)
  );
}

async function writeTemplates(vaultPath) {
  const templateDir = path.join(vaultPath, '_templates');

  const templates = getTemplates();

  for (const [filename, content] of Object.entries(templates)) {
    await fs.writeFile(path.join(templateDir, `${filename}.md`), content);
    console.log(`  Template: ${filename}.md`);
  }
}

function getTemplates() {
  return {
    Deal_Note: getDealTemplate(),
    Pipeline_Review: getPipelineReviewTemplate(),
    Rep_Coaching: getRepCoachingTemplate(),
    Daily_Note: getDailyNoteTemplate(),
    Executive_Summary: getExecutiveSummaryTemplate(),
    Meeting_Note: getMeetingNoteTemplate(),
    Forecast_Note: getForecastNoteTemplate(),
  };
}

function getDealTemplate() {
  return `---
type: deal
company: "{{Company}}"
owner: ""
stage: ""
amount: 0
close_date: ""
health_status: ""
forecast_risk: ""
close_confidence: 0
leadership_attention: false
created: "{{date:YYYY-MM-DD}}"
updated: "{{date:YYYY-MM-DD}}"
tags: [deal]
---

# Deal: {{Company}}

## Overview
| Field | Value |
|-------|-------|
| Owner | |
| Stage | |
| Amount | |
| Close Date | |
| Days in Stage | |
| Health Status | |

## Summary
-

## Key Stakeholders
| Name | Title | Role | Sentiment |
|------|-------|------|-----------|
| | | Decision Maker | |
| | | Champion | |
| | | Blocker | |

## Risks
- [ ] No executive sponsor identified
- [ ] Competitor actively engaged
- [ ] Budget not confirmed
- [ ] Timeline unclear
- [ ] Technical blockers exist

## Next Steps
- [ ]

## Activity Timeline
### Recent Activity
-

### Engagement Gaps
-

## Leadership Notes
> Notes from VP review

## Agent Recommended Actions
> Auto-populated by Deal Intelligence Agent

## Linked Notes
-
`;
}

function getPipelineReviewTemplate() {
  return `---
type: pipeline_review
date: "{{date:YYYY-MM-DD}}"
total_pipeline: 0
weighted_pipeline: 0
forecast_confidence: ""
risk_level: ""
created: "{{date:YYYY-MM-DD}}"
tags: [pipeline, review]
---

# Pipeline Review - {{date:YYYY-MM-DD}}

## Snapshot
| Metric | Value | Change |
|--------|-------|--------|
| Total Pipeline | | |
| Weighted Pipeline | | |
| Pipeline Coverage | | |
| Forecast Confidence | | |
| Risk Level | | |
| Deals in Pipeline | | |
| Avg Deal Size | | |
| Avg Days in Stage | | |

## Stage Distribution
| Stage | Count | Value | Weighted |
|-------|-------|-------|----------|
| Qualification | | | |
| Discovery | | | |
| Proposal | | | |
| Negotiation | | | |
| Closed Won | | | |
| Closed Lost | | | |

## Top Opportunities
1.
2.
3.

## Top Risks
1.
2.
3.

## Deals Requiring Leadership Attention
- [ ]

## Stage Movement This Week
### Moved Forward
-

### Moved Backward
-

### Stalled (No Movement)
-

## Notes


## Actions
- [ ]
`;
}

function getRepCoachingTemplate() {
  return `---
type: rep_coaching
rep_name: "{{Rep Name}}"
date: "{{date:YYYY-MM-DD}}"
activity_score: 0
pipeline_quality: ""
forecast_reliability: ""
coaching_priority: ""
created: "{{date:YYYY-MM-DD}}"
tags: [coaching, team]
---

# Rep Coaching - {{Rep Name}} - {{date:YYYY-MM-DD}}

## Performance Snapshot
| Metric | Current | Target | Trend |
|--------|---------|--------|-------|
| Activity Level | | | |
| Pipeline Value | | | |
| Pipeline Quality | | | |
| Forecast Reliability | | | |
| Win Rate | | | |
| Avg Deal Cycle | | | |
| Stalled Deals | | | |

## Strengths
-

## Issues
-

## Deal Review
### Deals on Track
-

### Deals at Risk
-

### Deals Requiring Intervention
-

## Coaching Focus Areas
1.
2.
3.

## 1:1 Talking Points
-

## Action Items
- [ ] Rep action:
- [ ] Manager action:

## Follow-Up Date
-

## Historical Notes
> Previous coaching sessions referenced here
`;
}

function getDailyNoteTemplate() {
  return `---
type: daily_note
date: "{{date:YYYY-MM-DD}}"
created: "{{date:YYYY-MM-DD}}"
tags: [daily]
---

# {{date:YYYY-MM-DD}}

## Priorities
1.
2.
3.

## Pipeline Risks
-

## Rep Follow-Ups
- [ ]

## Forecast Notes
-

## Meetings Today
-

## Key Decisions Made
-

## Leadership Actions
- [ ]

## Notes
-

## End of Day Review
- What moved forward:
- What needs attention tomorrow:
- Open questions:
`;
}

function getExecutiveSummaryTemplate() {
  return `---
type: executive_summary
date: "{{date:YYYY-MM-DD}}"
period: ""
created: "{{date:YYYY-MM-DD}}"
tags: [executive, summary, leadership]
---

# Executive Summary - {{date:YYYY-MM-DD}}

## Pipeline Health
| Metric | Value | vs Last Week | vs Target |
|--------|-------|-------------|-----------|
| Total Pipeline | | | |
| Weighted Pipeline | | | |
| Coverage Ratio | | | |
| New Pipeline Added | | | |
| Pipeline Velocity | | | |

## Forecast Status
| Category | Value | Confidence |
|----------|-------|------------|
| Commit | | |
| Best Case | | |
| Upside | | |
| Total Forecast | | |
| Quarter Target | | |
| Gap to Target | | |

## Key Risks
1.
2.
3.

## Key Wins
1.
2.
3.

## Team Signals
| Rep | Signal | Action Needed |
|-----|--------|--------------|
| | | |

## Competitive Intelligence
-

## Recommended Focus
1.
2.
3.

## Items for Leadership Discussion
-

## Quarter Outlook
-
`;
}

function getMeetingNoteTemplate() {
  return `---
type: meeting
meeting_type: ""
date: "{{date:YYYY-MM-DD}}"
attendees: []
created: "{{date:YYYY-MM-DD}}"
tags: [meeting]
---

# Meeting: {{Title}} - {{date:YYYY-MM-DD}}

## Details
| Field | Value |
|-------|-------|
| Type | |
| Date | {{date:YYYY-MM-DD}} |
| Attendees | |
| Duration | |

## Agenda
1.
2.
3.

## Summary
-

## Decisions Made
-

## Action Items
- [ ] @owner:

## Updates to Deals/Pipeline
-

## Follow-Up Required
-

## Notes
-
`;
}

function getForecastNoteTemplate() {
  return `---
type: forecast
date: "{{date:YYYY-MM-DD}}"
period: ""
confidence_score: 0
drift_status: ""
created: "{{date:YYYY-MM-DD}}"
tags: [forecast]
---

# Forecast - {{date:YYYY-MM-DD}}

## Quarter Overview
| Metric | Value |
|--------|-------|
| Quarter | |
| Target | |
| Commit | |
| Best Case | |
| Upside | |
| Current Attainment | |
| Remaining Days | |

## Confidence Assessment
| Category | Score | Notes |
|----------|-------|-------|
| Commit Reliability | /10 | |
| Pipeline Coverage | /10 | |
| Stage Velocity | /10 | |
| Historical Pattern | /10 | |
| Overall Confidence | /10 | |

## Forecast Movement
### Added to Forecast
-

### Removed from Forecast
-

### Amount Changes
-

### Date Changes
-

## Risk to Forecast
1.
2.
3.

## Upside Opportunities
1.
2.
3.

## Rep-Level Forecast
| Rep | Commit | Best Case | Confidence |
|-----|--------|-----------|------------|
| | | | |

## Notes
-
`;
}

export { getTemplates, VAULT_FOLDERS };
