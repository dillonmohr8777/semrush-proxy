import hubspot from '@hubspot/api-client';
import config from '../config.js';

const BASE_DEAL_PROPERTIES = [
  'dealname',
  'amount',
  'dealstage',
  'closedate',
  'hubspot_owner_id',
  'hs_lastmodifieddate',
  'pipeline',
  'notes_last_updated',
  'hs_deal_stage_probability',
];

const WRITEBACK_PROPERTIES = [
  'deal_health_status',
  'forecast_risk_level',
  'days_since_last_activity',
  'leadership_attention_needed',
  'agent_recommended_action',
  'deal_summary_snapshot',
  'close_confidence_score',
];

const ASSOCIATION_TYPES = ['contacts', 'companies', 'notes', 'tasks', 'meetings', 'calls', 'emails'];

const ENGAGEMENT_TYPES = ['notes', 'tasks', 'meetings', 'calls', 'emails'];

export class HubSpotClient {
  constructor() {
    this.client = new hubspot.Client({
      accessToken: config.hubspot.accessToken,
    });
    this.customPropertyNames = (config.customProperties?.deal || []).map((p) => p.name);
  }

  /**
   * Returns the full list of deal properties to request from HubSpot,
   * combining base properties with any custom properties from config.
   */
  _getDealProperties() {
    return [...BASE_DEAL_PROPERTIES, ...this.customPropertyNames];
  }

  // ---------------------------------------------------------------------------
  // Deals
  // ---------------------------------------------------------------------------

  /**
   * Fetches all deals with standard + custom properties. Handles pagination
   * automatically, returning every deal in the portal.
   *
   * @param {object} [options]
   * @param {number} [options.limit=100] - Page size (max 100 per HubSpot API).
   * @param {string} [options.after]     - Pagination cursor for resuming.
   * @returns {Promise<object[]>} Array of deal objects.
   */
  async getDeals(options = {}) {
    const { limit = 100, after } = options;
    const properties = this._getDealProperties();
    const allDeals = [];
    let nextAfter = after;

    try {
      do {
        const response = await this.client.crm.deals.basicApi.getPage(
          limit,
          nextAfter,
          properties,
          undefined, // propertiesWithHistory
          undefined, // associations
          false       // archived
        );

        if (response.results) {
          allDeals.push(...response.results);
        }

        nextAfter = response.paging?.next?.after ?? null;
      } while (nextAfter);

      return allDeals;
    } catch (error) {
      console.error('[HubSpot] Failed to fetch deals:', error.message);
      throw error;
    }
  }

  /**
   * Fetches a single deal by ID with all associations (contacts, companies,
   * notes, tasks, meetings, calls, emails).
   *
   * @param {string} dealId
   * @returns {Promise<object>} Deal object with populated associations.
   */
  async getDealById(dealId) {
    try {
      const properties = this._getDealProperties();

      const response = await this.client.crm.deals.basicApi.getById(
        dealId,
        properties,
        undefined, // propertiesWithHistory
        ASSOCIATION_TYPES
      );

      return response;
    } catch (error) {
      console.error(`[HubSpot] Failed to fetch deal ${dealId}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetches all engagement activities (notes, tasks, meetings, calls, emails)
   * associated with a deal.
   *
   * @param {string} dealId
   * @returns {Promise<object>} Keyed by engagement type, each value an array.
   */
  async getDealActivities(dealId) {
    const activities = {};

    for (const type of ENGAGEMENT_TYPES) {
      try {
        const response = await this.client.crm.deals.associationsApi.getAll(
          dealId,
          type
        );
        const associatedIds = (response.results || []).map((a) => a.id);

        if (associatedIds.length === 0) {
          activities[type] = [];
          continue;
        }

        const details = await this._batchReadObjects(type, associatedIds);
        activities[type] = details;
      } catch (error) {
        console.error(`[HubSpot] Failed to fetch ${type} for deal ${dealId}:`, error.message);
        activities[type] = [];
      }
    }

    return activities;
  }

  /**
   * Batch-reads objects by type and IDs using the appropriate HubSpot API
   * endpoint for each engagement type.
   *
   * @param {string} objectType - One of notes, tasks, meetings, calls, emails.
   * @param {string[]} ids
   * @returns {Promise<object[]>}
   */
  async _batchReadObjects(objectType, ids) {
    const PROPERTIES_BY_TYPE = {
      notes: ['hs_note_body', 'hs_timestamp', 'hubspot_owner_id'],
      tasks: ['hs_task_body', 'hs_task_subject', 'hs_task_status', 'hs_task_priority', 'hs_timestamp', 'hs_task_due_date', 'hubspot_owner_id'],
      meetings: ['hs_meeting_title', 'hs_meeting_body', 'hs_meeting_start_time', 'hs_meeting_end_time', 'hs_timestamp', 'hubspot_owner_id'],
      calls: ['hs_call_title', 'hs_call_body', 'hs_call_duration', 'hs_call_status', 'hs_timestamp', 'hubspot_owner_id'],
      emails: ['hs_email_subject', 'hs_email_text', 'hs_email_direction', 'hs_timestamp', 'hubspot_owner_id'],
    };

    const properties = PROPERTIES_BY_TYPE[objectType] || [];

    try {
      const inputs = ids.map((id) => ({ id }));
      const response = await this.client.crm.objects.batchApi.read(objectType, {
        inputs,
        properties,
      });

      return response.results || [];
    } catch (error) {
      console.error(`[HubSpot] Batch read failed for ${objectType}:`, error.message);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Owners
  // ---------------------------------------------------------------------------

  /**
   * Fetches all HubSpot owners (sales reps).
   *
   * @returns {Promise<object[]>}
   */
  async getOwners() {
    try {
      const response = await this.client.crm.owners.ownersApi.getPage();
      return response.results || [];
    } catch (error) {
      console.error('[HubSpot] Failed to fetch owners:', error.message);
      throw error;
    }
  }

  /**
   * Fetches all deals assigned to a specific owner.
   *
   * @param {string} ownerId - HubSpot owner ID.
   * @returns {Promise<object[]>}
   */
  async getOwnerDeals(ownerId) {
    const properties = this._getDealProperties();
    const allDeals = [];
    let nextAfter = null;

    try {
      do {
        const response = await this.client.crm.deals.searchApi.doSearch({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'hubspot_owner_id',
                  operator: 'EQ',
                  value: ownerId,
                },
              ],
            },
          ],
          properties,
          limit: 100,
          after: nextAfter || 0,
          sorts: [{ propertyName: 'closedate', direction: 'ASCENDING' }],
        });

        if (response.results) {
          allDeals.push(...response.results);
        }

        nextAfter = response.paging?.next?.after ?? null;
      } while (nextAfter);

      return allDeals;
    } catch (error) {
      console.error(`[HubSpot] Failed to fetch deals for owner ${ownerId}:`, error.message);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Write-back
  // ---------------------------------------------------------------------------

  /**
   * Updates agent-generated custom properties on a deal.
   *
   * @param {string} dealId
   * @param {object} properties - Key/value pairs restricted to WRITEBACK_PROPERTIES.
   * @returns {Promise<object>} Updated deal object.
   */
  async updateDealProperties(dealId, properties) {
    const sanitised = {};
    for (const key of WRITEBACK_PROPERTIES) {
      if (properties[key] !== undefined) {
        sanitised[key] = String(properties[key]);
      }
    }

    if (Object.keys(sanitised).length === 0) {
      console.warn('[HubSpot] No valid writeback properties supplied.');
      return null;
    }

    try {
      const response = await this.client.crm.deals.basicApi.update(dealId, {
        properties: sanitised,
      });
      return response;
    } catch (error) {
      console.error(`[HubSpot] Failed to update deal ${dealId}:`, error.message);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Task & Note creation
  // ---------------------------------------------------------------------------

  /**
   * Creates a task in HubSpot and associates it with a deal.
   *
   * @param {string} dealId
   * @param {string} title
   * @param {string} body
   * @param {string} dueDate  - ISO-8601 date string.
   * @param {string} ownerId  - HubSpot owner ID to assign the task.
   * @returns {Promise<object>} Created task object.
   */
  async createTask(dealId, title, body, dueDate, ownerId) {
    try {
      const taskResponse = await this.client.crm.objects.basicApi.create('tasks', {
        properties: {
          hs_task_subject: title,
          hs_task_body: body,
          hs_task_status: 'NOT_STARTED',
          hs_task_priority: 'MEDIUM',
          hs_task_due_date: dueDate,
          hubspot_owner_id: ownerId,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: dealId },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 216, // task-to-deal
              },
            ],
          },
        ],
      });

      return taskResponse;
    } catch (error) {
      console.error(`[HubSpot] Failed to create task for deal ${dealId}:`, error.message);
      throw error;
    }
  }

  /**
   * Creates a note and associates it with a deal.
   *
   * @param {string} dealId
   * @param {string} body - Note body (supports HTML).
   * @returns {Promise<object>} Created note object.
   */
  async createNote(dealId, body) {
    try {
      const noteResponse = await this.client.crm.objects.basicApi.create('notes', {
        properties: {
          hs_note_body: body,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: dealId },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 214, // note-to-deal
              },
            ],
          },
        ],
      });

      return noteResponse;
    } catch (error) {
      console.error(`[HubSpot] Failed to create note for deal ${dealId}:`, error.message);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Pipeline analytics
  // ---------------------------------------------------------------------------

  /**
   * Aggregates all active deals into a pipeline snapshot object.
   *
   * @returns {Promise<object>} Pipeline summary with totals, weighted values,
   *   stage distribution, deal count, and average deal size.
   */
  async getPipelineSummary() {
    try {
      const deals = await this.getDeals();

      const stages = config.dealStages || {};
      const stageDistribution = {};
      let totalPipeline = 0;
      let weightedPipeline = 0;
      let dealCount = 0;

      for (const deal of deals) {
        const props = deal.properties;
        const stage = props.dealstage;
        const amount = parseFloat(props.amount) || 0;
        const probability = stages[stage]?.probability
          ?? (parseFloat(props.hs_deal_stage_probability) / 100 || 0);

        // Skip closed-won / closed-lost from active pipeline totals
        if (stage === 'closed_won' || stage === 'closed_lost') {
          if (!stageDistribution[stage]) {
            stageDistribution[stage] = { count: 0, value: 0, weighted: 0, label: stages[stage]?.label || stage };
          }
          stageDistribution[stage].count += 1;
          stageDistribution[stage].value += amount;
          stageDistribution[stage].weighted += amount * probability;
          continue;
        }

        dealCount += 1;
        totalPipeline += amount;
        weightedPipeline += amount * probability;

        if (!stageDistribution[stage]) {
          stageDistribution[stage] = { count: 0, value: 0, weighted: 0, label: stages[stage]?.label || stage };
        }
        stageDistribution[stage].count += 1;
        stageDistribution[stage].value += amount;
        stageDistribution[stage].weighted += amount * probability;
      }

      return {
        generatedAt: new Date().toISOString(),
        totalPipeline,
        weightedPipeline,
        dealCount,
        avgDealSize: dealCount > 0 ? totalPipeline / dealCount : 0,
        stageDistribution,
      };
    } catch (error) {
      console.error('[HubSpot] Failed to generate pipeline summary:', error.message);
      throw error;
    }
  }

  /**
   * Finds deals with no meaningful activity in the last N days.
   *
   * @param {number} [days] - Inactivity threshold; defaults to config value.
   * @returns {Promise<object[]>} Array of stale deal objects.
   */
  async getStaleDeals(days) {
    const threshold = days ?? config.thresholds.staleDealDays;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - threshold);
    const cutoffISO = cutoff.toISOString();

    try {
      const allDeals = [];
      let nextAfter = null;

      do {
        const response = await this.client.crm.deals.searchApi.doSearch({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'notes_last_updated',
                  operator: 'LT',
                  value: cutoffISO,
                },
                {
                  propertyName: 'dealstage',
                  operator: 'NEQ',
                  value: 'closed_won',
                },
                {
                  propertyName: 'dealstage',
                  operator: 'NEQ',
                  value: 'closed_lost',
                },
              ],
            },
          ],
          properties: this._getDealProperties(),
          limit: 100,
          after: nextAfter || 0,
          sorts: [{ propertyName: 'notes_last_updated', direction: 'ASCENDING' }],
        });

        if (response.results) {
          allDeals.push(...response.results);
        }

        nextAfter = response.paging?.next?.after ?? null;
      } while (nextAfter);

      return allDeals;
    } catch (error) {
      console.error(`[HubSpot] Failed to fetch stale deals (>${threshold} days):`, error.message);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Custom property provisioning
  // ---------------------------------------------------------------------------

  /**
   * Creates the Revenue OS custom properties in HubSpot if they do not already
   * exist.  Reads property definitions from config.customProperties.
   */
  async createCustomProperties() {
    const propertyGroups = config.customProperties || {};

    for (const [objectType, properties] of Object.entries(propertyGroups)) {
      for (const propDef of properties) {
        try {
          await this._ensureProperty(objectType, propDef);
        } catch (error) {
          console.error(
            `[HubSpot] Failed to ensure property ${propDef.name} on ${objectType}:`,
            error.message
          );
        }
      }
    }
  }

  /**
   * Creates a single custom property if it does not exist.
   *
   * @param {string} objectType - "deal" or "contact".
   * @param {object} propDef    - Property definition from config.
   */
  async _ensureProperty(objectType, propDef) {
    const apiObjectType = objectType === 'deal' ? 'deals' : `${objectType}s`;

    // Check whether the property already exists
    try {
      await this.client.crm.properties.coreApi.getByName(apiObjectType, propDef.name);
      console.log(`[HubSpot] Property ${propDef.name} already exists on ${objectType}.`);
      return;
    } catch (error) {
      // 404 means it doesn't exist yet -- continue to create
      if (error.code !== 404 && error.statusCode !== 404) {
        throw error;
      }
    }

    const propertyCreate = {
      name: propDef.name,
      label: propDef.label,
      type: propDef.type === 'enumeration' ? 'enumeration' : propDef.type === 'number' ? 'number' : 'string',
      fieldType: _fieldTypeFor(propDef.type),
      groupName: 'revenue_os',
      description: `Revenue OS: ${propDef.label}`,
    };

    if (propDef.type === 'enumeration' && propDef.options) {
      propertyCreate.options = propDef.options.map((opt, idx) => ({
        label: opt,
        value: opt,
        displayOrder: idx,
        hidden: false,
      }));
    }

    try {
      // Ensure the property group exists first
      await this._ensurePropertyGroup(apiObjectType);

      await this.client.crm.properties.coreApi.create(apiObjectType, propertyCreate);
      console.log(`[HubSpot] Created property ${propDef.name} on ${objectType}.`);
    } catch (error) {
      console.error(`[HubSpot] Error creating property ${propDef.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Ensures the "revenue_os" property group exists on the given object type.
   *
   * @param {string} apiObjectType - e.g. "deals", "contacts".
   */
  async _ensurePropertyGroup(apiObjectType) {
    try {
      await this.client.crm.properties.groupsApi.getByName(apiObjectType, 'revenue_os');
    } catch (error) {
      if (error.code === 404 || error.statusCode === 404) {
        await this.client.crm.properties.groupsApi.create(apiObjectType, {
          name: 'revenue_os',
          label: 'Revenue OS',
          displayOrder: -1,
        });
        console.log(`[HubSpot] Created property group "revenue_os" on ${apiObjectType}.`);
      }
    }
  }
}

/**
 * Maps config property types to HubSpot field types.
 *
 * @param {string} type
 * @returns {string}
 */
function _fieldTypeFor(type) {
  switch (type) {
    case 'enumeration':
      return 'select';
    case 'number':
      return 'number';
    case 'string':
    default:
      return 'text';
  }
}

export default HubSpotClient;
