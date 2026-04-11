import config from '../config.js';

const DEFAULTS = {
  staleDealDays: 7,
  maxCloseDatePushes: 1,
  stageStallDays: 14,
  engagementGapDays: 10,
};

class PipelineRiskAgent {
  constructor(options = {}) {
    this.thresholds = { ...DEFAULTS, ...options };
  }

  /**
   * Evaluate every deal in the pipeline for risk signals.
   * @param {Array} deals        — array of deal objects from HubSpot
   * @param {Object} thresholds  — optional override thresholds
   * @returns {{ riskFlags: Array, summary: Object }}
   */
  analyze(deals, thresholds = {}) {
    const t = { ...this.thresholds, ...thresholds };
    const now = Date.now();
    const riskFlags = [];

    for (const deal of deals) {
      if (this._isClosed(deal)) continue;

      const signals = this._detectSignals(deal, t, now);
      if (signals.length === 0) continue;

      const riskLevel = this._deriveRiskLevel(signals);

      riskFlags.push({
        dealId: deal.id || deal.dealId,
        dealName: deal.dealname || deal.name || 'Unnamed Deal',
        riskLevel,
        signals,
        recommendedAction: this._recommendAction(signals, riskLevel),
      });
    }

    riskFlags.sort((a, b) => this._riskWeight(b.riskLevel) - this._riskWeight(a.riskLevel));

    const criticalCount = riskFlags.filter(f => f.riskLevel === 'critical').length;
    const highCount = riskFlags.filter(f => f.riskLevel === 'high').length;

    return {
      riskFlags,
      summary: {
        totalAtRisk: riskFlags.length,
        criticalCount,
        highCount,
      },
    };
  }

  /**
   * Score an individual deal's health from 0 (worst) to 100 (best).
   * @param {Object} deal
   * @returns {number}
   */
  scoreDealHealth(deal) {
    const now = Date.now();
    let score = 100;

    // --- Inactivity penalty (up to -30) ---
    const daysSinceActivity = this._daysSince(deal.last_activity_date || deal.lastActivityDate, now);
    if (daysSinceActivity !== null) {
      if (daysSinceActivity > 21) score -= 30;
      else if (daysSinceActivity > 14) score -= 20;
      else if (daysSinceActivity > 7) score -= 10;
      else if (daysSinceActivity > 3) score -= 5;
    } else {
      // No activity date at all — bad sign
      score -= 25;
    }

    // --- Close date slippage penalty (up to -20) ---
    const pushCount = this._closeDatePushCount(deal);
    if (pushCount >= 3) score -= 20;
    else if (pushCount === 2) score -= 12;
    else if (pushCount === 1) score -= 5;

    // --- Stage stall penalty (up to -20) ---
    const daysInStage = this._daysInCurrentStage(deal, now);
    if (daysInStage !== null) {
      if (daysInStage > 28) score -= 20;
      else if (daysInStage > 14) score -= 12;
      else if (daysInStage > 7) score -= 5;
    }

    // --- No next step / next task penalty (-15) ---
    if (!this._hasNextStep(deal)) {
      score -= 15;
    }

    // --- Engagement gap penalty (up to -15) ---
    const engagementGap = this._engagementGapDays(deal, now);
    if (engagementGap !== null) {
      if (engagementGap > 14) score -= 15;
      else if (engagementGap > 10) score -= 10;
      else if (engagementGap > 7) score -= 5;
    }

    // --- Close date in the past penalty ---
    const closeDate = deal.closedate || deal.close_date;
    if (closeDate) {
      const cd = new Date(closeDate).getTime();
      if (cd < now) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  // ─── Internal helpers ──────────────────────────────────────

  _isClosed(deal) {
    const stage = (deal.dealstage || deal.stage || '').toLowerCase();
    return stage === 'closed_won' || stage === 'closed_lost' ||
           stage === 'closedwon' || stage === 'closedlost';
  }

  _detectSignals(deal, t, now) {
    const signals = [];

    // 1. Days without activity
    const daysSinceActivity = this._daysSince(deal.last_activity_date || deal.lastActivityDate, now);
    if (daysSinceActivity !== null && daysSinceActivity > t.staleDealDays) {
      signals.push({
        type: 'stale_deal',
        severity: daysSinceActivity > t.staleDealDays * 2 ? 'critical' : 'high',
        detail: `No activity for ${daysSinceActivity} days (threshold: ${t.staleDealDays})`,
        value: daysSinceActivity,
      });
    }

    // 2. Close date pushed more than once
    const pushCount = this._closeDatePushCount(deal);
    if (pushCount > t.maxCloseDatePushes) {
      signals.push({
        type: 'close_date_pushed',
        severity: pushCount >= 3 ? 'critical' : 'high',
        detail: `Close date pushed ${pushCount} time(s)`,
        value: pushCount,
      });
    }

    // 3. Stage stalled
    const daysInStage = this._daysInCurrentStage(deal, now);
    if (daysInStage !== null && daysInStage > t.stageStallDays) {
      signals.push({
        type: 'stage_stalled',
        severity: daysInStage > t.stageStallDays * 2 ? 'critical' : 'high',
        detail: `In "${deal.dealstage || deal.stage}" for ${daysInStage} days`,
        value: daysInStage,
      });
    }

    // 4. No next step / task
    if (!this._hasNextStep(deal)) {
      signals.push({
        type: 'no_next_step',
        severity: 'medium',
        detail: 'No next step or upcoming task defined',
        value: null,
      });
    }

    // 5. Engagement gap — no emails or calls in threshold days
    const engagementGap = this._engagementGapDays(deal, now);
    if (engagementGap !== null && engagementGap > t.engagementGapDays) {
      signals.push({
        type: 'engagement_gap',
        severity: engagementGap > t.engagementGapDays * 2 ? 'critical' : 'high',
        detail: `No emails or calls in ${engagementGap} days`,
        value: engagementGap,
      });
    }

    return signals;
  }

  _deriveRiskLevel(signals) {
    const hasCritical = signals.some(s => s.severity === 'critical');
    const highCount = signals.filter(s => s.severity === 'high').length;
    const totalSignals = signals.length;

    if (hasCritical || highCount >= 3) return 'critical';
    if (highCount >= 2 || totalSignals >= 3) return 'high';
    if (highCount >= 1 || totalSignals >= 2) return 'medium';
    return 'low';
  }

  _recommendAction(signals, riskLevel) {
    const types = new Set(signals.map(s => s.type));

    if (riskLevel === 'critical') {
      if (types.has('stale_deal') && types.has('engagement_gap')) {
        return 'Immediate outreach required — deal has gone silent. Escalate to leadership for intervention call.';
      }
      if (types.has('close_date_pushed')) {
        return 'Close date has slipped multiple times. Require a validated mutual close plan before next forecast.';
      }
      return 'Critical deal risk — schedule a deal review with the rep and leadership this week.';
    }

    if (riskLevel === 'high') {
      if (types.has('stage_stalled')) {
        return 'Deal is stuck — coach the rep on stage-specific exit criteria and identify the blocker.';
      }
      if (types.has('no_next_step')) {
        return 'Ensure a clear next step with a confirmed date is set in the CRM before EOD.';
      }
      return 'Review this deal in 1:1 — multiple risk signals detected.';
    }

    if (types.has('no_next_step')) {
      return 'Set a next step with a specific date and owner.';
    }
    return 'Monitor — minor risk signals detected.';
  }

  _daysSince(dateValue, now) {
    if (!dateValue) return null;
    const ts = new Date(dateValue).getTime();
    if (isNaN(ts)) return null;
    return Math.floor((now - ts) / (1000 * 60 * 60 * 24));
  }

  _closeDatePushCount(deal) {
    // HubSpot tracks this in properties or via a custom field
    if (deal.close_date_push_count != null) return Number(deal.close_date_push_count);
    if (deal.num_close_date_changes != null) return Number(deal.num_close_date_changes);
    if (deal.hs_date_entered_closedwon != null && deal.closedate) {
      // Heuristic: compare original vs current close date
      return 0;
    }
    return 0;
  }

  _daysInCurrentStage(deal, now) {
    const entered = deal.stage_entered_date ||
                    deal.hs_date_entered_current_stage ||
                    deal.stageEnteredDate;
    return this._daysSince(entered, now);
  }

  _hasNextStep(deal) {
    if (deal.next_step || deal.hs_next_step) return true;
    if (deal.next_activity_date || deal.nextActivityDate) return true;
    if (deal.upcoming_tasks && deal.upcoming_tasks.length > 0) return true;
    return false;
  }

  _engagementGapDays(deal, now) {
    const lastEmail = deal.last_email_date || deal.lastEmailDate;
    const lastCall = deal.last_call_date || deal.lastCallDate;
    const lastEngagement = deal.last_engagement_date || deal.lastEngagementDate;

    const candidates = [lastEmail, lastCall, lastEngagement]
      .filter(Boolean)
      .map(d => new Date(d).getTime())
      .filter(t => !isNaN(t));

    if (candidates.length === 0) return null;
    const mostRecent = Math.max(...candidates);
    return Math.floor((now - mostRecent) / (1000 * 60 * 60 * 24));
  }

  _riskWeight(level) {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[level] || 0;
  }
}

export default PipelineRiskAgent;
