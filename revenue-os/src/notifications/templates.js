// Revenue OS — Alert HTML Templates
// Clean, professional email templates with inline CSS for maximum compatibility.

const BRAND = {
  primary: '#1a1a2e',
  accent: '#e94560',
  success: '#27ae60',
  warning: '#f39c12',
  danger: '#e74c3c',
  info: '#3498db',
  muted: '#7f8c8d',
  bg: '#f4f6f8',
  white: '#ffffff',
  text: '#2c3e50',
  lightBorder: '#e0e4e8',
};

function baseLayout(title, preheader, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};line-height:1.6;">
<!-- Preheader text (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};">
<tr><td align="center" style="padding:24px 16px;">

<!-- Header -->
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background-color:${BRAND.primary};border-radius:8px 8px 0 0;">
<tr><td style="padding:24px 32px;">
  <h1 style="margin:0;color:${BRAND.white};font-size:22px;font-weight:700;letter-spacing:-0.3px;">Revenue OS</h1>
  <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">${escapeHtml(title)}</p>
</td></tr>
</table>

<!-- Body -->
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background-color:${BRAND.white};border:1px solid ${BRAND.lightBorder};border-top:none;">
<tr><td style="padding:32px;">
${bodyContent}
</td></tr>
</table>

<!-- Footer -->
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background-color:${BRAND.bg};border-radius:0 0 8px 8px;">
<tr><td style="padding:16px 32px;text-align:center;">
  <p style="margin:0;color:${BRAND.muted};font-size:11px;">Revenue OS &mdash; Automated Sales Intelligence &bull; ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
</td></tr>
</table>

</td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sectionHeader(text, color = BRAND.primary) {
  return `<h2 style="margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid ${color};color:${color};font-size:16px;font-weight:700;">${escapeHtml(text)}</h2>`;
}

function badge(label, color) {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;background-color:${color};color:${BRAND.white};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(label)}</span>`;
}

function kpiCard(label, value, subtext = '', color = BRAND.primary) {
  return `<td style="padding:8px 12px;text-align:center;width:33%;">
  <div style="background:${BRAND.bg};border-radius:6px;padding:14px 8px;border-left:3px solid ${color};">
    <div style="font-size:22px;font-weight:700;color:${color};">${escapeHtml(String(value))}</div>
    <div style="font-size:11px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">${escapeHtml(label)}</div>
    ${subtext ? `<div style="font-size:11px;color:${BRAND.muted};margin-top:2px;">${escapeHtml(subtext)}</div>` : ''}
  </div>
</td>`;
}

function tableRow(cells, isHeader = false) {
  const tag = isHeader ? 'th' : 'td';
  const bgColor = isHeader ? BRAND.primary : BRAND.white;
  const textColor = isHeader ? BRAND.white : BRAND.text;
  const fontWeight = isHeader ? '600' : '400';
  const fontSize = isHeader ? '11px' : '13px';

  return `<tr>${cells.map(c =>
    `<${tag} style="padding:10px 14px;text-align:left;background-color:${bgColor};color:${textColor};font-weight:${fontWeight};font-size:${fontSize};border-bottom:1px solid ${BRAND.lightBorder};white-space:nowrap;">${isHeader ? escapeHtml(c) : c}</${tag}>`
  ).join('')}</tr>`;
}

function buildTable(headers, rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${BRAND.lightBorder};border-radius:4px;overflow:hidden;">
${tableRow(headers, true)}
${rows.map(r => tableRow(r)).join('\n')}
</table>`;
}

function bulletList(items, icon = '&bull;') {
  if (!items || items.length === 0) return `<p style="color:${BRAND.muted};font-size:13px;">None reported.</p>`;
  return items.map(item =>
    `<div style="padding:6px 0;font-size:13px;">${icon} ${escapeHtml(item)}</div>`
  ).join('');
}

function healthColor(status) {
  const s = String(status).toLowerCase();
  if (s === 'healthy' || s === 'low') return BRAND.success;
  if (s === 'at risk' || s === 'medium') return BRAND.warning;
  if (s === 'critical' || s === 'high' || s === 'urgent') return BRAND.danger;
  if (s === 'stalled') return BRAND.muted;
  return BRAND.info;
}

function formatCurrency(val) {
  if (val == null) return '$0';
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatPercent(val) {
  if (val == null) return '0%';
  return Number(val).toFixed(1) + '%';
}


// ---------------------------------------------------------------------------
// Template: Daily Brief
// ---------------------------------------------------------------------------

export function dailyBriefHTML(data = {}) {
  const {
    date = new Date().toISOString().slice(0, 10),
    pipelineHealth = {},
    priorities = [],
    risks = [],
    opportunities = [],
    repSignals = [],
    recommendedFocus = [],
  } = data;

  const ph = pipelineHealth;

  const kpiRow = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${kpiCard('Total Pipeline', formatCurrency(ph.totalPipeline), '', BRAND.info)}
${kpiCard('Weighted', formatCurrency(ph.weightedPipeline), '', BRAND.primary)}
${kpiCard('Coverage', ph.coverageRatio != null ? ph.coverageRatio + 'x' : 'N/A', '', ph.coverageRatio >= 3 ? BRAND.success : BRAND.danger)}
</tr><tr>
${kpiCard('Deals', ph.dealCount ?? 'N/A', '', BRAND.info)}
${kpiCard('At Risk', ph.atRiskCount ?? 0, '', ph.atRiskCount > 0 ? BRAND.danger : BRAND.success)}
${kpiCard('Avg Age', ph.avgDaysInStage != null ? ph.avgDaysInStage + 'd' : 'N/A', '', BRAND.muted)}
</tr></table>`;

  const prioritiesHTML = priorities.length > 0
    ? priorities.map((p, i) => `<div style="padding:8px 12px;margin-bottom:6px;background:${BRAND.bg};border-radius:4px;font-size:13px;border-left:3px solid ${BRAND.accent};"><strong>${i + 1}.</strong> ${escapeHtml(p)}</div>`).join('')
    : `<p style="color:${BRAND.muted};font-size:13px;">No priorities flagged.</p>`;

  const risksHTML = risks.length > 0
    ? risks.map((r, i) => `<div style="padding:8px 12px;margin-bottom:6px;background:#fef5f5;border-radius:4px;font-size:13px;border-left:3px solid ${BRAND.danger};"><strong>${i + 1}.</strong> ${escapeHtml(typeof r === 'string' ? r : r.description || r.summary || JSON.stringify(r))}</div>`).join('')
    : `<p style="color:${BRAND.muted};font-size:13px;">No major risks.</p>`;

  const opportunitiesRows = opportunities.map(o => [
    escapeHtml(o.name || o.dealName || ''),
    escapeHtml(formatCurrency(o.amount)),
    escapeHtml(o.stage || ''),
    badge(o.signal || 'Positive', BRAND.success),
  ]);

  const oppsHTML = opportunitiesRows.length > 0
    ? buildTable(['Deal', 'Value', 'Stage', 'Signal'], opportunitiesRows)
    : `<p style="color:${BRAND.muted};font-size:13px;">No key opportunities to highlight.</p>`;

  const repSignalsRows = repSignals.map(r => [
    escapeHtml(r.name || ''),
    badge(r.signal || r.status || '', healthColor(r.signal || r.status || '')),
    escapeHtml(r.detail || r.note || ''),
  ]);

  const repHTML = repSignalsRows.length > 0
    ? buildTable(['Rep', 'Signal', 'Detail'], repSignalsRows)
    : `<p style="color:${BRAND.muted};font-size:13px;">No rep signals.</p>`;

  const focusHTML = recommendedFocus.length > 0
    ? recommendedFocus.map((f, i) => `<div style="padding:8px 12px;margin-bottom:6px;background:#f0faf4;border-radius:4px;font-size:13px;border-left:3px solid ${BRAND.success};"><strong>${i + 1}.</strong> ${escapeHtml(f)}</div>`).join('')
    : `<p style="color:${BRAND.muted};font-size:13px;">No specific focus recommendations.</p>`;

  const body = `
<p style="font-size:15px;color:${BRAND.text};margin:0 0 20px;">Good morning. Here is your daily executive brief for <strong>${escapeHtml(date)}</strong>.</p>

${sectionHeader('Pipeline Health', BRAND.info)}
${kpiRow}

${sectionHeader('Top 3 Priorities', BRAND.accent)}
${prioritiesHTML}

${sectionHeader('Top 3 Risks', BRAND.danger)}
${risksHTML}

${sectionHeader('Key Opportunities', BRAND.success)}
${oppsHTML}

${sectionHeader('Rep Signals', BRAND.warning)}
${repHTML}

${sectionHeader('Recommended Focus', BRAND.success)}
${focusHTML}
`;

  return baseLayout(`Daily Executive Brief - ${date}`, `Your daily revenue brief for ${date}`, body);
}


// ---------------------------------------------------------------------------
// Template: Deal Risk Alert
// ---------------------------------------------------------------------------

export function dealRiskHTML(data = {}) {
  const {
    dealName = 'Unknown Deal',
    dealId = '',
    amount = 0,
    stage = '',
    owner = '',
    healthStatus = 'At Risk',
    daysInStage = 0,
    riskSignals = [],
    recommendedActions = [],
    closeDate = '',
    stakeholders = '',
  } = data;

  const body = `
<div style="text-align:center;margin-bottom:24px;">
  ${badge(healthStatus, healthColor(healthStatus))}
</div>

${sectionHeader('Deal Overview', BRAND.danger)}
${buildTable(['Field', 'Value'], [
  ['Deal', escapeHtml(dealName)],
  ['HubSpot ID', escapeHtml(String(dealId))],
  ['Amount', escapeHtml(formatCurrency(amount))],
  ['Stage', escapeHtml(stage)],
  ['Owner', escapeHtml(owner)],
  ['Days in Stage', escapeHtml(String(daysInStage))],
  ['Close Date', escapeHtml(closeDate || 'Not set')],
  ['Stakeholders', escapeHtml(stakeholders || 'Not documented')],
])}

${sectionHeader('Risk Signals', BRAND.danger)}
${bulletList(riskSignals, '&#9888;')}

${sectionHeader('Recommended Actions', BRAND.info)}
${recommendedActions.length > 0
    ? recommendedActions.map((a, i) => `<div style="padding:8px 12px;margin-bottom:6px;background:${BRAND.bg};border-radius:4px;font-size:13px;border-left:3px solid ${BRAND.info};"><strong>${i + 1}.</strong> ${escapeHtml(a)}</div>`).join('')
    : `<p style="color:${BRAND.muted};font-size:13px;">No specific actions recommended.</p>`}
`;

  return baseLayout(`Deal Risk Alert - ${dealName}`, `Risk alert for ${dealName} (${formatCurrency(amount)})`, body);
}


// ---------------------------------------------------------------------------
// Template: Forecast Drift Alert
// ---------------------------------------------------------------------------

export function forecastDriftHTML(data = {}) {
  const {
    period = '',
    previousForecast = 0,
    currentForecast = 0,
    target = 0,
    driftPercent = 0,
    driftDirection = 'down',
    commitDeals = [],
    droppedDeals = [],
    addedDeals = [],
    notes = '',
  } = data;

  const driftColor = driftDirection === 'down' ? BRAND.danger : BRAND.success;
  const arrow = driftDirection === 'down' ? '&#9660;' : '&#9650;';

  const body = `
<div style="text-align:center;margin-bottom:24px;">
  ${badge(`Forecast ${driftDirection === 'down' ? 'Declined' : 'Improved'} ${formatPercent(Math.abs(driftPercent))}`, driftColor)}
</div>

${sectionHeader('Forecast Comparison', BRAND.info)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${kpiCard('Previous', formatCurrency(previousForecast), '', BRAND.muted)}
${kpiCard('Current', formatCurrency(currentForecast), `${arrow} ${formatPercent(Math.abs(driftPercent))}`, driftColor)}
${kpiCard('Target', formatCurrency(target), '', BRAND.primary)}
</tr></table>

<div style="margin-top:16px;">
${buildTable(['Metric', 'Value'], [
  ['Period', escapeHtml(period)],
  ['Gap to Target', escapeHtml(formatCurrency(target - currentForecast))],
  ['Coverage', escapeHtml(target > 0 ? formatPercent((currentForecast / target) * 100) : 'N/A')],
])}
</div>

${droppedDeals.length > 0 ? `${sectionHeader('Deals Dropped from Forecast', BRAND.danger)}
${buildTable(['Deal', 'Amount', 'Reason'], droppedDeals.map(d => [
  escapeHtml(d.name || ''),
  escapeHtml(formatCurrency(d.amount)),
  escapeHtml(d.reason || ''),
]))}` : ''}

${addedDeals.length > 0 ? `${sectionHeader('Deals Added to Forecast', BRAND.success)}
${buildTable(['Deal', 'Amount', 'Stage'], addedDeals.map(d => [
  escapeHtml(d.name || ''),
  escapeHtml(formatCurrency(d.amount)),
  escapeHtml(d.stage || ''),
]))}` : ''}

${commitDeals.length > 0 ? `${sectionHeader('Current Commit Deals', BRAND.primary)}
${buildTable(['Deal', 'Amount', 'Close Date', 'Confidence'], commitDeals.map(d => [
  escapeHtml(d.name || ''),
  escapeHtml(formatCurrency(d.amount)),
  escapeHtml(d.closeDate || ''),
  escapeHtml(d.confidence != null ? formatPercent(d.confidence) : ''),
]))}` : ''}

${notes ? `${sectionHeader('Notes', BRAND.muted)}<p style="font-size:13px;">${escapeHtml(notes)}</p>` : ''}
`;

  return baseLayout(
    `Forecast Drift Alert - ${period}`,
    `Forecast ${driftDirection === 'down' ? 'dropped' : 'improved'} ${formatPercent(Math.abs(driftPercent))} for ${period}`,
    body,
  );
}


// ---------------------------------------------------------------------------
// Template: Rep Coaching Alert
// ---------------------------------------------------------------------------

export function repCoachingHTML(data = {}) {
  const {
    repName = '',
    coachingPriority = 'Medium',
    scorecard = {},
    strengths = [],
    issues = [],
    dealsAtRisk = [],
    coachingFocus = [],
    talkingPoints = [],
  } = data;

  const sc = scorecard;

  const scorecardRows = [
    ['Activity Level', sc.activityLevel, sc.activityTarget],
    ['Pipeline Value', formatCurrency(sc.pipelineValue), formatCurrency(sc.pipelineTarget)],
    ['Win Rate', formatPercent(sc.winRate), formatPercent(sc.winRateTarget)],
    ['Forecast Reliability', sc.forecastReliability || 'N/A', ''],
    ['Stalled Deals', sc.stalledDeals ?? 'N/A', ''],
    ['Avg Deal Cycle', sc.avgDealCycle != null ? sc.avgDealCycle + ' days' : 'N/A', ''],
  ].map(r => r.map(v => escapeHtml(String(v ?? ''))));

  const body = `
<div style="text-align:center;margin-bottom:24px;">
  ${badge(`Coaching Priority: ${coachingPriority}`, healthColor(coachingPriority))}
</div>

${sectionHeader(`Rep Scorecard: ${repName}`, BRAND.primary)}
${buildTable(['Metric', 'Current', 'Target'], scorecardRows)}

${sectionHeader('Strengths', BRAND.success)}
${bulletList(strengths, '&#10003;')}

${sectionHeader('Issues to Address', BRAND.danger)}
${bulletList(issues, '&#9888;')}

${dealsAtRisk.length > 0 ? `${sectionHeader('Deals at Risk', BRAND.warning)}
${buildTable(['Deal', 'Amount', 'Days Stalled', 'Issue'], dealsAtRisk.map(d => [
  escapeHtml(d.name || ''),
  escapeHtml(formatCurrency(d.amount)),
  escapeHtml(String(d.daysStalled ?? '')),
  escapeHtml(d.issue || ''),
]))}` : ''}

${sectionHeader('Coaching Focus Areas', BRAND.accent)}
${coachingFocus.length > 0
    ? coachingFocus.map((f, i) => `<div style="padding:8px 12px;margin-bottom:6px;background:${BRAND.bg};border-radius:4px;font-size:13px;border-left:3px solid ${BRAND.accent};"><strong>${i + 1}.</strong> ${escapeHtml(f)}</div>`).join('')
    : `<p style="color:${BRAND.muted};font-size:13px;">No specific focus areas.</p>`}

${talkingPoints.length > 0 ? `${sectionHeader('1:1 Talking Points', BRAND.info)}
${bulletList(talkingPoints, '&#8226;')}` : ''}
`;

  return baseLayout(
    `Coaching Alert - ${repName}`,
    `Coaching needed for ${repName} - Priority: ${coachingPriority}`,
    body,
  );
}


// ---------------------------------------------------------------------------
// Template: Opportunity Acceleration
// ---------------------------------------------------------------------------

export function opportunityAccelerationHTML(data = {}) {
  const {
    dealName = '',
    amount = 0,
    stage = '',
    owner = '',
    momentum = '',
    signals = [],
    suggestedActions = [],
    closeDate = '',
    daysInPipeline = 0,
  } = data;

  const body = `
<div style="text-align:center;margin-bottom:24px;">
  ${badge('Positive Momentum', BRAND.success)}
</div>

${sectionHeader('Deal Snapshot', BRAND.success)}
${buildTable(['Field', 'Value'], [
  ['Deal', escapeHtml(dealName)],
  ['Amount', escapeHtml(formatCurrency(amount))],
  ['Stage', escapeHtml(stage)],
  ['Owner', escapeHtml(owner)],
  ['Close Date', escapeHtml(closeDate || 'Not set')],
  ['Days in Pipeline', escapeHtml(String(daysInPipeline))],
])}

${momentum ? `${sectionHeader('Momentum Summary', BRAND.info)}<p style="font-size:13px;">${escapeHtml(momentum)}</p>` : ''}

${sectionHeader('Positive Signals Detected', BRAND.success)}
${bulletList(signals, '&#9650;')}

${sectionHeader('Suggested Actions to Accelerate', BRAND.accent)}
${suggestedActions.length > 0
    ? suggestedActions.map((a, i) => `<div style="padding:8px 12px;margin-bottom:6px;background:#f0faf4;border-radius:4px;font-size:13px;border-left:3px solid ${BRAND.success};"><strong>${i + 1}.</strong> ${escapeHtml(a)}</div>`).join('')
    : `<p style="color:${BRAND.muted};font-size:13px;">No specific actions.</p>`}
`;

  return baseLayout(
    `Opportunity Acceleration - ${dealName}`,
    `${dealName} (${formatCurrency(amount)}) is showing positive momentum`,
    body,
  );
}


// ---------------------------------------------------------------------------
// Template: Weekly Forecast Memo
// ---------------------------------------------------------------------------

export function weeklyForecastHTML(data = {}) {
  const {
    weekOf = '',
    quarter = '',
    target = 0,
    attainment = 0,
    commit = 0,
    bestCase = 0,
    upside = 0,
    pipelineCoverage = 0,
    confidence = 0,
    weekOverWeekChange = 0,
    repForecasts = [],
    stageDistribution = [],
    keyMovements = [],
    risksToForecast = [],
    upsideOpportunities = [],
    outlook = '',
  } = data;

  const gapToTarget = target - attainment;
  const remaining = target > 0 ? formatPercent(((target - attainment) / target) * 100) : '0%';

  const body = `
<p style="font-size:15px;color:${BRAND.text};margin:0 0 20px;">Weekly forecast summary for <strong>${escapeHtml(weekOf)}</strong> &mdash; ${escapeHtml(quarter)}</p>

${sectionHeader('Quarter Overview', BRAND.primary)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${kpiCard('Target', formatCurrency(target), '', BRAND.primary)}
${kpiCard('Attainment', formatCurrency(attainment), formatPercent(target > 0 ? (attainment / target) * 100 : 0), BRAND.info)}
${kpiCard('Gap', formatCurrency(gapToTarget), `${remaining} remaining`, gapToTarget > 0 ? BRAND.warning : BRAND.success)}
</tr><tr>
${kpiCard('Commit', formatCurrency(commit), '', BRAND.primary)}
${kpiCard('Best Case', formatCurrency(bestCase), '', BRAND.info)}
${kpiCard('Upside', formatCurrency(upside), '', BRAND.success)}
</tr><tr>
${kpiCard('Coverage', pipelineCoverage + 'x', '', pipelineCoverage >= 3 ? BRAND.success : BRAND.danger)}
${kpiCard('Confidence', formatPercent(confidence), '', confidence >= 70 ? BRAND.success : BRAND.warning)}
${kpiCard('WoW Change', (weekOverWeekChange >= 0 ? '+' : '') + formatPercent(weekOverWeekChange), '', weekOverWeekChange >= 0 ? BRAND.success : BRAND.danger)}
</tr></table>

${repForecasts.length > 0 ? `${sectionHeader('Rep-Level Forecast', BRAND.primary)}
${buildTable(['Rep', 'Commit', 'Best Case', 'Upside', 'Confidence'], repForecasts.map(r => [
  escapeHtml(r.name || ''),
  escapeHtml(formatCurrency(r.commit)),
  escapeHtml(formatCurrency(r.bestCase)),
  escapeHtml(formatCurrency(r.upside)),
  badge(r.confidence != null ? formatPercent(r.confidence) : 'N/A', r.confidence >= 70 ? BRAND.success : BRAND.warning),
]))}` : ''}

${stageDistribution.length > 0 ? `${sectionHeader('Stage Distribution', BRAND.info)}
${buildTable(['Stage', 'Count', 'Value', 'Weighted'], stageDistribution.map(s => [
  escapeHtml(s.stage || ''),
  escapeHtml(String(s.count ?? '')),
  escapeHtml(formatCurrency(s.value)),
  escapeHtml(formatCurrency(s.weighted)),
]))}` : ''}

${keyMovements.length > 0 ? `${sectionHeader('Key Movements This Week', BRAND.info)}
${bulletList(keyMovements, '&#8594;')}` : ''}

${risksToForecast.length > 0 ? `${sectionHeader('Risks to Forecast', BRAND.danger)}
${bulletList(risksToForecast, '&#9888;')}` : ''}

${upsideOpportunities.length > 0 ? `${sectionHeader('Upside Opportunities', BRAND.success)}
${bulletList(upsideOpportunities, '&#9650;')}` : ''}

${outlook ? `${sectionHeader('Outlook', BRAND.primary)}<p style="font-size:13px;">${escapeHtml(outlook)}</p>` : ''}
`;

  return baseLayout(
    `Weekly Forecast Memo - ${weekOf}`,
    `Forecast for ${weekOf}: Commit ${formatCurrency(commit)}, Confidence ${formatPercent(confidence)}`,
    body,
  );
}
