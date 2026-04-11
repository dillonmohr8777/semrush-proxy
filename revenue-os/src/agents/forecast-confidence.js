import config from '../config.js';

const STAGE_WEIGHTS = {
  qualification: 0.10,
  discovery: 0.20,
  proposal: 0.40,
  negotiation: 0.60,
  commit: 0.80,
  closed_won: 1.00,
  closed_lost: 0.00,
};

class ForecastConfidenceAgent {
  constructor(options = {}) {
    this.stageWeights = { ...STAGE_WEIGHTS, ...(config.dealStages ? this._extractWeights(config.dealStages) : {}), ...options.stageWeights };
    this.driftThreshold = options.driftThreshold ?? config.thresholds?.forecastDriftThreshold ?? 10;
    this.minCoverage = options.minCoverage ?? config.thresholds?.minPipelineCoverage ?? 3.0;
  }

  /**
   * Analyze the pipeline against a quarter target and historical performance.
   *
   * @param {Array}  deals          - Active deal objects from HubSpot.
   * @param {Object} historicalData - { avgCloseRate, avgCycleLength, previousForecasts: [{week, amount}], wonDealsThisQuarter: [] }
   * @param {number} quarterTarget  - Revenue target for the quarter.
   * @returns {Object}
   */
  analyze(deals, historicalData = {}, quarterTarget = 0) {
    const activeDeals = deals.filter(d => !this._isClosed(d));
    const wonDeals = historicalData.wonDealsThisQuarter || deals.filter(d => this._isWon(d));

    const closedRevenue = wonDeals.reduce((sum, d) => sum + this._dealAmount(d), 0);
    const remaining = Math.max(0, quarterTarget - closedRevenue);

    // Weighted pipeline: each deal's amount multiplied by its stage probability
    const weightedPipeline = this._calculateWeightedPipeline(activeDeals);

    // Commit deals: deals in commit stage or beyond (minus closed)
    const commitDeals = activeDeals.filter(d => this._stageWeight(d) >= 0.8);
    const commitTotal = commitDeals.reduce((sum, d) => sum + this._dealAmount(d), 0);

    // Best case: commit deals plus deals in negotiation or proposal
    const bestCaseDeals = activeDeals.filter(d => this._stageWeight(d) >= 0.4);
    const bestCaseTotal = bestCaseDeals.reduce((sum, d) => sum + this._dealAmount(d), 0);

    // Total active pipeline value
    const totalPipelineValue = activeDeals.reduce((sum, d) => sum + this._dealAmount(d), 0);

    // Coverage ratio: total pipeline divided by remaining target
    const coverageRatio = remaining > 0 ? totalPipelineValue / remaining : (totalPipelineValue > 0 ? Infinity : 0);

    // Stage velocity: average days in current stage across active deals
    const stageVelocity = this._calculateStageVelocity(activeDeals);

    // Historical close rate comparison
    const avgCloseRate = historicalData.avgCloseRate ?? 0.25;
    const projectedFromPipeline = totalPipelineValue * avgCloseRate;
    const trajectoryGap = remaining - (projectedFromPipeline + commitTotal);

    // Weekly trend from previous forecasts
    const weeklyTrend = this._calculateWeeklyTrend(historicalData.previousForecasts || []);

    // Forecast drift
    const forecastDrift = this._calculateDriftFromHistory(historicalData.previousForecasts || []);

    // Risk factors
    const riskFactors = this._identifyRiskFactors({
      coverageRatio,
      commitTotal,
      remaining,
      stageVelocity,
      activeDeals,
      avgCloseRate,
      trajectoryGap,
      weeklyTrend,
    });

    // Confidence score: 0–100
    const confidenceScore = this._calculateConfidenceScore({
      coverageRatio,
      commitTotal,
      remaining,
      closedRevenue,
      quarterTarget,
      weightedPipeline,
      trajectoryGap,
      riskFactors,
      weeklyTrend,
    });

    return {
      confidenceScore,
      coverageRatio: Math.round(coverageRatio * 100) / 100,
      commitTotal,
      bestCaseTotal,
      weightedPipeline: Math.round(weightedPipeline),
      closedRevenue,
      remaining,
      forecastDrift,
      weeklyTrend,
      riskFactors,
      stageVelocity,
    };
  }

  /**
   * Detect and quantify forecast movement between two snapshots.
   *
   * @param {Object} currentForecast  - { commitTotal, bestCaseTotal, weightedPipeline, date }
   * @param {Object} previousForecast - Same shape as currentForecast.
   * @returns {Object} { direction, magnitude, warning, details }
   */
  detectDrift(currentForecast, previousForecast) {
    if (!previousForecast || !currentForecast) {
      return { direction: 'unknown', magnitude: 0, warning: null, details: [] };
    }

    const details = [];

    // Commit drift
    const commitDelta = (currentForecast.commitTotal || 0) - (previousForecast.commitTotal || 0);
    const commitPctChange = previousForecast.commitTotal
      ? (commitDelta / previousForecast.commitTotal) * 100
      : 0;

    if (Math.abs(commitPctChange) > 0) {
      details.push({
        metric: 'commitTotal',
        previous: previousForecast.commitTotal || 0,
        current: currentForecast.commitTotal || 0,
        delta: commitDelta,
        pctChange: Math.round(commitPctChange * 10) / 10,
      });
    }

    // Best case drift
    const bestDelta = (currentForecast.bestCaseTotal || 0) - (previousForecast.bestCaseTotal || 0);
    const bestPctChange = previousForecast.bestCaseTotal
      ? (bestDelta / previousForecast.bestCaseTotal) * 100
      : 0;

    if (Math.abs(bestPctChange) > 0) {
      details.push({
        metric: 'bestCaseTotal',
        previous: previousForecast.bestCaseTotal || 0,
        current: currentForecast.bestCaseTotal || 0,
        delta: bestDelta,
        pctChange: Math.round(bestPctChange * 10) / 10,
      });
    }

    // Weighted pipeline drift
    const weightedDelta = (currentForecast.weightedPipeline || 0) - (previousForecast.weightedPipeline || 0);
    const weightedPctChange = previousForecast.weightedPipeline
      ? (weightedDelta / previousForecast.weightedPipeline) * 100
      : 0;

    if (Math.abs(weightedPctChange) > 0) {
      details.push({
        metric: 'weightedPipeline',
        previous: previousForecast.weightedPipeline || 0,
        current: currentForecast.weightedPipeline || 0,
        delta: weightedDelta,
        pctChange: Math.round(weightedPctChange * 10) / 10,
      });
    }

    // Overall direction is determined by commit drift (most important)
    const magnitude = Math.abs(commitPctChange);
    const direction = commitDelta > 0 ? 'up' : commitDelta < 0 ? 'down' : 'flat';

    let warning = null;
    if (direction === 'down' && magnitude > this.driftThreshold) {
      warning = `Forecast dropped ${Math.round(magnitude)}% — commit total fell by $${Math.abs(commitDelta).toLocaleString()}. Investigate deals that moved out of commit.`;
    } else if (direction === 'down' && magnitude > this.driftThreshold / 2) {
      warning = `Moderate downward drift (${Math.round(magnitude)}%). Monitor closely this week.`;
    } else if (direction === 'up' && magnitude > this.driftThreshold * 2) {
      warning = `Large upward swing (${Math.round(magnitude)}%). Validate that new commits are real — avoid happy ears.`;
    }

    return { direction, magnitude: Math.round(magnitude * 10) / 10, warning, details };
  }

  // ─── Internal helpers ──────────────────────────────────────

  _extractWeights(dealStages) {
    const weights = {};
    for (const [key, val] of Object.entries(dealStages)) {
      if (val.probability != null) weights[key] = val.probability;
    }
    return weights;
  }

  _isClosed(deal) {
    const stage = (deal.dealstage || deal.stage || '').toLowerCase();
    return stage === 'closed_won' || stage === 'closed_lost' ||
           stage === 'closedwon' || stage === 'closedlost';
  }

  _isWon(deal) {
    const stage = (deal.dealstage || deal.stage || '').toLowerCase();
    return stage === 'closed_won' || stage === 'closedwon';
  }

  _dealAmount(deal) {
    return parseFloat(deal.amount || deal.properties?.amount || 0) || 0;
  }

  _dealStage(deal) {
    return (deal.dealstage || deal.stage || deal.properties?.dealstage || '').toLowerCase();
  }

  _stageWeight(deal) {
    const stage = this._dealStage(deal);
    if (this.stageWeights[stage] != null) return this.stageWeights[stage];
    // Fallback: check if deal has a probability field
    const prob = parseFloat(deal.hs_deal_stage_probability || deal.probability || 0);
    return prob > 1 ? prob / 100 : prob;
  }

  _calculateWeightedPipeline(deals) {
    return deals.reduce((sum, d) => sum + this._dealAmount(d) * this._stageWeight(d), 0);
  }

  _calculateStageVelocity(deals) {
    const now = Date.now();
    const daysInStage = deals
      .map(d => {
        const entered = d.stage_entered_date || d.hs_date_entered_current_stage || d.stageEnteredDate;
        if (!entered) return null;
        const ts = new Date(entered).getTime();
        if (isNaN(ts)) return null;
        return Math.floor((now - ts) / (1000 * 60 * 60 * 24));
      })
      .filter(d => d !== null);

    if (daysInStage.length === 0) return { avg: 0, median: 0, count: 0 };

    const sorted = [...daysInStage].sort((a, b) => a - b);
    const avg = Math.round(daysInStage.reduce((s, v) => s + v, 0) / daysInStage.length);
    const median = sorted[Math.floor(sorted.length / 2)];

    return { avg, median, count: daysInStage.length };
  }

  _calculateWeeklyTrend(previousForecasts) {
    if (!previousForecasts || previousForecasts.length < 2) {
      return { direction: 'insufficient_data', dataPoints: previousForecasts?.length || 0 };
    }

    const sorted = [...previousForecasts].sort((a, b) => {
      const da = new Date(a.week || a.date).getTime();
      const db = new Date(b.week || b.date).getTime();
      return da - db;
    });

    const recent = sorted.slice(-4); // Last 4 weeks
    const deltas = [];
    for (let i = 1; i < recent.length; i++) {
      deltas.push((recent[i].amount || 0) - (recent[i - 1].amount || 0));
    }

    const avgDelta = deltas.reduce((s, v) => s + v, 0) / deltas.length;
    const direction = avgDelta > 0 ? 'improving' : avgDelta < 0 ? 'declining' : 'flat';
    const consistency = deltas.every(d => d >= 0)
      ? 'consistently_up'
      : deltas.every(d => d <= 0)
        ? 'consistently_down'
        : 'volatile';

    return {
      direction,
      avgWeeklyDelta: Math.round(avgDelta),
      consistency,
      dataPoints: recent.length,
      recent: recent.map(r => ({ week: r.week || r.date, amount: r.amount || 0 })),
    };
  }

  _calculateDriftFromHistory(previousForecasts) {
    if (!previousForecasts || previousForecasts.length < 2) {
      return { direction: 'unknown', magnitude: 0, warning: null };
    }

    const sorted = [...previousForecasts].sort((a, b) => {
      const da = new Date(a.week || a.date).getTime();
      const db = new Date(b.week || b.date).getTime();
      return da - db;
    });

    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];

    return this.detectDrift(
      { commitTotal: latest.amount || 0 },
      { commitTotal: previous.amount || 0 },
    );
  }

  _identifyRiskFactors({ coverageRatio, commitTotal, remaining, stageVelocity, activeDeals, avgCloseRate, trajectoryGap, weeklyTrend }) {
    const factors = [];

    if (coverageRatio < this.minCoverage) {
      factors.push({
        type: 'low_coverage',
        severity: coverageRatio < this.minCoverage / 2 ? 'critical' : 'high',
        detail: `Pipeline coverage is ${coverageRatio.toFixed(1)}x — need at least ${this.minCoverage}x to hit target.`,
      });
    }

    if (remaining > 0 && commitTotal < remaining * 0.5) {
      factors.push({
        type: 'commit_gap',
        severity: commitTotal < remaining * 0.25 ? 'critical' : 'high',
        detail: `Commit total ($${commitTotal.toLocaleString()}) covers only ${remaining > 0 ? Math.round((commitTotal / remaining) * 100) : 0}% of remaining target.`,
      });
    }

    if (trajectoryGap > 0) {
      factors.push({
        type: 'trajectory_gap',
        severity: trajectoryGap > remaining * 0.5 ? 'critical' : 'medium',
        detail: `Based on historical close rate (${Math.round(avgCloseRate * 100)}%), projected revenue falls $${Math.round(trajectoryGap).toLocaleString()} short of target.`,
      });
    }

    if (stageVelocity.avg > 21) {
      factors.push({
        type: 'slow_velocity',
        severity: stageVelocity.avg > 35 ? 'high' : 'medium',
        detail: `Average stage duration is ${stageVelocity.avg} days — deals are moving too slowly.`,
      });
    }

    // Check for top-heavy pipeline (too much value in early stages)
    const earlyStageValue = activeDeals
      .filter(d => this._stageWeight(d) <= 0.2)
      .reduce((sum, d) => sum + this._dealAmount(d), 0);
    const totalValue = activeDeals.reduce((sum, d) => sum + this._dealAmount(d), 0);

    if (totalValue > 0 && earlyStageValue / totalValue > 0.6) {
      factors.push({
        type: 'top_heavy_pipeline',
        severity: 'medium',
        detail: `${Math.round((earlyStageValue / totalValue) * 100)}% of pipeline value is in early stages — unlikely to close this quarter.`,
      });
    }

    if (weeklyTrend.direction === 'declining' && weeklyTrend.consistency === 'consistently_down') {
      factors.push({
        type: 'declining_trend',
        severity: 'high',
        detail: 'Forecast has declined consistently over the last several weeks.',
      });
    }

    return factors;
  }

  _calculateConfidenceScore({ coverageRatio, commitTotal, remaining, closedRevenue, quarterTarget, weightedPipeline, trajectoryGap, riskFactors, weeklyTrend }) {
    if (quarterTarget <= 0) return 50; // No target set, neutral confidence

    let score = 50; // Start at neutral

    // Already closed revenue boost (up to +30)
    if (quarterTarget > 0) {
      const pctClosed = closedRevenue / quarterTarget;
      score += Math.min(30, Math.round(pctClosed * 30));
    }

    // Commit coverage of remaining (up to +25)
    if (remaining > 0) {
      const commitCoverage = commitTotal / remaining;
      if (commitCoverage >= 1.0) score += 25;
      else if (commitCoverage >= 0.75) score += 20;
      else if (commitCoverage >= 0.5) score += 12;
      else if (commitCoverage >= 0.25) score += 5;
      else score -= 10;
    } else if (closedRevenue >= quarterTarget) {
      score += 25; // Already at target
    }

    // Pipeline coverage bonus/penalty (up to +/-15)
    if (coverageRatio >= this.minCoverage) {
      score += 10;
    } else if (coverageRatio >= this.minCoverage * 0.6) {
      score += 0;
    } else {
      score -= 15;
    }

    // Weighted pipeline vs remaining (up to +10)
    if (remaining > 0 && weightedPipeline >= remaining) {
      score += 10;
    } else if (remaining > 0 && weightedPipeline >= remaining * 0.7) {
      score += 5;
    }

    // Weekly trend adjustment (+/-5)
    if (weeklyTrend.direction === 'improving') score += 5;
    else if (weeklyTrend.direction === 'declining') score -= 5;

    // Risk factor penalties
    for (const factor of riskFactors) {
      if (factor.severity === 'critical') score -= 8;
      else if (factor.severity === 'high') score -= 5;
      else if (factor.severity === 'medium') score -= 3;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

export default ForecastConfidenceAgent;
