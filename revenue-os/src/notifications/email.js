// Revenue OS — Email Notification Service
// Sends formatted HTML emails via nodemailer for daily briefs, alerts, and forecasts.

import nodemailer from 'nodemailer';
import config from '../config.js';
import {
  dailyBriefHTML,
  dealRiskHTML,
  forecastDriftHTML,
  repCoachingHTML,
  opportunityAccelerationHTML,
  weeklyForecastHTML,
} from './templates.js';

const ALERT_SUBJECTS = {
  deal_risk: (data) => `[Risk Alert] ${data.dealName || 'Deal'} — ${data.healthStatus || 'At Risk'}`,
  forecast_drift: (data) => `[Forecast] Drift detected — ${data.period || 'Current Period'}`,
  rep_coaching: (data) => `[Coaching] ${data.repName || 'Rep'} — Priority: ${data.coachingPriority || 'Medium'}`,
  opportunity_acceleration: (data) => `[Opportunity] ${data.dealName || 'Deal'} showing positive momentum`,
};

const ALERT_TEMPLATES = {
  deal_risk: dealRiskHTML,
  forecast_drift: forecastDriftHTML,
  rep_coaching: repCoachingHTML,
  opportunity_acceleration: opportunityAccelerationHTML,
};

class EmailNotifier {
  constructor() {
    this.transporter = null;
    this._initialized = false;
  }

  /**
   * Lazily initializes the nodemailer transporter on first use.
   * Validates that required SMTP credentials are present.
   */
  _ensureTransporter() {
    if (this._initialized) return;

    const { host, port, user, pass } = config.email;

    if (!user || !pass) {
      console.warn('[EmailNotifier] SMTP credentials not configured — emails will be skipped.');
      this._initialized = true;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    this._initialized = true;
  }

  // ---------------------------------------------------------------------------
  // Core send method
  // ---------------------------------------------------------------------------

  /**
   * Sends an email notification.
   *
   * @param {string} subject   — Email subject line.
   * @param {string} htmlBody  — Full HTML body content.
   * @param {object} [options] — Optional overrides.
   * @param {string} [options.to]   — Recipient (defaults to config).
   * @param {string} [options.from] — Sender (defaults to config).
   * @param {string} [options.cc]   — CC recipients.
   * @param {string} [options.bcc]  — BCC recipients.
   * @param {string} [options.replyTo] — Reply-to address.
   * @returns {Promise<object|null>} Nodemailer send result or null if skipped.
   */
  async send(subject, htmlBody, options = {}) {
    this._ensureTransporter();

    if (!this.transporter) {
      console.warn(`[EmailNotifier] Skipping email "${subject}" — no transporter configured.`);
      return null;
    }

    const to = options.to || config.email.to;
    if (!to) {
      console.warn(`[EmailNotifier] Skipping email "${subject}" — no recipient configured.`);
      return null;
    }

    const mailOptions = {
      from: options.from || config.email.from,
      to,
      subject,
      html: htmlBody,
    };

    if (options.cc) mailOptions.cc = options.cc;
    if (options.bcc) mailOptions.bcc = options.bcc;
    if (options.replyTo) mailOptions.replyTo = options.replyTo;

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailNotifier] Sent: "${subject}" -> ${to} (messageId: ${result.messageId})`);
      return result;
    } catch (error) {
      console.error(`[EmailNotifier] Failed to send "${subject}":`, error.message);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Daily executive brief
  // ---------------------------------------------------------------------------

  /**
   * Formats and sends the daily executive brief as a clean HTML email.
   * Sections: Pipeline Health, Top 3 Priorities, Top 3 Risks,
   * Key Opportunities, Rep Signals, Recommended Focus.
   *
   * @param {object} briefData — Structured brief data matching the dailyBriefHTML schema.
   * @param {object} [options] — Optional email overrides (to, cc, etc.).
   * @returns {Promise<object|null>}
   */
  async sendDailyBrief(briefData, options = {}) {
    const date = briefData.date || new Date().toISOString().slice(0, 10);
    const subject = `Revenue OS — Daily Executive Brief — ${date}`;
    const html = dailyBriefHTML(briefData);

    return this.send(subject, html, options);
  }

  // ---------------------------------------------------------------------------
  // Individual alert
  // ---------------------------------------------------------------------------

  /**
   * Sends an individual alert email for a specific alert type.
   *
   * @param {'deal_risk'|'forecast_drift'|'rep_coaching'|'opportunity_acceleration'} alertType
   * @param {object} alertData — Data matching the corresponding template schema.
   * @param {object} [options] — Optional email overrides.
   * @returns {Promise<object|null>}
   */
  async sendAlert(alertType, alertData, options = {}) {
    const subjectFn = ALERT_SUBJECTS[alertType];
    const templateFn = ALERT_TEMPLATES[alertType];

    if (!subjectFn || !templateFn) {
      console.error(`[EmailNotifier] Unknown alert type: "${alertType}"`);
      throw new Error(`Unknown alert type: "${alertType}"`);
    }

    const subject = subjectFn(alertData);
    const html = templateFn(alertData);

    return this.send(subject, html, options);
  }

  // ---------------------------------------------------------------------------
  // Weekly forecast memo
  // ---------------------------------------------------------------------------

  /**
   * Formats and sends the weekly forecast summary email.
   *
   * @param {object} forecastData — Structured forecast data matching weeklyForecastHTML schema.
   * @param {object} [options]    — Optional email overrides.
   * @returns {Promise<object|null>}
   */
  async sendWeeklyForecastMemo(forecastData, options = {}) {
    const weekOf = forecastData.weekOf || new Date().toISOString().slice(0, 10);
    const subject = `Revenue OS — Weekly Forecast Memo — ${weekOf}`;
    const html = weeklyForecastHTML(forecastData);

    return this.send(subject, html, options);
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Verifies the SMTP connection. Useful for health-checks on startup.
   *
   * @returns {Promise<boolean>}
   */
  async verify() {
    this._ensureTransporter();

    if (!this.transporter) {
      console.warn('[EmailNotifier] Cannot verify — no transporter configured.');
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('[EmailNotifier] SMTP connection verified.');
      return true;
    } catch (error) {
      console.error('[EmailNotifier] SMTP verification failed:', error.message);
      return false;
    }
  }
}

export default EmailNotifier;
