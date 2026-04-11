/**
 * Revenue OS — Revenue Leadership Operating System
 *
 * A sales pipeline intelligence platform that functions as a second brain
 * for VP of Sales / revenue leadership.
 *
 * Architecture:
 *   Obsidian  = storage, structure, memory, leadership OS
 *   HubSpot   = live sales data source
 *   Agents    = thinking, summarizing, prioritizing, recommending
 *   Notifications = delivery layer (email, HubSpot tasks, optional Slack)
 *
 * Core flow: Capture → Organize → Retrieve → Summarize → Notify → Lead
 */

export { default as config } from './config.js';
export { HubSpotClient } from './integrations/hubspot.js';
export { HubSpotSync } from './integrations/hubspot-sync.js';
export { default as VaultWriter } from './vault/writer.js';
export { initVault } from './vault/init.js';
export { default as PipelineRiskAgent } from './agents/pipeline-risk.js';
export { default as ForecastConfidenceAgent } from './agents/forecast-confidence.js';
export { default as DealIntelligenceAgent } from './agents/deal-intelligence.js';
export { default as RepPerformanceAgent } from './agents/rep-performance.js';
export { default as ExecutiveFocusAgent } from './agents/executive-focus.js';
export { default as MeetingSummaryAgent } from './agents/meeting-summary.js';
export { default as AgentOrchestrator } from './agents/orchestrator.js';
export { default as AlertEngine } from './notifications/alerts.js';
export { startScheduler } from './scheduler.js';
