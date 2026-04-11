import config from '../config.js';

const SCORING_WEIGHTS = {
  activityScore: 0.20,
  pipelineQuality: 0.25,
  forecastReliability: 0.20,
  followUpConsistency: 0.20,
  winRate: 0.15,
};

class RepPerformanceAgent {
  constructor(options = {}) {
    this.weights = { ...SCORING_WEIGHTS, ...options.weights };
    this.activityThreshold = options.activityThreshold ?? config.thresholds?.repActivityThreshold ?? 50;
  }

  /**
   * Full performance analysis for a sales rep.
   *
   * @param {Object} owner      - HubSpot owner object { id, firstName, lastName, email }
   * @param {Array}  deals      - All deals assigned to this owner.
   * @param {Object} activities - { emails: [], calls: [], meetings: [], tasks: [], notes: [] }
   * @returns {Object}
   */
  analyze(owner, deals, activities = {}) {
    const scorecard = this.generateScorecard(owner, deals, activities);
    const coachingFlags = this._identifyCoachingFlags(scorecard, deals, activities);
    const talkingPoints = this._generateTalkingPoints(scorecard, coachingFlags, deals);
    const actionItems = this._generateActionItems(coachingFlags, owner);

    return {
      scorecard,
      coachingFlags,
      talkingPoints,
      actionItems,
    };
  }

  /**
   * Build a comprehensive scorecard for a rep.
   *
   * @param {Object} owner
   * @param {Array}  deals
   * @param {Object} activities
   * @returns {Object}
   */
  generateScorecard(owner, deals, activities = {}) {
    const activeDeals = deals.filter(d => !this._isClosed(d));
    const wonDeals = deals.filter(d => this._isWon(d));
    const lostDeals = deals.filter(d => this._isLost(d));
    const closedDeals = [...wonDeals, ...lostDeals];

    const activityScore = this._scoreActivity(activities);
    const pipelineQuality = this._scorePipelineQuality(activeDeals);
    const forecastReliability = this._scoreForecastReliability(deals);
    const followUpConsistency = this._scoreFollowUpConsistency(activeDeals, activities);
    const winRate = this._scoreWinRate(wonDeals, closedDeals);

    const overallScore = Math.round(
      activityScore * this.weights.activityScore +
      pipelineQuality * this.weights.pipelineQuality +
      forecastReliability * this.weights.forecastReliability +
      followUpConsistency * this.weights.followUpConsistency +
      winRate * this.weights.winRate
    );

    return {
      repId: owner.id || owner.ownerId,
      repName: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'Unknown',
      overallScore,
      activityScore,
      pipelineQuality,
      forecastReliability,
      followUpConsistency,
      winRate,
      metrics: {
        activeDealCount: activeDeals.length,
        totalPipelineValue: activeDeals.reduce((sum, d) => sum + this._dealAmount(d), 0),
        wonDealCount: wonDeals.length,
        lostDealCount: lostDeals.length,
        wonRevenue: wonDeals.reduce((sum, d) => sum + this._dealAmount(d), 0),
        avgDealSize: activeDeals.length > 0
          ? Math.round(activeDeals.reduce((sum, d) => sum + this._dealAmount(d), 0) / activeDeals.length)
          : 0,
        winRatePct: closedDeals.length > 0
          ? Math.round((wonDeals.length / closedDeals.length) * 100)
          : null,
      },
      rating: this._overallRating(overallScore),
    };
  }

  // ─── Internal: Scoring Methods ─────────────────────────────

  /**
   * Score activity levels based on volume and recency of engagements.
   * Returns 0-100.
   */
  _scoreActivity(activities) {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    let score = 0;
    let totalLast30 = 0;
    let totalLast7 = 0;

    for (const type of ['emails', 'calls', 'meetings']) {
      const items = activities[type] || [];
      for (const item of items) {
        const ts = this._activityTimestamp(item);
        if (!ts) continue;
        const age = now - ts;
        if (age <= thirtyDaysMs) totalLast30++;
        if (age <= sevenDaysMs) totalLast7++;
      }
    }

    // Monthly volume scoring (up to 60 points)
    // Threshold is configurable, default 50 activities/month
    const monthlyRatio = totalLast30 / this.activityThreshold;
    score += Math.min(60, Math.round(monthlyRatio * 60));

    // Weekly recency scoring (up to 25 points)
    // Expect at least 12 activities per week
    const weeklyTarget = this.activityThreshold / 4;
    const weeklyRatio = totalLast7 / weeklyTarget;
    score += Math.min(25, Math.round(weeklyRatio * 25));

    // Diversity bonus: using multiple channels (up to 15 points)
    const channelsUsed = ['emails', 'calls', 'meetings'].filter(
      type => (activities[type] || []).some(item => {
        const ts = this._activityTimestamp(item);
        return ts && (now - ts) <= thirtyDaysMs;
      })
    ).length;

    if (channelsUsed >= 3) score += 15;
    else if (channelsUsed === 2) score += 10;
    else if (channelsUsed === 1) score += 5;

    return Math.min(100, score);
  }

  /**
   * Score pipeline quality: stage distribution, deal health, next steps coverage.
   * Returns 0-100.
   */
  _scorePipelineQuality(activeDeals) {
    if (activeDeals.length === 0) return 0;

    let score = 50; // Baseline

    // Stage distribution: penalize if all deals are in early stages
    const stageWeights = activeDeals.map(d => this._stageWeight(d));
    const avgStageWeight = stageWeights.reduce((s, w) => s + w, 0) / stageWeights.length;

    if (avgStageWeight >= 0.4) score += 15;
    else if (avgStageWeight >= 0.25) score += 8;
    else score -= 10;

    // Next step coverage: percentage of deals with next steps
    const withNextStep = activeDeals.filter(d =>
      d.next_step || d.hs_next_step || d.next_activity_date || d.nextActivityDate
    ).length;
    const nextStepPct = withNextStep / activeDeals.length;

    if (nextStepPct >= 0.9) score += 15;
    else if (nextStepPct >= 0.7) score += 8;
    else if (nextStepPct < 0.5) score -= 10;

    // Stale deal penalty: percentage of deals stalled > 14 days
    const now = Date.now();
    const stalledDeals = activeDeals.filter(d => {
      const entered = d.stage_entered_date || d.hs_date_entered_current_stage;
      if (!entered) return false;
      const days = (now - new Date(entered).getTime()) / (1000 * 60 * 60 * 24);
      return days > 14;
    }).length;
    const stalledPct = stalledDeals / activeDeals.length;

    if (stalledPct > 0.5) score -= 15;
    else if (stalledPct > 0.3) score -= 8;
    else if (stalledPct < 0.1) score += 10;

    // Deal count: having a reasonable number of active deals
    if (activeDeals.length >= 5 && activeDeals.length <= 25) score += 5;
    else if (activeDeals.length > 40) score -= 5; // Too many deals can mean poor qualification

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score forecast reliability: how accurate have past close date predictions been?
   * Returns 0-100.
   */
  _scoreForecastReliability(deals) {
    const closedDeals = deals.filter(d => this._isClosed(d));
    if (closedDeals.length === 0) return 50; // Neutral if no history

    let score = 70; // Start with benefit of the doubt

    // Close date accuracy: count deals where close date was pushed
    let totalPushes = 0;
    let dealsWithPushes = 0;

    for (const deal of closedDeals) {
      const pushCount = this._closeDatePushCount(deal);
      if (pushCount > 0) {
        dealsWithPushes++;
        totalPushes += pushCount;
      }
    }

    const pushRate = dealsWithPushes / closedDeals.length;

    // Penalize for high push rates
    if (pushRate > 0.6) score -= 30;
    else if (pushRate > 0.4) score -= 20;
    else if (pushRate > 0.2) score -= 10;
    else score += 10;

    // Average pushes per deal
    const avgPushes = closedDeals.length > 0 ? totalPushes / closedDeals.length : 0;
    if (avgPushes > 2) score -= 15;
    else if (avgPushes > 1) score -= 8;

    // Check active deals for already-overdue close dates (forward-looking reliability)
    const activeDeals = deals.filter(d => !this._isClosed(d));
    const now = Date.now();
    const overdueActive = activeDeals.filter(d => {
      const cd = d.closedate || d.close_date;
      return cd && new Date(cd).getTime() < now;
    }).length;

    if (activeDeals.length > 0) {
      const overduePct = overdueActive / activeDeals.length;
      if (overduePct > 0.3) score -= 15;
      else if (overduePct > 0.15) score -= 8;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score follow-up consistency: are deals getting regular attention?
   * Returns 0-100.
   */
  _scoreFollowUpConsistency(activeDeals, activities) {
    if (activeDeals.length === 0) return 50;

    const now = Date.now();
    let score = 60; // Baseline

    // Task completion rate
    const tasks = activities.tasks || [];
    const completedTasks = tasks.filter(t => {
      const status = (t.properties?.hs_task_status || t.status || '').toUpperCase();
      return status === 'COMPLETED';
    }).length;
    const taskCompletionRate = tasks.length > 0 ? completedTasks / tasks.length : 1;

    if (taskCompletionRate >= 0.9) score += 15;
    else if (taskCompletionRate >= 0.7) score += 8;
    else if (taskCompletionRate < 0.5) score -= 15;

    // Engagement recency across deals: what % of active deals had activity in the last 7 days?
    const allActivities = this._flattenActivities(activities);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const recentActivities = allActivities.filter(a => a.timestamp && (now - a.timestamp) <= sevenDaysMs);

    // Simple proxy: recent activity count vs deal count
    const activityPerDeal = activeDeals.length > 0 ? recentActivities.length / activeDeals.length : 0;
    if (activityPerDeal >= 2) score += 15;
    else if (activityPerDeal >= 1) score += 8;
    else if (activityPerDeal < 0.5) score -= 10;

    // Follow-up speed: check for quick responses to inbound (if data available)
    const inboundEmails = (activities.emails || []).filter(e => {
      const dir = (e.properties?.hs_email_direction || '').toUpperCase();
      return dir === 'INBOUND' || dir === 'INCOMING_EMAIL';
    });
    // If there are inbound emails, that means the rep is getting engagement (good sign)
    if (inboundEmails.length > 0) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score win rate performance.
   * Returns 0-100.
   */
  _scoreWinRate(wonDeals, closedDeals) {
    if (closedDeals.length === 0) return 50; // No data, neutral

    const rate = wonDeals.length / closedDeals.length;

    // Map win rate to a score:
    // 50%+ win rate = excellent (85-100)
    // 30-50% = good (60-84)
    // 20-30% = average (40-59)
    // <20% = needs improvement (0-39)
    if (rate >= 0.5) return Math.min(100, 85 + Math.round((rate - 0.5) * 30));
    if (rate >= 0.3) return 60 + Math.round((rate - 0.3) / 0.2 * 24);
    if (rate >= 0.2) return 40 + Math.round((rate - 0.2) / 0.1 * 19);
    return Math.round(rate / 0.2 * 39);
  }

  // ─── Internal: Coaching Flags ──────────────────────────────

  _identifyCoachingFlags(scorecard, deals, activities) {
    const flags = [];

    if (scorecard.activityScore < 40) {
      flags.push({
        area: 'activity_volume',
        severity: scorecard.activityScore < 20 ? 'critical' : 'high',
        message: 'Activity levels are well below expectations. Rep may need help with time management or prospecting discipline.',
        score: scorecard.activityScore,
      });
    }

    if (scorecard.pipelineQuality < 40) {
      flags.push({
        area: 'pipeline_quality',
        severity: scorecard.pipelineQuality < 20 ? 'critical' : 'high',
        message: 'Pipeline health is poor — too many stalled deals or missing next steps. Review qualification criteria.',
        score: scorecard.pipelineQuality,
      });
    }

    if (scorecard.forecastReliability < 40) {
      flags.push({
        area: 'forecast_accuracy',
        severity: scorecard.forecastReliability < 20 ? 'critical' : 'high',
        message: 'Close dates are frequently pushed. Coach on setting realistic timelines and validating buyer commitment.',
        score: scorecard.forecastReliability,
      });
    }

    if (scorecard.followUpConsistency < 40) {
      flags.push({
        area: 'follow_up',
        severity: scorecard.followUpConsistency < 20 ? 'critical' : 'high',
        message: 'Follow-up is inconsistent — deals are not receiving regular attention. Risk of deals going cold.',
        score: scorecard.followUpConsistency,
      });
    }

    if (scorecard.winRate < 40) {
      flags.push({
        area: 'win_rate',
        severity: scorecard.winRate < 20 ? 'critical' : 'high',
        message: 'Win rate is below benchmark. Review loss reasons and assess if qualification or competitive positioning needs work.',
        score: scorecard.winRate,
      });
    }

    // Check for specific deal-level patterns
    const activeDeals = deals.filter(d => !this._isClosed(d));
    const now = Date.now();

    // Deals with overdue close dates
    const overdueDeals = activeDeals.filter(d => {
      const cd = d.closedate || d.close_date;
      return cd && new Date(cd).getTime() < now;
    });
    if (overdueDeals.length >= 3) {
      flags.push({
        area: 'deal_hygiene',
        severity: 'medium',
        message: `${overdueDeals.length} deals have overdue close dates. CRM hygiene needs attention — update or remove stale deals.`,
        score: null,
      });
    }

    // All deals in early stages
    const earlyStageDeals = activeDeals.filter(d => this._stageWeight(d) <= 0.2);
    if (activeDeals.length > 0 && earlyStageDeals.length / activeDeals.length > 0.7) {
      flags.push({
        area: 'pipeline_maturity',
        severity: 'medium',
        message: 'Most deals are in early stages. Focus on advancing existing opportunities, not just filling the top of the funnel.',
        score: null,
      });
    }

    flags.sort((a, b) => this._severityWeight(b.severity) - this._severityWeight(a.severity));
    return flags;
  }

  // ─── Internal: Talking Points ──────────────────────────────

  _generateTalkingPoints(scorecard, coachingFlags, deals) {
    const points = [];

    // Lead with strengths
    const strengths = [];
    if (scorecard.activityScore >= 70) strengths.push('strong activity levels');
    if (scorecard.pipelineQuality >= 70) strengths.push('healthy pipeline quality');
    if (scorecard.forecastReliability >= 70) strengths.push('reliable forecasting');
    if (scorecard.followUpConsistency >= 70) strengths.push('consistent follow-up');
    if (scorecard.winRate >= 70) strengths.push('solid win rate');

    if (strengths.length > 0) {
      points.push({
        type: 'positive',
        text: `Recognize strengths: ${strengths.join(', ')}.`,
      });
    }

    // Address coaching areas
    for (const flag of coachingFlags.slice(0, 3)) {
      points.push({
        type: 'coaching',
        text: flag.message,
        area: flag.area,
      });
    }

    // Deal-specific talking points
    const activeDeals = deals.filter(d => !this._isClosed(d));
    const bigDeals = activeDeals
      .sort((a, b) => this._dealAmount(b) - this._dealAmount(a))
      .slice(0, 3);

    if (bigDeals.length > 0) {
      points.push({
        type: 'deal_review',
        text: `Review top deals: ${bigDeals.map(d => d.dealname || d.name || 'Unnamed').join(', ')}. Ask about next steps and buyer engagement.`,
      });
    }

    // Pipeline coverage
    const totalPipeline = activeDeals.reduce((sum, d) => sum + this._dealAmount(d), 0);
    points.push({
      type: 'pipeline',
      text: `Current pipeline: $${totalPipeline.toLocaleString()} across ${activeDeals.length} deals. ${activeDeals.length < 5 ? 'Pipeline count is low — discuss prospecting plan.' : ''}`.trim(),
    });

    return points;
  }

  // ─── Internal: Action Items ────────────────────────────────

  _generateActionItems(coachingFlags, owner) {
    const items = [];
    const repName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'Rep';

    for (const flag of coachingFlags) {
      switch (flag.area) {
        case 'activity_volume':
          items.push({
            owner: repName,
            action: 'Set daily activity targets (e.g., 15 calls, 10 emails) and track against them for the next 2 weeks.',
            priority: flag.severity,
            category: 'activity',
          });
          break;

        case 'pipeline_quality':
          items.push({
            owner: repName,
            action: 'Audit all active deals: remove stale ones, set next steps on every deal, and ensure qualification criteria are met.',
            priority: flag.severity,
            category: 'pipeline',
          });
          break;

        case 'forecast_accuracy':
          items.push({
            owner: repName,
            action: 'For each commit deal, document the validated close plan with specific buyer-confirmed milestones.',
            priority: flag.severity,
            category: 'forecast',
          });
          break;

        case 'follow_up':
          items.push({
            owner: repName,
            action: 'Complete all overdue tasks this week. Set up recurring follow-up reminders for every active deal.',
            priority: flag.severity,
            category: 'follow_up',
          });
          break;

        case 'win_rate':
          items.push({
            owner: repName,
            action: 'Schedule deal post-mortems on recent losses. Identify patterns and bring findings to next 1:1.',
            priority: flag.severity,
            category: 'skill_development',
          });
          break;

        case 'deal_hygiene':
          items.push({
            owner: repName,
            action: 'Update all overdue close dates in the CRM. Remove or archive deals that are no longer viable.',
            priority: flag.severity,
            category: 'hygiene',
          });
          break;

        case 'pipeline_maturity':
          items.push({
            owner: repName,
            action: 'Identify 3 early-stage deals that can be advanced this week. Focus on scheduling discovery calls or sending proposals.',
            priority: flag.severity,
            category: 'advancement',
          });
          break;

        default:
          items.push({
            owner: repName,
            action: flag.message,
            priority: flag.severity,
            category: flag.area,
          });
      }
    }

    return items;
  }

  // ─── Internal: Utilities ───────────────────────────────────

  _isClosed(deal) {
    const stage = (deal.dealstage || deal.stage || '').toLowerCase();
    return stage === 'closed_won' || stage === 'closed_lost' ||
           stage === 'closedwon' || stage === 'closedlost';
  }

  _isWon(deal) {
    const stage = (deal.dealstage || deal.stage || '').toLowerCase();
    return stage === 'closed_won' || stage === 'closedwon';
  }

  _isLost(deal) {
    const stage = (deal.dealstage || deal.stage || '').toLowerCase();
    return stage === 'closed_lost' || stage === 'closedlost';
  }

  _dealAmount(deal) {
    return parseFloat(deal.amount || deal.properties?.amount || 0) || 0;
  }

  _stageWeight(deal) {
    const stage = (deal.dealstage || deal.stage || '').toLowerCase();
    const stages = config.dealStages || {};
    return stages[stage]?.probability ?? 0;
  }

  _closeDatePushCount(deal) {
    if (deal.close_date_push_count != null) return Number(deal.close_date_push_count);
    if (deal.num_close_date_changes != null) return Number(deal.num_close_date_changes);
    return 0;
  }

  _activityTimestamp(item) {
    const props = item.properties || item;
    const ts = props.hs_timestamp || props.timestamp || props.hs_meeting_start_time;
    if (!ts) return null;
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? null : parsed;
  }

  _flattenActivities(activities) {
    const flat = [];
    for (const [type, items] of Object.entries(activities)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const ts = this._activityTimestamp(item);
        flat.push({ type, id: item.id, timestamp: ts });
      }
    }
    return flat.filter(a => a.timestamp);
  }

  _overallRating(score) {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Needs Improvement';
    return 'Poor';
  }

  _severityWeight(severity) {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[severity] || 0;
  }
}

export default RepPerformanceAgent;
