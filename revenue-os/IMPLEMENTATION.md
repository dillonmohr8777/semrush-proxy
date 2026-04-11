# Revenue OS — Implementation Roadmap

> A revenue leadership operating system for VP of Sales.
> Obsidian + HubSpot + Claude Agents + Universal Notifications.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Revenue OS                         │
├──────────┬──────────┬──────────────┬────────────────┤
│ Obsidian │ HubSpot  │    Agents    │ Notifications  │
│  Vault   │   API    │  (Analysis)  │   (Delivery)   │
├──────────┼──────────┼──────────────┼────────────────┤
│ Storage  │ Live     │ Pipeline     │ Email          │
│ Structure│ Data     │ Risk         │ HubSpot Tasks  │
│ Memory   │ Source   │ Forecast     │ HubSpot Notes  │
│ Templates│ CRM      │ Deal Intel   │ Slack (v2)     │
│ Notes    │ Actions  │ Rep Perf     │ Teams (v2)     │
│          │          │ Exec Focus   │                │
│          │          │ Meeting Sum  │                │
└──────────┴──────────┴──────────────┴────────────────┘
```

**Core Flow:** Capture → Organize → Retrieve → Summarize → Notify → Lead

---

## Phase 1: Build the Brain Structure (Week 1)

### Tasks
- [ ] Install Revenue OS: `cd revenue-os && npm install`
- [ ] Copy `.env.example` to `.env` and configure
- [ ] Initialize Obsidian vault: `npm run init-vault -- /path/to/Revenue-OS-Vault`
- [ ] Open vault in Obsidian as a **new, separate vault**
- [ ] Verify all 12 top-level folders and templates exist
- [ ] Install Obsidian plugins: Templater, Dataview, Calendar

### Vault Structure Created
```
/00_Inbox
/01_Pipeline/Snapshots, Reviews
/02_Deals/Active, Won, Lost, At_Risk
/03_Forecasts/Weekly, Monthly, Quarterly
/04_Team/Scorecards, Coaching, 1on1s
/05_Meetings/Pipeline_Reviews, Leadership, Board, Team
/06_Leadership/Strategy, Quarterly_Planning, Exec_Summaries
/07_Playbooks/Sales_Process, Objection_Handling, Competitive
/08_Notifications/Alerts, Archive
/09_Daily_Notes
/10_Reports/Pipeline, Forecast, Team
/11_Agents/Logs, Configs
/_templates
```

### Note Templates Available
1. Deal Note — company, stakeholders, risks, next steps, leadership notes
2. Pipeline Review — snapshot metrics, stage distribution, top risks/opportunities
3. Rep Coaching — performance scorecard, strengths, issues, action items
4. Daily Note — priorities, risks, follow-ups, forecast notes
5. Executive Summary — pipeline health, forecast status, key risks/wins
6. Meeting Note — summary, decisions, action items, follow-ups
7. Forecast Note — confidence assessment, drift tracking, rep-level forecast

---

## Phase 2: Connect HubSpot (Week 2)

### Tasks
- [ ] Create HubSpot Private App with required scopes
- [ ] Set `HUBSPOT_ACCESS_TOKEN` in `.env`
- [ ] Run `npm run setup-hubspot` to create custom properties
- [ ] Run `npm run sync` to verify data pull
- [ ] Verify deal notes appear in vault under `02_Deals/`
- [ ] Verify pipeline snapshot appears under `01_Pipeline/Snapshots/`

### Data Pulled from HubSpot
| Field | Purpose |
|-------|---------|
| Deal name | Identification |
| Owner | Rep assignment |
| Amount | Pipeline value |
| Stage | Pipeline position |
| Close date | Forecast timing |
| Last activity | Engagement tracking |
| Tasks | Execution tracking |
| Meeting notes | Activity context |
| Emails | Engagement tracking |
| Call notes | Activity context |
| Contact/company associations | Stakeholder mapping |

### Data Written Back to HubSpot
| Property | Purpose |
|----------|---------|
| Deal Health Status | Risk visibility in CRM |
| Forecast Risk Level | Forecast reliability |
| Days Since Last Activity | Stale deal detection |
| Leadership Attention Needed | Escalation flag |
| Agent Recommended Action | Next step guidance |
| Deal Summary Snapshot | Quick deal overview |
| Stakeholder Risk Level | Relationship health |
| Close Confidence Score | Win probability |

### Custom Properties Created
**Deal-level:**
- `deal_health_status` (Healthy / At Risk / Critical / Stalled)
- `forecast_risk_level` (Low / Medium / High / Critical)
- `days_since_last_activity` (number)
- `leadership_attention_needed` (Yes / No)
- `agent_recommended_action` (text)
- `deal_summary_snapshot` (text)
- `stakeholder_risk_level` (Low / Medium / High)
- `close_confidence_score` (number 0-100)

**Rep-level (Contact owner):**
- `activity_score` (number)
- `follow_up_consistency` (Excellent / Good / Needs Improvement / Poor)
- `forecast_reliability` (High / Medium / Low)
- `stalled_deal_count` (number)
- `coaching_priority_level` (Low / Medium / High / Urgent)

---

## Phase 3: Build V1 Agents (Week 3-4)

### Tasks
- [ ] Test Pipeline Risk Agent: `npm run pipeline-review`
- [ ] Test Forecast Confidence Agent: `npm run forecast`
- [ ] Test Deal Intelligence Agent: `node src/cli.js deal <dealId>`
- [ ] Test Rep Performance Agent: `node src/cli.js coaching <ownerId>`
- [ ] Test Executive Focus Agent (part of daily brief)
- [ ] Test Meeting Summary Agent: `node src/cli.js meeting pipeline_review -f notes.txt`

### Agent Descriptions

**1. Pipeline Risk Agent**
- Flags deals likely to stall, slip, or die
- Inputs: stage history, last activity, close date movement, task completion, engagement gaps
- Outputs: risk flags, deal health notes, manager alerts, next-step recommendations
- Scoring: 0-100 health score per deal

**2. Forecast Confidence Agent**
- Estimates how reliable the quarter forecast is
- Inputs: weighted pipeline, commit deals, stage velocity, historical close behavior
- Outputs: confidence score (0-100), forecast drift warnings, weekly summary

**3. Deal Intelligence Agent**
- Turns messy deal data into leadership-ready summaries
- Inputs: call notes, emails, meeting notes, deal updates, stage changes
- Outputs: concise summary, blocker summary, stakeholder analysis, recommended intervention

**4. Rep Performance Agent**
- Highlights coaching needs and execution gaps
- Inputs: activity levels, follow-up speed, task completion, stage progression, forecast accuracy
- Outputs: rep scorecards, coaching flags, 1:1 talking points

**5. Executive Focus Agent**
- Synthesizes all agents into "what matters today"
- Inputs: all other agent outputs
- Outputs: top 3 priorities, top 3 risks, top 3 leverage moves

**6. Meeting Summary Agent**
- Processes leadership meetings, pipeline reviews, 1:1s, forecast calls
- Inputs: rough notes, transcripts, bullet points
- Outputs: clean summary, decisions, action items, deal updates

---

## Phase 4: Add Notifications (Week 5)

### Tasks
- [ ] Configure SMTP credentials in `.env`
- [ ] Test daily brief email: `npm run daily-brief`
- [ ] Test deal risk alerts
- [ ] Test forecast drift alerts
- [ ] Set up scheduled execution: `node src/cli.js run`
- [ ] Verify HubSpot tasks/notes are created correctly

### Alert Types

| Alert | Trigger | Channel |
|-------|---------|---------|
| Daily Executive Brief | Every weekday morning | Email + Vault |
| Deal Risk Alert | No activity X days, close date pushed, stage stalled | Email + HubSpot task + Vault |
| Forecast Drift Alert | Quarter confidence drops, coverage weakens | Email + Vault |
| Rep Coaching Alert | Activity drops, deals neglected, forecast unreliable | Email + HubSpot task + Vault |
| Opportunity Acceleration | Big deal momentum, engagement spike | Email + Vault |
| Weekly Forecast Memo | Monday mornings | Email + Vault |

### Channel Priority
1. **HubSpot** — tasks, notes, risk flags, dashboards, saved views
2. **Email** — daily brief, weekly forecast memo, major risk alerts
3. **Slack/Teams (v2)** — urgent movement, manager pings

### Schedules
| Job | Default Schedule |
|-----|-----------------|
| Daily Executive Brief | 7:00 AM Mon-Fri |
| Weekly Forecast Memo | 8:00 AM Monday |
| Pipeline Sync | Every 4 hours |

---

## Phase 5: Advanced Intelligence (V2)

### Planned Enhancements
- [ ] Claude API integration for natural language deal summaries
- [ ] Rep scorecards with historical trending
- [ ] Forecast drift modeling with pattern recognition
- [ ] Leadership heat maps (visual pipeline health)
- [ ] Slack/Teams integration for real-time alerts
- [ ] Competitive intelligence tracking
- [ ] Board meeting prep automation
- [ ] Quarter planning templates and analysis
- [ ] Win/loss analysis agent
- [ ] Deal velocity optimization recommendations

---

## What This System Enables

The VP of Sales can now:

| Before | After |
|--------|-------|
| Dig through HubSpot to find problems | See pipeline risk at a glance |
| Open 20 deal records to prep for reviews | Get instant deal health summaries |
| Guess which reps need help | Get evidence-based coaching alerts |
| Build forecasts in spreadsheets | See forecast confidence in real time |
| Miss early warning signs | Receive proactive risk notifications |
| Prep for leadership meetings manually | Get auto-generated executive summaries |
| Store notes across email, docs, CRM | Centralize everything in one system |
| React to quarter problems | Anticipate and prevent them |

---

## Quick Start

```bash
# 1. Install
cd revenue-os
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your HubSpot token, email credentials, vault path

# 3. Initialize vault
npm run init-vault -- /path/to/Revenue-OS-Vault

# 4. Set up HubSpot custom properties
node src/cli.js setup-hubspot

# 5. First sync
npm run sync

# 6. Generate first daily brief
npm run daily-brief

# 7. Start automated scheduler
node src/cli.js run
```

---

## Separation Rules

This system is completely isolated:
- **Separate Obsidian vault** — never add to an existing vault
- **Separate Claude session** — no memory bleed from other workflows
- **Separate API context** — different environment variables, logs, outputs
- **Zero crossover** — no shared notes, prompts, naming, or outputs
