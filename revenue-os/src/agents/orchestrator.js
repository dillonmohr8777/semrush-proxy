import PipelineRiskAgent from './pipeline-risk.js';
import ForecastConfidenceAgent from './forecast-confidence.js';
import DealIntelligenceAgent from './deal-intelligence.js';
import RepPerformanceAgent from './rep-performance.js';
import ExecutiveFocusAgent from './executive-focus.js';
import MeetingSummaryAgent from './meeting-summary.js';

class AgentOrchestrator {
  constructor(options = {}) {
    this.pipelineRisk = new PipelineRiskAgent(options.pipelineRisk);
    this.forecastConfidence = new ForecastConfidenceAgent(options.forecastConfidence);
    this.dealIntelligence = new DealIntelligenceAgent(options.dealIntelligence);
    this.repPerformance = new RepPerformanceAgent(options.repPerformance);
    this.executiveFocus = new ExecutiveFocusAgent(options.executiveFocus);
    this.meetingSummary = new MeetingSummaryAgent(options.meetingSummary);
  }

  /**
   * Run daily analysis: Pipeline Risk, Forecast Confidence, and Executive Focus.
   * Provides the leadership morning briefing data.
   *
   * @param {Object} hubspotClient - An instance of HubSpotClient.
   * @param {Object} options       - { historicalData, quarterTarget }
   * @returns {Promise<Object>}
   */
  async runDailyAnalysis(hubspotClient, options = {}) {
    const { historicalData = {}, quarterTarget = 0 } = options;
    const startedAt = new Date().toISOString();

    // Fetch all deals
    const deals = await hubspotClient.getDeals();

    // Run pipeline risk analysis
    const pipelineRiskResult = this.pipelineRisk.analyze(deals);

    // Run forecast confidence analysis
    const forecastConfidenceResult = this.forecastConfidence.analyze(
      deals,
      historicalData,
      quarterTarget,
    );

    // Run executive focus synthesis (using the two results above, without deal or rep details)
    const executiveFocusResult = this.executiveFocus.analyze(
      pipelineRiskResult,
      forecastConfidenceResult,
      [],
      [],
    );

    return {
      type: 'daily_analysis',
      startedAt,
      completedAt: new Date().toISOString(),
      pipelineRisk: pipelineRiskResult,
      forecastConfidence: forecastConfidenceResult,
      executiveFocus: executiveFocusResult,
    };
  }

  /**
   * Run deep analysis on a specific deal.
   *
   * @param {Object} hubspotClient - An instance of HubSpotClient.
   * @param {string} dealId        - The HubSpot deal ID.
   * @returns {Promise<Object>}
   */
  async analyzeDeal(hubspotClient, dealId) {
    const startedAt = new Date().toISOString();

    // Fetch deal and its activities in parallel
    const [deal, activities] = await Promise.all([
      hubspotClient.getDealById(dealId),
      hubspotClient.getDealActivities(dealId),
    ]);

    // Merge properties to top level for consistent access
    const dealData = { ...deal.properties, ...deal, id: deal.id };

    // Run deal intelligence analysis
    const intelligence = this.dealIntelligence.analyze(dealData, activities);

    // Also run a health score via pipeline risk
    const healthScore = this.pipelineRisk.scoreDealHealth(dealData);

    return {
      type: 'deal_analysis',
      startedAt,
      completedAt: new Date().toISOString(),
      dealId,
      dealName: dealData.dealname || dealData.name || 'Unnamed Deal',
      healthScore,
      intelligence,
    };
  }

  /**
   * Run coaching analysis for a specific sales rep.
   *
   * @param {Object} hubspotClient - An instance of HubSpotClient.
   * @param {string} ownerId       - The HubSpot owner ID.
   * @returns {Promise<Object>}
   */
  async runCoachingAnalysis(hubspotClient, ownerId) {
    const startedAt = new Date().toISOString();

    // Fetch owner's deals
    const deals = await hubspotClient.getOwnerDeals(ownerId);

    // Fetch activities for each deal (limit to first 20 to avoid rate limiting)
    const dealSubset = deals.slice(0, 20);
    const activitiesArray = await Promise.all(
      dealSubset.map(deal => hubspotClient.getDealActivities(deal.id).catch(() => ({})))
    );

    // Merge all activities into one aggregate object
    const aggregatedActivities = this._mergeActivities(activitiesArray);

    // Fetch owner info
    const owners = await hubspotClient.getOwners();
    const owner = owners.find(o => String(o.id) === String(ownerId)) || { id: ownerId };

    // Normalize deal data
    const normalizedDeals = deals.map(d => ({ ...d.properties, ...d, id: d.id }));

    // Run rep performance analysis
    const performance = this.repPerformance.analyze(owner, normalizedDeals, aggregatedActivities);

    return {
      type: 'coaching_analysis',
      startedAt,
      completedAt: new Date().toISOString(),
      ownerId,
      repName: performance.scorecard.repName,
      performance,
    };
  }

  /**
   * Run the full agent suite: all analyses combined.
   *
   * @param {Object} hubspotClient - An instance of HubSpotClient.
   * @param {Object} options       - { historicalData, quarterTarget }
   * @returns {Promise<Object>}
   */
  async runFullSuite(hubspotClient, options = {}) {
    const { historicalData = {}, quarterTarget = 0 } = options;
    const startedAt = new Date().toISOString();

    // Fetch all deals and owners in parallel
    const [deals, owners] = await Promise.all([
      hubspotClient.getDeals(),
      hubspotClient.getOwners(),
    ]);

    // 1. Pipeline Risk
    const pipelineRiskResult = this.pipelineRisk.analyze(deals);

    // 2. Forecast Confidence
    const forecastConfidenceResult = this.forecastConfidence.analyze(
      deals,
      historicalData,
      quarterTarget,
    );

    // 3. Deal Intelligence — analyze top at-risk deals (limit to top 10 for performance)
    const criticalDeals = (pipelineRiskResult.riskFlags || [])
      .filter(f => f.riskLevel === 'critical' || f.riskLevel === 'high')
      .slice(0, 10);

    const dealIntelligenceResults = await Promise.all(
      criticalDeals.map(async flag => {
        try {
          const [deal, activities] = await Promise.all([
            hubspotClient.getDealById(flag.dealId),
            hubspotClient.getDealActivities(flag.dealId),
          ]);
          const dealData = { ...deal.properties, ...deal, id: deal.id };
          return this.dealIntelligence.analyze(dealData, activities);
        } catch (err) {
          console.error(`[Orchestrator] Failed to analyze deal ${flag.dealId}:`, err.message);
          return null;
        }
      })
    );
    const validDealIntelligence = dealIntelligenceResults.filter(Boolean);

    // 4. Rep Performance — analyze each owner
    const repPerformanceResults = await Promise.all(
      owners.map(async owner => {
        try {
          const ownerDeals = deals.filter(d => {
            const dealOwnerId = d.properties?.hubspot_owner_id || d.hubspot_owner_id;
            return String(dealOwnerId) === String(owner.id);
          });

          if (ownerDeals.length === 0) return null;

          // Fetch activities for a subset of their deals
          const subset = ownerDeals.slice(0, 10);
          const activitiesArray = await Promise.all(
            subset.map(deal => hubspotClient.getDealActivities(deal.id).catch(() => ({})))
          );
          const aggregatedActivities = this._mergeActivities(activitiesArray);

          const normalizedDeals = ownerDeals.map(d => ({ ...d.properties, ...d, id: d.id }));
          return this.repPerformance.analyze(owner, normalizedDeals, aggregatedActivities);
        } catch (err) {
          console.error(`[Orchestrator] Failed to analyze rep ${owner.id}:`, err.message);
          return null;
        }
      })
    );
    const validRepPerformance = repPerformanceResults.filter(Boolean);

    // 5. Executive Focus — synthesize everything
    const executiveFocusResult = this.executiveFocus.analyze(
      pipelineRiskResult,
      forecastConfidenceResult,
      validDealIntelligence,
      validRepPerformance,
    );

    return {
      type: 'full_suite',
      startedAt,
      completedAt: new Date().toISOString(),
      pipelineRisk: pipelineRiskResult,
      forecastConfidence: forecastConfidenceResult,
      dealIntelligence: validDealIntelligence,
      repPerformance: validRepPerformance,
      executiveFocus: executiveFocusResult,
    };
  }

  /**
   * Process meeting notes through the Meeting Summary agent.
   *
   * @param {string} rawNotes    - The raw meeting notes.
   * @param {string} meetingType - One of: pipeline_review, rep_1on1, forecast_call, leadership, team.
   * @returns {Object}
   */
  processMeeting(rawNotes, meetingType) {
    return this.meetingSummary.processMeeting(rawNotes, meetingType);
  }

  // ─── Internal: Helpers ─────────────────────────────────────

  /**
   * Merge multiple activity objects into one aggregate.
   * Each activity object has keys: notes, tasks, meetings, calls, emails.
   */
  _mergeActivities(activitiesArray) {
    const merged = {
      notes: [],
      tasks: [],
      meetings: [],
      calls: [],
      emails: [],
    };

    for (const activities of activitiesArray) {
      if (!activities) continue;
      for (const type of Object.keys(merged)) {
        if (Array.isArray(activities[type])) {
          merged[type].push(...activities[type]);
        }
      }
    }

    return merged;
  }
}

export default AgentOrchestrator;
