const MEETING_TYPES = ['pipeline_review', 'rep_1on1', 'forecast_call', 'leadership', 'team'];

const SECTION_TEMPLATES = {
  pipeline_review: {
    expectDecisions: true,
    expectDealUpdates: true,
    expectActionItems: true,
    expectFollowUps: true,
    label: 'Pipeline Review',
  },
  rep_1on1: {
    expectDecisions: true,
    expectDealUpdates: true,
    expectActionItems: true,
    expectFollowUps: true,
    label: '1:1 Coaching Session',
  },
  forecast_call: {
    expectDecisions: true,
    expectDealUpdates: true,
    expectActionItems: true,
    expectFollowUps: true,
    label: 'Forecast Call',
  },
  leadership: {
    expectDecisions: true,
    expectDealUpdates: false,
    expectActionItems: true,
    expectFollowUps: true,
    label: 'Leadership Meeting',
  },
  team: {
    expectDecisions: false,
    expectDealUpdates: false,
    expectActionItems: true,
    expectFollowUps: true,
    label: 'Team Meeting',
  },
};

class MeetingSummaryAgent {
  constructor(options = {}) {
    this.defaultMeetingType = options.defaultMeetingType ?? 'team';
  }

  /**
   * Process raw meeting notes into a structured summary.
   *
   * @param {string} rawNotes     - Rough notes, bullet points, or free-text from the meeting.
   * @param {string} meetingType  - One of: pipeline_review, rep_1on1, forecast_call, leadership, team.
   * @returns {Object}
   */
  processMeeting(rawNotes, meetingType = this.defaultMeetingType) {
    if (!rawNotes || typeof rawNotes !== 'string' || rawNotes.trim().length === 0) {
      return this._emptyResult(meetingType);
    }

    const normalizedType = MEETING_TYPES.includes(meetingType) ? meetingType : this.defaultMeetingType;
    const template = SECTION_TEMPLATES[normalizedType] || SECTION_TEMPLATES.team;

    const lines = this._parseLines(rawNotes);
    const sections = this._classifyLines(lines, normalizedType);

    const cleanSummary = this._buildCleanSummary(sections, template);
    const decisions = this._extractDecisions(sections);
    const actionItems = this._extractActionItems(sections);
    const dealUpdates = template.expectDealUpdates ? this._extractDealUpdates(sections) : [];
    const followUps = this._extractFollowUps(sections, actionItems);

    return {
      meetingType: normalizedType,
      meetingTypeLabel: template.label,
      cleanSummary,
      decisions,
      actionItems,
      dealUpdates,
      followUps,
    };
  }

  // ─── Internal: Parsing ─────────────────────────────────────

  /**
   * Parse raw text into individual line objects, preserving structure.
   */
  _parseLines(rawNotes) {
    return rawNotes
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => ({
        raw: line,
        clean: this._cleanLine(line),
        isHeader: this._isHeader(line),
        isBullet: this._isBullet(line),
      }));
  }

  /**
   * Remove common bullet/list markers from a line.
   */
  _cleanLine(line) {
    return line
      .replace(/^[-*+•]\s*/, '')   // Bullet markers
      .replace(/^\d+[.)]\s*/, '')  // Numbered list markers
      .replace(/^#+\s*/, '')       // Markdown headers
      .replace(/^\[[ x]\]\s*/i, '') // Checkbox markers
      .trim();
  }

  _isHeader(line) {
    return /^#{1,3}\s/.test(line) || /^[A-Z][A-Z\s]{2,}:?\s*$/.test(line.trim());
  }

  _isBullet(line) {
    return /^[-*+•]\s/.test(line) || /^\d+[.)]\s/.test(line);
  }

  // ─── Internal: Classification ──────────────────────────────

  /**
   * Classify each line into a category based on keywords and context.
   */
  _classifyLines(lines, meetingType) {
    const sections = {
      discussion: [],
      decisions: [],
      actionItems: [],
      dealUpdates: [],
      followUps: [],
      general: [],
    };

    let currentSection = 'general';

    for (const line of lines) {
      // Check if this is a section header
      const detectedSection = this._detectSection(line.clean);
      if (detectedSection) {
        currentSection = detectedSection;
        continue; // Skip the header itself
      }

      // Classify by content keywords
      const classification = this._classifyByContent(line.clean, currentSection);
      sections[classification].push(line);
    }

    return sections;
  }

  /**
   * Detect if a line is a section header and return the section type.
   */
  _detectSection(text) {
    const lower = text.toLowerCase();

    if (/decision|decided|agreed/i.test(lower) && (text.length < 60 || /^(decision|decided|agreed)/i.test(lower))) {
      return 'decisions';
    }
    if (/action\s*item|todo|to-do|next\s*step|follow.?up\s*action/i.test(lower) && text.length < 60) {
      return 'actionItems';
    }
    if (/deal\s*(update|review|status)|pipeline\s*(update|review)/i.test(lower) && text.length < 60) {
      return 'dealUpdates';
    }
    if (/follow.?up|next\s*meeting|schedule/i.test(lower) && text.length < 60) {
      return 'followUps';
    }
    if (/discussion|agenda|topic|overview|update/i.test(lower) && text.length < 60) {
      return 'discussion';
    }

    return null;
  }

  /**
   * Classify a line by its content when no section header governs it.
   */
  _classifyByContent(text, currentSection) {
    const lower = text.toLowerCase();

    // Strong action item signals
    if (/\b(will|to|should|needs?\s+to|must|action|assign|owner|responsible)\b/i.test(lower) &&
        /\b(by|before|due|deadline|eow|eod|next\s+week|this\s+week|monday|tuesday|wednesday|thursday|friday)\b/i.test(lower)) {
      return 'actionItems';
    }

    // Decision signals
    if (/\b(decided|agreed|approved|confirmed|go\s+with|moving\s+forward|final|resolution)\b/i.test(lower)) {
      return 'decisions';
    }

    // Deal update signals
    if (/\$[\d,.]+[kmb]?\b/i.test(lower) || /\b(deal|opportunity|prospect|account|pipeline|stage|close\s*date)\b/i.test(lower)) {
      return 'dealUpdates';
    }

    // Follow-up signals
    if (/\b(follow\s*up|revisit|check\s+back|circle\s+back|sync\s+on|reconnect|next\s+meeting)\b/i.test(lower)) {
      return 'followUps';
    }

    // Default to current section context
    return currentSection === 'general' ? 'discussion' : currentSection;
  }

  // ─── Internal: Summary Building ────────────────────────────

  _buildCleanSummary(sections, template) {
    const parts = [];

    // Discussion points
    const discussion = [...sections.discussion, ...sections.general];
    if (discussion.length > 0) {
      parts.push(discussion.map(l => l.clean).join('. ').replace(/\.\./g, '.'));
    }

    // Deal updates summary
    if (template.expectDealUpdates && sections.dealUpdates.length > 0) {
      parts.push('Deal updates: ' + sections.dealUpdates.map(l => l.clean).join('; ') + '.');
    }

    // If we have nothing, say so
    if (parts.length === 0) {
      return 'Meeting notes were provided but no substantive discussion points could be extracted.';
    }

    // Join into a clean paragraph
    let summary = parts.join(' ');

    // Clean up punctuation
    summary = summary
      .replace(/\s+/g, ' ')
      .replace(/[.;,]\s*[.;,]/g, '.')
      .replace(/\s+\./g, '.')
      .trim();

    // Ensure it ends with a period
    if (summary && !summary.endsWith('.') && !summary.endsWith('!') && !summary.endsWith('?')) {
      summary += '.';
    }

    return summary;
  }

  // ─── Internal: Extraction ──────────────────────────────────

  _extractDecisions(sections) {
    return sections.decisions.map(line => ({
      decision: this._capitalizeFirst(line.clean),
    }));
  }

  _extractActionItems(sections) {
    return sections.actionItems.map(line => {
      const parsed = this._parseActionItem(line.clean);
      return {
        owner: parsed.owner,
        action: this._capitalizeFirst(parsed.action),
        dueDate: parsed.dueDate,
      };
    });
  }

  _extractDealUpdates(sections) {
    return sections.dealUpdates.map(line => ({
      update: this._capitalizeFirst(line.clean),
      amount: this._extractAmount(line.clean),
    }));
  }

  _extractFollowUps(sections, actionItems) {
    // Follow-ups that aren't already captured as action items
    const actionTexts = new Set(actionItems.map(a => a.action.toLowerCase()));

    return sections.followUps
      .filter(line => !actionTexts.has(line.clean.toLowerCase()))
      .map(line => ({
        item: this._capitalizeFirst(line.clean),
        dueDate: this._extractDate(line.clean),
      }));
  }

  // ─── Internal: Action Item Parsing ─────────────────────────

  /**
   * Parse an action item line to extract owner, action, and due date.
   */
  _parseActionItem(text) {
    let owner = null;
    let action = text;
    let dueDate = null;

    // Extract owner: look for patterns like "John:" or "@John" or "Owner: John"
    const ownerPatterns = [
      /^@(\w+[\w\s]*?)[\s:,-]+(.+)$/i,
      /^(\w+[\w\s]*?):\s*(.+)$/,
      /\b(?:owner|assigned?\s*to|responsible)\s*[:=]\s*(\w+[\w\s]*?)(?:\s*[-,;]\s*|\s+)(.+)/i,
      /(.+?)\s*\((\w+[\w\s]*?)\)\s*$/,  // "Do something (John)"
    ];

    for (const pattern of ownerPatterns) {
      const match = text.match(pattern);
      if (match) {
        // Determine which group is the owner vs action based on the pattern
        if (pattern === ownerPatterns[3]) {
          action = match[1].trim();
          owner = match[2].trim();
        } else {
          owner = match[1].trim();
          action = match[2].trim();
        }
        break;
      }
    }

    // Extract due date
    dueDate = this._extractDate(action);

    // Clean the action text of the date reference if we extracted one
    if (dueDate) {
      action = action
        .replace(/\b(?:by|before|due|deadline)\s+\w+\s*\d*\s*,?\s*\d*/i, '')
        .replace(/\b(?:eow|eod|end\s+of\s+(?:week|day))\b/i, '')
        .replace(/\b(?:this|next)\s+(?:monday|tuesday|wednesday|thursday|friday|week)\b/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return { owner, action: action || text, dueDate };
  }

  /**
   * Extract a date reference from text. Returns an ISO date string or a relative label.
   */
  _extractDate(text) {
    const lower = text.toLowerCase();

    // Explicit date patterns
    const dateMatch = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]);
      const day = parseInt(dateMatch[2]);
      const year = dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3]) : parseInt(dateMatch[3]);
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }

    // Relative dates
    const today = new Date();

    if (/\beod\b|end\s+of\s+day\b|today\b/i.test(lower)) {
      return today.toISOString().split('T')[0];
    }

    if (/\beow\b|end\s+of\s+week\b|this\s+friday\b/i.test(lower)) {
      const friday = new Date(today);
      const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
      friday.setDate(today.getDate() + daysUntilFriday);
      return friday.toISOString().split('T')[0];
    }

    if (/\bnext\s+week\b|next\s+monday\b/i.test(lower)) {
      const nextMonday = new Date(today);
      const daysUntilMonday = (1 - today.getDay() + 7) % 7 || 7;
      nextMonday.setDate(today.getDate() + daysUntilMonday);
      return nextMonday.toISOString().split('T')[0];
    }

    if (/\bthis\s+week\b/i.test(lower)) {
      const friday = new Date(today);
      const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
      friday.setDate(today.getDate() + daysUntilFriday);
      return friday.toISOString().split('T')[0];
    }

    if (/\btomorrow\b/i.test(lower)) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }

    // Named day of week
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < dayNames.length; i++) {
      const regex = new RegExp(`\\b(?:by|before|this|next)?\\s*${dayNames[i]}\\b`, 'i');
      if (regex.test(lower)) {
        const target = new Date(today);
        const daysUntil = (i - today.getDay() + 7) % 7 || 7;
        target.setDate(today.getDate() + daysUntil);
        return target.toISOString().split('T')[0];
      }
    }

    return null;
  }

  /**
   * Extract a dollar amount from text.
   */
  _extractAmount(text) {
    const match = text.match(/\$[\d,.]+\s*[kmb]?/i);
    if (!match) return null;

    let raw = match[0].replace(/[$,]/g, '');
    const suffix = raw.slice(-1).toLowerCase();
    const number = parseFloat(raw);

    if (isNaN(number)) return null;
    if (suffix === 'k') return number * 1000;
    if (suffix === 'm') return number * 1000000;
    if (suffix === 'b') return number * 1000000000;
    return number;
  }

  // ─── Internal: Utilities ───────────────────────────────────

  _capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  _emptyResult(meetingType) {
    const template = SECTION_TEMPLATES[meetingType] || SECTION_TEMPLATES.team;
    return {
      meetingType: meetingType || this.defaultMeetingType,
      meetingTypeLabel: template.label,
      cleanSummary: 'No meeting notes were provided.',
      decisions: [],
      actionItems: [],
      dealUpdates: [],
      followUps: [],
    };
  }
}

export default MeetingSummaryAgent;
