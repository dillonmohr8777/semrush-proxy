// Revenue OS — HubSpot Notification / Action Layer
// Creates tasks, notes, and updates deal properties as the action layer on top of HubSpot.

class HubSpotNotifier {
  // ---------------------------------------------------------------------------
  // Risk alerts
  // ---------------------------------------------------------------------------

  /**
   * Creates a task on a deal flagging risk and updates the deal_health_status property.
   *
   * @param {import('../integrations/hubspot.js').HubSpotClient} hubspotClient
   * @param {string} dealId
   * @param {object} riskData
   * @param {string} riskData.riskLevel         — e.g. 'Critical', 'High', 'Medium'
   * @param {string[]} [riskData.signals]       — List of risk signal descriptions.
   * @param {string} [riskData.recommendedAction] — Suggested next step.
   * @param {string} [riskData.dealName]        — Deal name for the task title.
   * @param {string} [riskData.ownerId]         — HubSpot owner to assign the task to.
   * @returns {Promise<{task: object, propertyUpdate: object}>}
   */
  async createRiskAlert(hubspotClient, dealId, riskData) {
    const {
      riskLevel = 'At Risk',
      signals = [],
      recommendedAction = '',
      dealName = '',
      ownerId = '',
    } = riskData;

    const healthStatus = this._normalizeHealthStatus(riskLevel);

    // Build task body with all risk signals
    const signalList = signals.length > 0
      ? signals.map((s, i) => `${i + 1}. ${typeof s === 'string' ? s : s.detail || JSON.stringify(s)}`).join('\n')
      : 'No specific signals documented.';

    const taskBody = [
      `[Revenue OS — Risk Alert]`,
      ``,
      `Deal: ${dealName || dealId}`,
      `Risk Level: ${healthStatus}`,
      ``,
      `Risk Signals:`,
      signalList,
      ``,
      recommendedAction ? `Recommended Action: ${recommendedAction}` : '',
      ``,
      `Generated: ${new Date().toISOString()}`,
    ].filter(Boolean).join('\n');

    const dueDate = this._dueDateFromPriority(riskLevel);

    const results = {};

    // Update deal health status property
    try {
      results.propertyUpdate = await hubspotClient.updateDealProperties(dealId, {
        deal_health_status: healthStatus,
        forecast_risk_level: riskLevel,
      });
    } catch (error) {
      console.error(`[HubSpotNotifier] Failed to update properties on deal ${dealId}:`, error.message);
      results.propertyUpdate = null;
    }

    // Create the task
    try {
      results.task = await hubspotClient.createTask(
        dealId,
        `[Risk Alert] ${dealName || 'Deal'} — ${healthStatus}`,
        taskBody,
        dueDate,
        ownerId,
      );
    } catch (error) {
      console.error(`[HubSpotNotifier] Failed to create risk task on deal ${dealId}:`, error.message);
      results.task = null;
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Coaching tasks
  // ---------------------------------------------------------------------------

  /**
   * Creates a coaching follow-up task assigned to a rep's manager/owner.
   *
   * @param {import('../integrations/hubspot.js').HubSpotClient} hubspotClient
   * @param {string} ownerId — HubSpot owner ID (the rep or their manager).
   * @param {object} coachingData
   * @param {string} coachingData.repName
   * @param {string} [coachingData.coachingPriority]  — 'Low' | 'Medium' | 'High' | 'Urgent'
   * @param {string[]} [coachingData.coachingFocus]    — Focus areas for the 1:1.
   * @param {string[]} [coachingData.issues]           — Issues to address.
   * @param {string[]} [coachingData.talkingPoints]    — 1:1 talking points.
   * @param {string} [coachingData.dealId]             — Optional deal to associate the task with.
   * @returns {Promise<object|null>}
   */
  async createCoachingTask(hubspotClient, ownerId, coachingData) {
    const {
      repName = '',
      coachingPriority = 'Medium',
      coachingFocus = [],
      issues = [],
      talkingPoints = [],
      dealId = null,
    } = coachingData;

    const focusList = coachingFocus.length > 0
      ? coachingFocus.map((f, i) => `${i + 1}. ${f}`).join('\n')
      : 'Review overall performance.';

    const issuesList = issues.length > 0
      ? issues.map((iss, i) => `${i + 1}. ${iss}`).join('\n')
      : '';

    const pointsList = talkingPoints.length > 0
      ? talkingPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : '';

    const taskBody = [
      `[Revenue OS — Coaching Follow-Up]`,
      ``,
      `Rep: ${repName}`,
      `Priority: ${coachingPriority}`,
      ``,
      `Coaching Focus:`,
      focusList,
      issuesList ? `\nIssues to Address:\n${issuesList}` : '',
      pointsList ? `\n1:1 Talking Points:\n${pointsList}` : '',
      ``,
      `Generated: ${new Date().toISOString()}`,
    ].filter(Boolean).join('\n');

    const dueDate = this._dueDateFromPriority(coachingPriority);

    // If a dealId is supplied, associate the task with that deal.
    // Otherwise, we still create the task but without a deal association.
    const associationDealId = dealId || '0';

    try {
      if (dealId) {
        const task = await hubspotClient.createTask(
          dealId,
          `[Coaching] ${repName} — ${coachingPriority} Priority`,
          taskBody,
          dueDate,
          ownerId,
        );
        console.log(`[HubSpotNotifier] Coaching task created for ${repName} on deal ${dealId}.`);
        return task;
      }

      // No deal association — create a standalone task via the raw client.
      // HubSpotClient.createTask requires a dealId; for standalone tasks we
      // fall back to creating via the underlying HubSpot API directly.
      const task = await hubspotClient.client.crm.objects.basicApi.create('tasks', {
        properties: {
          hs_task_subject: `[Coaching] ${repName} — ${coachingPriority} Priority`,
          hs_task_body: taskBody,
          hs_task_status: 'NOT_STARTED',
          hs_task_priority: coachingPriority === 'Urgent' || coachingPriority === 'High' ? 'HIGH' : 'MEDIUM',
          hs_task_due_date: dueDate,
          hubspot_owner_id: ownerId,
          hs_timestamp: new Date().toISOString(),
        },
      });

      console.log(`[HubSpotNotifier] Standalone coaching task created for ${repName}.`);
      return task;
    } catch (error) {
      console.error(`[HubSpotNotifier] Failed to create coaching task for ${repName}:`, error.message);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Leadership notes
  // ---------------------------------------------------------------------------

  /**
   * Adds a leadership attention note to a deal.
   *
   * @param {import('../integrations/hubspot.js').HubSpotClient} hubspotClient
   * @param {string} dealId
   * @param {string} note — The note body (plain text or HTML).
   * @returns {Promise<object|null>}
   */
  async createLeadershipNote(hubspotClient, dealId, note) {
    const formattedNote = [
      `<strong>[Revenue OS — Leadership Note]</strong>`,
      `<br/><br/>`,
      note,
      `<br/><br/>`,
      `<em>Generated: ${new Date().toISOString()}</em>`,
    ].join('');

    try {
      const result = await hubspotClient.createNote(dealId, formattedNote);
      console.log(`[HubSpotNotifier] Leadership note created on deal ${dealId}.`);
      return result;
    } catch (error) {
      console.error(`[HubSpotNotifier] Failed to create leadership note on deal ${dealId}:`, error.message);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Flag for leadership
  // ---------------------------------------------------------------------------

  /**
   * Sets leadership_attention_needed = 'Yes' on a deal.
   *
   * @param {import('../integrations/hubspot.js').HubSpotClient} hubspotClient
   * @param {string} dealId
   * @returns {Promise<object|null>}
   */
  async flagForLeadership(hubspotClient, dealId) {
    try {
      const result = await hubspotClient.updateDealProperties(dealId, {
        leadership_attention_needed: 'Yes',
      });
      console.log(`[HubSpotNotifier] Deal ${dealId} flagged for leadership attention.`);
      return result;
    } catch (error) {
      console.error(`[HubSpotNotifier] Failed to flag deal ${dealId} for leadership:`, error.message);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Deal insights write-back
  // ---------------------------------------------------------------------------

  /**
   * Writes agent_recommended_action and deal_summary_snapshot to a deal.
   *
   * @param {import('../integrations/hubspot.js').HubSpotClient} hubspotClient
   * @param {string} dealId
   * @param {object} insights
   * @param {string} [insights.recommendedAction] — Next recommended action.
   * @param {string} [insights.summarySnapshot]   — Deal summary snapshot text.
   * @param {number} [insights.confidenceScore]   — Close confidence score (0-100).
   * @returns {Promise<object|null>}
   */
  async updateDealInsights(hubspotClient, dealId, insights) {
    const {
      recommendedAction = '',
      summarySnapshot = '',
      confidenceScore = null,
    } = insights;

    const properties = {};

    if (recommendedAction) {
      properties.agent_recommended_action = recommendedAction;
    }
    if (summarySnapshot) {
      properties.deal_summary_snapshot = summarySnapshot;
    }
    if (confidenceScore != null) {
      properties.close_confidence_score = String(confidenceScore);
    }

    if (Object.keys(properties).length === 0) {
      console.warn(`[HubSpotNotifier] No insights to write for deal ${dealId}.`);
      return null;
    }

    try {
      const result = await hubspotClient.updateDealProperties(dealId, properties);
      console.log(`[HubSpotNotifier] Insights updated on deal ${dealId}.`);
      return result;
    } catch (error) {
      console.error(`[HubSpotNotifier] Failed to update insights on deal ${dealId}:`, error.message);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Normalizes a risk level string into a valid deal_health_status enum value.
   *
   * @param {string} riskLevel
   * @returns {'Healthy'|'At Risk'|'Critical'|'Stalled'}
   */
  _normalizeHealthStatus(riskLevel) {
    const normalized = String(riskLevel).toLowerCase();
    if (normalized === 'critical') return 'Critical';
    if (normalized === 'high' || normalized === 'at risk') return 'At Risk';
    if (normalized === 'stalled') return 'Stalled';
    if (normalized === 'medium') return 'At Risk';
    return 'Healthy';
  }

  /**
   * Calculates a task due date based on alert priority.
   * Critical/Urgent = today, High = +1 day, Medium = +2 days, Low = +5 days.
   *
   * @param {string} priority
   * @returns {string} ISO-8601 date string.
   */
  _dueDateFromPriority(priority) {
    const now = new Date();
    const normalized = String(priority).toLowerCase();

    let daysOffset = 2;
    if (normalized === 'critical' || normalized === 'urgent') daysOffset = 0;
    else if (normalized === 'high') daysOffset = 1;
    else if (normalized === 'low') daysOffset = 5;

    now.setDate(now.getDate() + daysOffset);
    return now.toISOString();
  }
}

export default HubSpotNotifier;
