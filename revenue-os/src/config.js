import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = {
  hubspot: {
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
    portalId: process.env.HUBSPOT_PORTAL_ID,
  },

  vault: {
    path: process.env.VAULT_PATH || path.join(__dirname, '..', 'vault'),
  },

  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    to: process.env.NOTIFICATION_EMAIL_TO,
    from: process.env.NOTIFICATION_EMAIL_FROM || 'revenue-os@company.com',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  thresholds: {
    staleDealDays: parseInt(process.env.STALE_DEAL_DAYS || '7', 10),
    minPipelineCoverage: parseFloat(process.env.MIN_PIPELINE_COVERAGE || '3.0'),
    repActivityThreshold: parseInt(process.env.REP_ACTIVITY_THRESHOLD || '50', 10),
    forecastDriftThreshold: parseFloat(process.env.FORECAST_DRIFT_THRESHOLD || '10'),
  },

  schedules: {
    dailyBrief: process.env.DAILY_BRIEF_CRON || '0 7 * * 1-5',
    weeklyForecast: process.env.WEEKLY_FORECAST_CRON || '0 8 * * 1',
    pipelineSync: process.env.PIPELINE_SYNC_CRON || '0 */4 * * *',
  },

  // HubSpot deal stages mapping (customize per portal)
  dealStages: {
    qualification: { label: 'Qualification', probability: 0.1 },
    discovery: { label: 'Discovery', probability: 0.2 },
    proposal: { label: 'Proposal', probability: 0.4 },
    negotiation: { label: 'Negotiation', probability: 0.6 },
    commit: { label: 'Commit', probability: 0.8 },
    closed_won: { label: 'Closed Won', probability: 1.0 },
    closed_lost: { label: 'Closed Lost', probability: 0.0 },
  },

  // Custom HubSpot properties to create
  customProperties: {
    deal: [
      { name: 'deal_health_status', label: 'Deal Health Status', type: 'enumeration', options: ['Healthy', 'At Risk', 'Critical', 'Stalled'] },
      { name: 'forecast_risk_level', label: 'Forecast Risk Level', type: 'enumeration', options: ['Low', 'Medium', 'High', 'Critical'] },
      { name: 'days_since_last_activity', label: 'Days Since Last Meaningful Activity', type: 'number' },
      { name: 'leadership_attention_needed', label: 'Leadership Attention Needed', type: 'enumeration', options: ['Yes', 'No'] },
      { name: 'agent_recommended_action', label: 'Agent Recommended Next Action', type: 'string' },
      { name: 'deal_summary_snapshot', label: 'Deal Summary Snapshot', type: 'string' },
      { name: 'stakeholder_risk_level', label: 'Stakeholder Risk Level', type: 'enumeration', options: ['Low', 'Medium', 'High'] },
      { name: 'close_confidence_score', label: 'Close Confidence Score', type: 'number' },
    ],
    contact: [
      { name: 'activity_score', label: 'Activity Score', type: 'number' },
      { name: 'follow_up_consistency', label: 'Follow-Up Consistency', type: 'enumeration', options: ['Excellent', 'Good', 'Needs Improvement', 'Poor'] },
      { name: 'forecast_reliability', label: 'Forecast Reliability', type: 'enumeration', options: ['High', 'Medium', 'Low'] },
      { name: 'stalled_deal_count', label: 'Stalled Deal Count', type: 'number' },
      { name: 'coaching_priority_level', label: 'Coaching Priority Level', type: 'enumeration', options: ['Low', 'Medium', 'High', 'Urgent'] },
    ],
  },
};

export default config;
