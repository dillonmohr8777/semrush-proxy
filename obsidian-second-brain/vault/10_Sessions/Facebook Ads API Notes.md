# Facebook Ads API Notes

## API Overview
The Meta Marketing API provides programmatic access to ad accounts, campaigns, ad sets, ads, creative, pixels, audiences, and reporting.

## Authentication
- **Access Token**: Required for all API calls
- Generated at: https://developers.facebook.com/tools/explorer/
- Short-lived tokens expire in ~1 hour
- Long-lived tokens last ~60 days (extend at developers.facebook.com/tools/accesstoken/)
- System User tokens are permanent (requires Business Manager admin)

## Key Endpoints

### Account
- `GET /{ad-account-id}` → account info, balance, spend
- `GET /{ad-account-id}/campaigns` → list campaigns
- `GET /{ad-account-id}/insights` → account-level performance

### Campaigns
- `GET /{campaign-id}` → campaign details
- `GET /{campaign-id}/insights` → campaign performance
- `GET /{campaign-id}/adsets` → ad sets in campaign

### Ad Sets
- `GET /{adset-id}` → ad set details + targeting
- `GET /{adset-id}/insights` → ad set performance
- `GET /{adset-id}/ads` → ads in ad set

### Ads
- `GET /{ad-id}` → ad details
- `GET /{ad-id}/insights` → ad performance
- `GET /{ad-id}/creative` → creative details

### Pixel
- `GET /{ad-account-id}/adspixels` → list pixels
- `GET /{pixel-id}/stats` → pixel firing stats

### Audiences
- `GET /{ad-account-id}/customaudiences` → custom audiences
- `GET /search?type=adinterest&q=` → targeting search

## Key Fields for Insights
```
impressions, clicks, spend, cpc, cpm, ctr, reach, frequency,
actions, cost_per_action_type, conversions, conversion_values,
purchase_roas
```

## Date Presets
```
last_7d, last_14d, last_30d, last_90d,
this_month, last_month, this_year
```

## Breakdowns
```
age, gender, country, region, publisher_platform,
platform_position, device_platform
```

## Rate Limits
- Standard: 200 calls per hour per ad account
- Batch requests supported (up to 50 per batch)
- Use fields parameter to reduce calls (pull everything in one request)

## Special Ad Categories
Required for:
- **Housing** (real estate - Jeff Hozias)
- **Credit** (financial services)
- **Employment** (job ads)

Restrictions when SAC is enabled:
- No age targeting
- No gender targeting
- No zip code targeting
- Minimum 15-mile radius for location targeting

## Our MCP Server Tools (16)
1. get_ad_account
2. list_campaigns
3. campaign_insights
4. list_ad_sets
5. ad_set_insights
6. list_ads
7. ad_insights
8. get_ad_creative
9. get_pixels
10. get_pixel_install_code
11. get_pixel_stats
12. account_insights
13. demographics_breakdown
14. placement_breakdown
15. search_targeting
16. list_custom_audiences

## Client Ad Account IDs
| Client | Ad Account ID | Pixel ID |
|--------|--------------|----------|
| Buzz Bull | [FILL IN] | [FILL IN] |
| Florecita | [FILL IN] | [FILL IN] |
| Jeff Hozias | [FILL IN] | [FILL IN] |
| NKCDC | [FILL IN] | [FILL IN] |
