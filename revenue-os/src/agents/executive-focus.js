import config from '../config.js';

class ExecutiveFocusAgent {
  constructor(options = {}) {
    this.maxPriorities = options.maxPriorities ?? 3;
    this.maxRisks = options.maxRisks ?? 3;
    this.maxLeverageMoves = options.maxLeverageMoves ?? 3;
  }

  /**
   * Synthesize all agent outputs into a focused executive briefing.
   *
   * @param {Object} pipelineRisk       - Output from PipelineRiskAgent.analyze()
   * @param {Object} forecastConfidence - Output from ForecastConfidenceAgent.analyze()
   * @param {Object} dealIntelligence   - Array of outputs from DealIntelligenceAgent.analyze() (one per deal), or null
   * @param {Object} repPerformance     - Array of outputs from RepPerformanceAgent.analyze() (one per rep), or null
   * @returns {Object}
   */
  analyze(pipelineRisk = {}, forecastConfidence = {}, dealIntelligence = [], repPerformance = []) {
    const topPriorities = this._deriveTopPriorities(pipelineRisk, forecastConfidence, dealIntelligence, repPerformance);
    const topRisks = this._deriveTopRisks(pipelineRisk, forecastConfidence, dealIntelligence, repPerformance);
    const topLeverageMoves = this._deriveLeverageMoves(pipelineRisk, forecastConfidence, dealIntelligence, repPerformance);
    const executiveSummary = this._buildExecutiveSummary(pipelineRisk, forecastConfidence, topPriorities, topRisks);
    const attentionRequired = this._determineAttentionRequired(pipelineRisk, forecastConfidence, topRisks);

    return {
      topPriorities,
      topRisks,
      topLeverageMoves,
      executiveSummary,
      attentionRequired,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Top Priorities ────────────────────────────────────────

  _deriveTopPriorities(pipelineRisk, forecastConfidence, dealIntelligence, repPerformance) {
    const candidates = [];

    // Priority from forecast confidence
    if (forecastConfidence.confidenceScore != null) {
      if (forecastConfidence.confidenceScore < 40) {
        candidates.push({
          priority: 'critical',
          source: 'forecast',
          title: 'Forecast at risk',
          detail: `Forecast confidence is ${forecastConfidence.confidenceScore}/100. Coverage ratio: ${forecastConfidence.coverageRatio}x. Commit total: $${(forecastConfidence.commitTotal || 0).toLocaleString()}.`,
          action: 'Convene an emergency pipeline generation sprint and validate every commit deal.',
          weight: 100 - forecastConfidence.confidenceScore,
        });
      } else if (forecastConfidence.confidenceScore < 60) {
        candidates.push({
          priority: 'high',
          source: 'forecast',
          title: 'Forecast needs attention',
          detail: `Forecast confidence is ${forecastConfidence.confidenceScore}/100. Gap may widen without intervention.`,
          action: 'Review commit deals this week and identify 2-3 deals that can be accelerated.',
          weight: 70 - forecastConfidence.confidenceScore + 30,
        });
      }
    }

    // Priority from pipeline risk
    const riskFlags = pipelineRisk.riskFlags || [];
    const criticalDeals = riskFlags.filter(f => f.riskLevel === 'critical');

    if (criticalDeals.length > 0) {
      const topCritical = criticalDeals.slice(0, 3);
      candidates.push({
        priority: 'critical',
        source: 'pipeline_risk',
        title: `${criticalDeals.length} deal${criticalDeals.length > 1 ? 's' : ''} at critical risk`,
        detail: `Critical deals: ${topCritical.map(d => d.dealName).join(', ')}. Primary signals: ${topCritical.map(d => d.signals[0]?.type).filter(Boolean).join(', ')}.`,
        action: criticalDeals.length === 1
          ? `Review ${topCritical[0].dealName} immediately. ${topCritical[0].recommendedAction}`
          : 'Schedule deal rescue reviews for all critical deals this week.',
        weight: 60 + criticalDeals.length * 10,
      });
    }

    // Priority from deal intelligence: deals needing leadership intervention
    const dealInsights = Array.isArray(dealIntelligence) ? dealIntelligence : [];
    const leadershipDeals = dealInsights.filter(d =>
      d.recommendedIntervention?.urgency === 'immediate'
    );

    if (leadershipDeals.length > 0) {
      candidates.push({
        priority: 'high',
        source: 'deal_intelligence',
        title: `${leadershipDeals.length} deal${leadershipDeals.length > 1 ? 's' : ''} need${leadershipDeals.length === 1 ? 's' : ''} leadership involvement`,
        detail: leadershipDeals.map(d => d.leadershipBrief?.headline || 'Deal needs review').join('; '),
        action: 'Block time for deal strategy sessions with the assigned reps.',
        weight: 55 + leadershipDeals.length * 5,
      });
    }

    // Priority from rep performance: reps with critical coaching needs
    const repInsights = Array.isArray(repPerformance) ? repPerformance : [];
    const criticalReps = repInsights.filter(r =>
      r.coachingFlags?.some(f => f.severity === 'critical')
    );

    if (criticalReps.length > 0) {
      candidates.push({
        priority: 'high',
        source: 'rep_performance',
        title: `${criticalReps.length} rep${criticalReps.length > 1 ? 's' : ''} need${criticalReps.length === 1 ? 's' : ''} urgent coaching`,
        detail: criticalReps.map(r => `${r.scorecard?.repName || 'Rep'}: ${r.coachingFlags.filter(f => f.severity === 'critical').map(f => f.area).join(', ')}`).join('; '),
        action: 'Schedule focused 1:1 coaching sessions this week.',
        weight: 45 + criticalReps.length * 10,
      });
    }

    // Sort by weight descending, return top N
    candidates.sort((a, b) => b.weight - a.weight);
    return candidates.slice(0, this.maxPriorities);
  }

  // ─── Top Risks ─────────────────────────────────────────────

  _deriveTopRisks(pipelineRisk, forecastConfidence, dealIntelligence, repPerformance) {
    const risks = [];

    // Forecast drift risk
    if (forecastConfidence.forecastDrift?.direction === 'down' && forecastConfidence.forecastDrift.magnitude > 5) {
      risks.push({
        severity: forecastConfidence.forecastDrift.magnitude > 15 ? 'critical' : 'high',
        source: 'forecast',
        title: 'Forecast trending downward',
        detail: forecastConfidence.forecastDrift.warning || `Forecast has drifted down ${forecastConfidence.forecastDrift.magnitude}%.`,
        weight: 50 + forecastConfidence.forecastDrift.magnitude,
      });
    }

    // Coverage risk
    if (forecastConfidence.coverageRatio != null && forecastConfidence.coverageRatio < (config.thresholds?.minPipelineCoverage || 3)) {
      risks.push({
        severity: forecastConfidence.coverageRatio < 1.5 ? 'critical' : 'high',
        source: 'forecast',
        title: 'Insufficient pipeline coverage',
        detail: `Pipeline coverage is ${forecastConfidence.coverageRatio}x. Minimum needed: ${config.thresholds?.minPipelineCoverage || 3}x.`,
        weight: 65 - forecastConfidence.coverageRatio * 10,
      });
    }

    // Aggregate pipeline risk
    const summary = pipelineRisk.summary || {};
    if (summary.criticalCount > 0) {
      risks.push({
        severity: summary.criticalCount >= 5 ? 'critical' : 'high',
        source: 'pipeline_risk',
        title: 'Multiple deals at critical risk',
        detail: `${summary.criticalCount} critical, ${summary.highCount} high-risk deals out of ${summary.totalAtRisk} total at-risk deals.`,
        weight: 40 + summary.criticalCount * 8 + summary.highCount * 3,
      });
    }

    // Forecast risk factors
    for (const factor of (forecastConfidence.riskFactors || [])) {
      risks.push({
        severity: factor.severity,
        source: 'forecast',
        title: factor.type.replace(/_/g, ' '),
        detail: factor.detail,
        weight: factor.severity === 'critical' ? 55 : factor.severity === 'high' ? 40 : 25,
      });
    }

    // Rep-related risks
    const repInsights = Array.isArray(repPerformance) ? repPerformance : [];
    const lowPerformers = repInsights.filter(r => r.scorecard?.overallScore < 40);
    if (lowPerformers.length > 0) {
      risks.push({
        severity: 'high',
        source: 'rep_performance',
        title: 'Underperforming reps',
        detail: `${lowPerformers.length} rep${lowPerformers.length > 1 ? 's' : ''} scoring below 40: ${lowPerformers.map(r => r.scorecard?.repName || 'Unknown').join(', ')}.`,
        weight: 35 + lowPerformers.length * 5,
      });
    }

    risks.sort((a, b) => b.weight - a.weight);
    return risks.slice(0, this.maxRisks);
  }

  // ─── Leverage Moves ────────────────────────────────────────

  _deriveLeverageMoves(pipelineRisk, forecastConfidence, dealIntelligence, repPerformance) {
    const moves = [];

    // Move 1: Accelerate near-close deals
    const commitTotal = forecastConfidence.commitTotal || 0;
    const bestCaseTotal = forecastConfidence.bestCaseTotal || 0;
    const upside = bestCaseTotal - commitTotal;

    if (upside > 0) {
      moves.push({
        type: 'accelerate',
        title: 'Accelerate best-case deals into commit',
        detail: `$${upside.toLocaleString()} in best-case deals not yet committed. Identify which can be pulled forward.`,
        potentialImpact: upside,
        weight: 70,
      });
    }

    // Move 2: Rescue at-risk high-value deals
    const riskFlags = pipelineRisk.riskFlags || [];
    const highValueAtRisk = riskFlags
      .filter(f => f.riskLevel === 'critical' || f.riskLevel === 'high')
      .slice(0, 5);

    if (highValueAtRisk.length > 0) {
      moves.push({
        type: 'rescue',
        title: 'Rescue high-value at-risk deals',
        detail: `${highValueAtRisk.length} high-value deals at risk. Targeted interventions (executive sponsor calls, competitive repositioning) could save revenue.`,
        deals: highValueAtRisk.map(d => d.dealName),
        weight: 60,
      });
    }

    // Move 3: Coach underperforming reps
    const repInsights = Array.isArray(repPerformance) ? repPerformance : [];
    const coachableReps = repInsights.filter(r =>
      r.scorecard?.overallScore < 60 && r.scorecard?.overallScore >= 30
    );

    if (coachableReps.length > 0) {
      moves.push({
        type: 'coaching',
        title: 'Invest in rep coaching for quick wins',
        detail: `${coachableReps.length} rep${coachableReps.length > 1 ? 's' : ''} in the coachable range (30-60 score). Focused coaching could lift their pipeline quality and close rates.`,
        reps: coachableReps.map(r => r.scorecard?.repName || 'Unknown'),
        weight: 50,
      });
    }

    // Move 4: Pipeline generation if coverage is low
    if (forecastConfidence.coverageRatio != null && forecastConfidence.coverageRatio < 3) {
      moves.push({
        type: 'pipeline_generation',
        title: 'Launch pipeline generation initiative',
        detail: `Coverage is ${forecastConfidence.coverageRatio}x — below the ${config.thresholds?.minPipelineCoverage || 3}x target. Activate outbound campaigns, partner channels, or marketing programs.`,
        weight: 55,
      });
    }

    // Move 5: Stakeholder expansion on key deals
    const dealInsights = Array.isArray(dealIntelligence) ? dealIntelligence : [];
    const singleThreadedDeals = dealInsights.filter(d =>
      d.stakeholderAnalysis?.singleThreaded && d.stakeholderAnalysis?.riskLevel !== 'low'
    );

    if (singleThreadedDeals.length > 0) {
      moves.push({
        type: 'stakeholder_expansion',
        title: 'Multi-thread single-threaded deals',
        detail: `${singleThreadedDeals.length} deal${singleThreadedDeals.length > 1 ? 's' : ''} rely on a single contact. Executive introductions or champion-building can strengthen these opportunities.`,
        weight: 45,
      });
    }

    moves.sort((a, b) => b.weight - a.weight);
    return moves.slice(0, this.maxLeverageMoves);
  }

  // ─── Executive Summary ─────────────────────────────────────

  _buildExecutiveSummary(pipelineRisk, forecastConfidence, topPriorities, topRisks) {
    const parts = [];

    // Forecast headline
    if (forecastConfidence.confidenceScore != null) {
      const confidence = forecastConfidence.confidenceScore;
      const label = confidence >= 70 ? 'on track' : confidence >= 50 ? 'at moderate risk' : 'at significant risk';
      parts.push(`Forecast confidence is ${confidence}/100 — the quarter is ${label}.`);

      if (forecastConfidence.closedRevenue != null && forecastConfidence.remaining != null) {
        const closedPct = forecastConfidence.closedRevenue + forecastConfidence.remaining > 0
          ? Math.round((forecastConfidence.closedRevenue / (forecastConfidence.closedRevenue + forecastConfidence.remaining)) * 100)
          : 0;
        parts.push(`${closedPct}% of target is closed, with $${(forecastConfidence.remaining || 0).toLocaleString()} remaining.`);
      }

      if (forecastConfidence.coverageRatio != null) {
        parts.push(`Pipeline coverage: ${forecastConfidence.coverageRatio}x.`);
      }
    }

    // Pipeline health headline
    const summary = pipelineRisk.summary || {};
    if (summary.totalAtRisk > 0) {
      parts.push(`${summary.totalAtRisk} deal${summary.totalAtRisk > 1 ? 's' : ''} flagged at risk (${summary.criticalCount} critical, ${summary.highCount} high).`);
    } else {
      parts.push('No critical pipeline risks detected.');
    }

    // Top priority callout
    if (topPriorities.length > 0) {
      const topPriority = topPriorities[0];
      parts.push(`Top priority: ${topPriority.title}.`);
    }

    return parts.join(' ');
  }

  // ─── Attention Required ────────────────────────────────────

  _determineAttentionRequired(pipelineRisk, forecastConfidence, topRisks) {
    const criticalRisks = topRisks.filter(r => r.severity === 'critical');
    const summary = pipelineRisk.summary || {};
    const confidence = forecastConfidence.confidenceScore ?? 50;

    if (criticalRisks.length >= 2 || confidence < 30 || summary.criticalCount >= 5) {
      return {
        level: 'immediate',
        reason: 'Multiple critical signals detected. Leadership review needed today.',
      };
    }

    if (criticalRisks.length >= 1 || confidence < 50 || summary.criticalCount >= 2) {
      return {
        level: 'this_week',
        reason: 'Significant risks identified. Schedule a pipeline review this week.',
      };
    }

    if (topRisks.length > 0 || confidence < 65) {
      return {
        level: 'monitor',
        reason: 'Some risks present but manageable. Keep an eye on trending metrics.',
      };
    }

    return {
      level: 'none',
      reason: 'Pipeline and forecast look healthy. Continue standard operating cadence.',
    };
  }
}

export default ExecutiveFocusAgent;
