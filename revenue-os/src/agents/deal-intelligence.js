import config from '../config.js';

const MOMENTUM_WINDOW_DAYS = 14;
const IDEAL_ACTIVITY_PER_WEEK = 3;

class DealIntelligenceAgent {
  constructor(options = {}) {
    this.momentumWindow = options.momentumWindowDays ?? MOMENTUM_WINDOW_DAYS;
    this.idealActivityPerWeek = options.idealActivityPerWeek ?? IDEAL_ACTIVITY_PER_WEEK;
  }

  /**
   * Full deal intelligence analysis: blockers, stakeholders, momentum, recommendations.
   *
   * @param {Object} deal       - Deal object from HubSpot.
   * @param {Object} activities - { notes: [], tasks: [], meetings: [], calls: [], emails: [] }
   * @returns {Object}
   */
  analyze(deal, activities = {}) {
    const allActivities = this._flattenActivities(activities);
    const sorted = this._sortByDate(allActivities);

    const blockers = this._identifyBlockers(deal, sorted, activities);
    const stakeholderAnalysis = this._analyzeStakeholders(deal, activities);
    const momentumScore = this._calculateMomentum(deal, sorted);
    const recommendedIntervention = this._recommendIntervention(deal, blockers, stakeholderAnalysis, momentumScore);
    const summary = this.generateDealSummary(deal, activities);
    const leadershipBrief = this._buildLeadershipBrief(deal, blockers, stakeholderAnalysis, momentumScore, summary);

    return {
      summary,
      blockers,
      stakeholderAnalysis,
      momentumScore,
      recommendedIntervention,
      leadershipBrief,
    };
  }

  /**
   * Generate a concise one-paragraph summary of a deal's current state.
   *
   * @param {Object} deal
   * @param {Object} activities - { notes: [], tasks: [], meetings: [], calls: [], emails: [] }
   * @returns {string}
   */
  generateDealSummary(deal, activities = {}) {
    const name = deal.dealname || deal.name || 'Unnamed Deal';
    const amount = this._formatCurrency(this._dealAmount(deal));
    const stage = this._stageLabel(deal);
    const owner = deal.hubspot_owner_id || deal.owner || 'unassigned';
    const closeDate = deal.closedate || deal.close_date;

    const allActivities = this._flattenActivities(activities);
    const totalActivities = allActivities.length;
    const recentActivities = allActivities.filter(a => this._isWithinDays(a.timestamp, 14)).length;

    const lastActivityDate = this._mostRecentActivityDate(allActivities);
    const daysSinceActivity = lastActivityDate
      ? Math.floor((Date.now() - lastActivityDate) / (1000 * 60 * 60 * 24))
      : null;

    const activityStatus = daysSinceActivity === null
      ? 'No recorded activity'
      : daysSinceActivity === 0
        ? 'Activity today'
        : daysSinceActivity === 1
          ? 'Activity yesterday'
          : `Last activity ${daysSinceActivity} days ago`;

    const closeDateStr = closeDate
      ? new Date(closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'no close date set';

    const meetingCount = (activities.meetings || []).length;
    const callCount = (activities.calls || []).length;
    const emailCount = (activities.emails || []).length;

    const engagementSummary = [
      meetingCount > 0 ? `${meetingCount} meeting${meetingCount > 1 ? 's' : ''}` : null,
      callCount > 0 ? `${callCount} call${callCount > 1 ? 's' : ''}` : null,
      emailCount > 0 ? `${emailCount} email${emailCount > 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(', ') || 'no engagements';

    return `${name} is a ${amount} opportunity currently in ${stage}, targeting ${closeDateStr}. ${activityStatus} with ${recentActivities} activities in the last 14 days (${engagementSummary} total). ${totalActivities === 0 ? 'This deal has no engagement history and needs immediate attention.' : ''}`.trim();
  }

  // ─── Internal: Blocker Detection ───────────────────────────

  _identifyBlockers(deal, sortedActivities, activities) {
    const blockers = [];
    const now = Date.now();

    // 1. No recent activity
    const lastActivity = this._mostRecentActivityDate(sortedActivities);
    if (lastActivity) {
      const daysSince = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
      if (daysSince > 14) {
        blockers.push({
          type: 'inactivity',
          severity: daysSince > 21 ? 'critical' : 'high',
          detail: `No activity for ${daysSince} days. Deal may have gone cold.`,
          daysSince,
        });
      }
    } else if (sortedActivities.length === 0) {
      blockers.push({
        type: 'no_engagement',
        severity: 'critical',
        detail: 'Zero engagement history. No emails, calls, or meetings recorded.',
      });
    }

    // 2. Overdue close date
    const closeDate = deal.closedate || deal.close_date;
    if (closeDate) {
      const cd = new Date(closeDate).getTime();
      if (cd < now) {
        const daysOverdue = Math.floor((now - cd) / (1000 * 60 * 60 * 24));
        blockers.push({
          type: 'overdue_close_date',
          severity: daysOverdue > 30 ? 'critical' : 'high',
          detail: `Close date is ${daysOverdue} days overdue. Deal needs a reset or removal.`,
          daysOverdue,
        });
      }
    }

    // 3. Stage stall
    const stageEnteredDate = deal.stage_entered_date || deal.hs_date_entered_current_stage || deal.stageEnteredDate;
    if (stageEnteredDate) {
      const daysInStage = Math.floor((now - new Date(stageEnteredDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysInStage > 21) {
        blockers.push({
          type: 'stage_stall',
          severity: daysInStage > 35 ? 'critical' : 'high',
          detail: `Deal has been in ${this._stageLabel(deal)} for ${daysInStage} days without progressing.`,
          daysInStage,
        });
      }
    }

    // 4. Incomplete tasks
    const overdueTasks = (activities.tasks || []).filter(t => {
      const props = t.properties || t;
      const status = (props.hs_task_status || props.status || '').toUpperCase();
      if (status === 'COMPLETED') return false;
      const due = props.hs_task_due_date || props.dueDate;
      if (!due) return false;
      return new Date(due).getTime() < now;
    });

    if (overdueTasks.length > 0) {
      blockers.push({
        type: 'overdue_tasks',
        severity: overdueTasks.length >= 3 ? 'high' : 'medium',
        detail: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} need attention.`,
        count: overdueTasks.length,
      });
    }

    // 5. No next step
    if (!deal.next_step && !deal.hs_next_step && !deal.next_activity_date) {
      blockers.push({
        type: 'no_next_step',
        severity: 'medium',
        detail: 'No next step defined. Deal lacks clear forward motion.',
      });
    }

    // 6. One-way communication (only outbound emails, no replies)
    const emails = activities.emails || [];
    if (emails.length >= 3) {
      const outbound = emails.filter(e => {
        const dir = (e.properties?.hs_email_direction || e.direction || '').toUpperCase();
        return dir === 'OUTBOUND' || dir === 'EMAIL';
      });
      const inbound = emails.filter(e => {
        const dir = (e.properties?.hs_email_direction || e.direction || '').toUpperCase();
        return dir === 'INBOUND' || dir === 'INCOMING_EMAIL';
      });

      if (outbound.length >= 3 && inbound.length === 0) {
        blockers.push({
          type: 'one_way_communication',
          severity: 'high',
          detail: `${outbound.length} outbound emails with zero replies. Prospect may be disengaged.`,
        });
      }
    }

    blockers.sort((a, b) => this._severityWeight(b.severity) - this._severityWeight(a.severity));
    return blockers;
  }

  // ─── Internal: Stakeholder Analysis ────────────────────────

  _analyzeStakeholders(deal, activities) {
    const contacts = deal.associations?.contacts || deal.contacts || [];
    const contactCount = Array.isArray(contacts) ? contacts.length : 0;

    // Assess stakeholder coverage
    const stage = this._dealStage(deal);
    const amount = this._dealAmount(deal);

    let expectedContacts = 1;
    if (amount > 100000) expectedContacts = 3;
    else if (amount > 50000) expectedContacts = 2;

    // In later stages, expect more stakeholders
    const stageWeight = this._getStageWeight(stage);
    if (stageWeight >= 0.4) expectedContacts = Math.max(expectedContacts, 2);
    if (stageWeight >= 0.6) expectedContacts = Math.max(expectedContacts, 3);

    const coverageGap = Math.max(0, expectedContacts - contactCount);

    // Analyze engagement distribution across contacts (if available)
    const engagementByContact = this._engagementByContact(activities);
    const singleThreaded = contactCount > 1
      ? this._isSingleThreaded(engagementByContact)
      : contactCount === 1;

    let riskLevel = 'low';
    if (contactCount === 0) riskLevel = 'critical';
    else if (singleThreaded && stageWeight >= 0.4) riskLevel = 'high';
    else if (coverageGap >= 2) riskLevel = 'high';
    else if (coverageGap >= 1 || singleThreaded) riskLevel = 'medium';

    return {
      contactCount,
      expectedContacts,
      coverageGap,
      singleThreaded,
      riskLevel,
      engagementByContact,
      recommendation: this._stakeholderRecommendation(riskLevel, coverageGap, singleThreaded, stage),
    };
  }

  _engagementByContact(activities) {
    const contactMap = {};
    const types = ['emails', 'calls', 'meetings'];

    for (const type of types) {
      for (const activity of (activities[type] || [])) {
        const ownerId = activity.properties?.hubspot_owner_id || activity.hubspot_owner_id || 'unknown';
        if (!contactMap[ownerId]) contactMap[ownerId] = { total: 0, types: {} };
        contactMap[ownerId].total += 1;
        contactMap[ownerId].types[type] = (contactMap[ownerId].types[type] || 0) + 1;
      }
    }

    return contactMap;
  }

  _isSingleThreaded(engagementByContact) {
    const entries = Object.values(engagementByContact);
    if (entries.length <= 1) return true;
    const totalEngagements = entries.reduce((sum, e) => sum + e.total, 0);
    if (totalEngagements === 0) return true;
    // If one contact has > 80% of all engagements, it's single-threaded
    return entries.some(e => e.total / totalEngagements > 0.8);
  }

  _stakeholderRecommendation(riskLevel, coverageGap, singleThreaded, stage) {
    if (riskLevel === 'critical') {
      return 'No contacts associated with this deal. Add the primary contact and any known stakeholders immediately.';
    }
    if (singleThreaded && coverageGap > 0) {
      return `Deal is single-threaded and missing ${coverageGap} expected stakeholder${coverageGap > 1 ? 's' : ''}. Multi-thread by identifying the economic buyer and a champion.`;
    }
    if (singleThreaded) {
      return 'Deal relies on a single contact. Identify and engage additional stakeholders to reduce risk.';
    }
    if (coverageGap > 0) {
      return `Consider adding ${coverageGap} more stakeholder${coverageGap > 1 ? 's' : ''} — at this deal size and stage, broader engagement improves win rates.`;
    }
    return 'Stakeholder coverage looks adequate. Continue engaging key contacts.';
  }

  // ─── Internal: Momentum Scoring ────────────────────────────

  _calculateMomentum(deal, sortedActivities) {
    const now = Date.now();
    const windowMs = this.momentumWindow * 24 * 60 * 60 * 1000;
    const halfWindow = windowMs / 2;

    // Recent period: last half of window
    const recentActivities = sortedActivities.filter(a =>
      a.timestamp && (now - a.timestamp) <= halfWindow
    );

    // Previous period: first half of window
    const previousActivities = sortedActivities.filter(a =>
      a.timestamp && (now - a.timestamp) > halfWindow && (now - a.timestamp) <= windowMs
    );

    let score = 50; // Neutral baseline

    // Activity volume in recent period (up to +20)
    const weeksInWindow = this.momentumWindow / 7 / 2;
    const recentPerWeek = weeksInWindow > 0 ? recentActivities.length / weeksInWindow : 0;
    const volumeRatio = recentPerWeek / this.idealActivityPerWeek;
    score += Math.min(20, Math.round(volumeRatio * 20));

    // Acceleration: compare recent vs previous (up to +/- 15)
    if (previousActivities.length > 0) {
      const acceleration = (recentActivities.length - previousActivities.length) / previousActivities.length;
      if (acceleration > 0) score += Math.min(15, Math.round(acceleration * 15));
      else score += Math.max(-15, Math.round(acceleration * 15));
    } else if (recentActivities.length > 0) {
      score += 10; // Activity starting from zero is positive
    } else {
      score -= 20; // No activity in entire window
    }

    // Activity diversity bonus (up to +10)
    const recentTypes = new Set(recentActivities.map(a => a.type));
    if (recentTypes.size >= 3) score += 10;
    else if (recentTypes.size === 2) score += 5;

    // Meeting recency bonus (+5)
    const recentMeeting = recentActivities.find(a => a.type === 'meetings');
    if (recentMeeting) score += 5;

    // Stage progression (if data available)
    const stageEnteredDate = deal.stage_entered_date || deal.hs_date_entered_current_stage;
    if (stageEnteredDate) {
      const daysInStage = Math.floor((now - new Date(stageEnteredDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysInStage <= 7) score += 5; // Recently progressed
      else if (daysInStage > 28) score -= 10; // Long stall
    }

    return Math.max(0, Math.min(100, score));
  }

  // ─── Internal: Intervention Recommendations ────────────────

  _recommendIntervention(deal, blockers, stakeholderAnalysis, momentumScore) {
    if (blockers.length === 0 && momentumScore >= 70 && stakeholderAnalysis.riskLevel === 'low') {
      return {
        urgency: 'none',
        action: 'Deal is progressing well. No intervention needed — continue supporting the rep.',
        type: 'monitor',
      };
    }

    const hasCritical = blockers.some(b => b.severity === 'critical');
    const hasInactivity = blockers.some(b => b.type === 'inactivity' || b.type === 'no_engagement');
    const hasStakeholderRisk = stakeholderAnalysis.riskLevel === 'high' || stakeholderAnalysis.riskLevel === 'critical';

    if (hasCritical) {
      if (hasInactivity) {
        return {
          urgency: 'immediate',
          action: 'Schedule a deal review with the rep today. The deal has gone silent — determine if it should be reactivated or removed from forecast.',
          type: 'leadership_review',
        };
      }
      return {
        urgency: 'immediate',
        action: 'Critical blockers detected. Pull this deal into the next pipeline review and develop a recovery plan with the rep.',
        type: 'leadership_review',
      };
    }

    if (momentumScore < 30) {
      return {
        urgency: 'high',
        action: 'Momentum is stalling. Coach the rep on re-engaging the prospect — consider an executive sponsor introduction or a value reframe.',
        type: 'coaching',
      };
    }

    if (hasStakeholderRisk) {
      return {
        urgency: 'high',
        action: `Stakeholder coverage is weak (${stakeholderAnalysis.contactCount} contacts, need ${stakeholderAnalysis.expectedContacts}). Help the rep map the buying committee and multi-thread.`,
        type: 'coaching',
      };
    }

    return {
      urgency: 'medium',
      action: 'Minor risk signals present. Discuss this deal in the next 1:1 and ensure next steps are clear.',
      type: 'monitor',
    };
  }

  // ─── Internal: Leadership Brief ────────────────────────────

  _buildLeadershipBrief(deal, blockers, stakeholderAnalysis, momentumScore, summary) {
    const amount = this._formatCurrency(this._dealAmount(deal));
    const stage = this._stageLabel(deal);
    const criticalBlockers = blockers.filter(b => b.severity === 'critical');
    const highBlockers = blockers.filter(b => b.severity === 'high');

    let attentionLevel = 'low';
    if (criticalBlockers.length > 0 || momentumScore < 25) attentionLevel = 'immediate';
    else if (highBlockers.length > 0 || momentumScore < 50) attentionLevel = 'this_week';
    else if (blockers.length > 0 || stakeholderAnalysis.riskLevel !== 'low') attentionLevel = 'monitor';

    const keyIssues = [
      ...criticalBlockers.map(b => b.detail),
      ...highBlockers.map(b => b.detail),
    ].slice(0, 3);

    return {
      attentionLevel,
      headline: `${deal.dealname || deal.name || 'Deal'} (${amount}, ${stage}) — momentum: ${momentumScore}/100`,
      keyIssues: keyIssues.length > 0 ? keyIssues : ['No critical issues detected.'],
      stakeholderRisk: stakeholderAnalysis.riskLevel,
      blockerCount: blockers.length,
      summary,
    };
  }

  // ─── Internal: Utilities ───────────────────────────────────

  _flattenActivities(activities) {
    const flat = [];
    for (const [type, items] of Object.entries(activities)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const props = item.properties || item;
        const ts = props.hs_timestamp || props.timestamp || props.hs_meeting_start_time;
        flat.push({
          type,
          id: item.id,
          timestamp: ts ? new Date(ts).getTime() : null,
          properties: props,
        });
      }
    }
    return flat.filter(a => a.timestamp && !isNaN(a.timestamp));
  }

  _sortByDate(activities) {
    return [...activities].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  _mostRecentActivityDate(activities) {
    if (activities.length === 0) return null;
    const timestamps = activities.map(a => a.timestamp).filter(Boolean);
    return timestamps.length > 0 ? Math.max(...timestamps) : null;
  }

  _isWithinDays(timestampMs, days) {
    if (!timestampMs) return false;
    return (Date.now() - timestampMs) <= days * 24 * 60 * 60 * 1000;
  }

  _dealAmount(deal) {
    return parseFloat(deal.amount || deal.properties?.amount || 0) || 0;
  }

  _dealStage(deal) {
    return (deal.dealstage || deal.stage || deal.properties?.dealstage || '').toLowerCase();
  }

  _stageLabel(deal) {
    const stage = this._dealStage(deal);
    const stages = config.dealStages || {};
    return stages[stage]?.label || stage || 'unknown stage';
  }

  _getStageWeight(stage) {
    const stages = config.dealStages || {};
    return stages[stage]?.probability ?? 0;
  }

  _formatCurrency(amount) {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  }

  _severityWeight(severity) {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[severity] || 0;
  }
}

export default DealIntelligenceAgent;
