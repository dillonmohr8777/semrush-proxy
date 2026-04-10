# Skill: Optimize Google Ads

## When to use
When asked to fix, optimize, or improve a Google Ads account or campaign.

## Steps

1. **Read Memory File** - Load context via `read_memory_file`
2. **Search Obsidian** - Check for previous audit findings and patterns for this client
3. **Conversion Tracking Check**
   - `conversion_actions` - verify all tracking is set up and firing
   - Flag: actions with 0 conversions, missing tracking types (calls, forms, purchases)
   - Check for duplicate conversion actions
   - Verify conversion counting (one vs every) matches business type
4. **Campaign Health**
   - `list_campaigns` - review all campaigns
   - `campaign_performance` for last 30 days on each active campaign
   - Flag: campaigns with spend but no conversions, declining CTR trends, budget pacing issues
5. **Search Term Analysis**
   - `search_terms` for top-spend campaigns
   - Identify: irrelevant terms, high-cost zero-conversion terms, brand term waste
   - Build negative keyword recommendations
   - Identify new keyword opportunities from converting terms
6. **Quality Score Audit**
   - `keyword_performance` for each campaign
   - Flag keywords with QS below 5
   - Check: ad relevance, landing page experience, expected CTR
   - Identify which keywords need new ad copy vs new landing pages
7. **Ad Copy Review**
   - `ad_performance` for each campaign
   - Check for disapproved ads
   - Compare CTR across ads in same ad group
   - Flag weak ads (low CTR, low conversions)
8. **Geographic Analysis**
   - `location_performance` for service-area businesses
   - Flag locations with high spend and no conversions
   - Recommend geographic bid adjustments or exclusions
9. **Build Optimization Plan**
   Priority order:
   1. Fix broken conversion tracking (nothing else matters without this)
   2. Add negative keywords (stop waste immediately)
   3. Pause underperforming locations
   4. Improve ad copy for low-QS keywords
   5. Build/improve landing pages for high-value keywords
   6. Adjust budgets toward converting campaigns
10. **Report and Recommendations**
    - Draft specific changes with expected impact
    - Route to Slack for approval (V1 mode - no live changes)
    - Update client note in Obsidian
    - Log patterns to Memory File
11. **Log** - Call `log_session`
