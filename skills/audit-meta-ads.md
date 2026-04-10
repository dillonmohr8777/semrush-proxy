# Skill: Audit Meta Ads

## When to use
When asked to audit, review, or analyze a client's Meta (Facebook/Instagram) ad account.

## Steps

1. **Read Memory File** - Load context via `read_memory_file`
2. **Search Obsidian** - Check for previous Meta audit notes on this client
3. **Account Overview**
   - `get_ad_account` for account status, spend, balance
   - `account_insights` for last 30 days performance summary
4. **Campaign Review**
   - `list_campaigns` to see all campaigns and their status
   - `campaign_insights` on each active campaign
   - Flag: campaigns spending with no conversions, high frequency (ad fatigue), low CTR
5. **Ad Set Analysis**
   - `list_ad_sets` for highest-spend campaigns
   - `ad_set_insights` to compare ad sets
   - Review targeting for relevance
   - Flag: overlapping audiences, broad targeting without results, exhausted audiences
6. **Creative Review**
   - `list_ads` for active ad sets
   - `get_ad_creative` to review copy, images, CTAs
   - Flag: stale creative (running too long), weak CTAs, image/copy mismatch
7. **Audience Analysis**
   - `demographics_breakdown` to see which age/gender converts
   - `placement_breakdown` to see where ads perform (Feed vs Stories vs Reels)
   - `list_custom_audiences` to check retargeting setup
8. **Pixel Check**
   - `get_pixels` to confirm pixel exists
   - `get_pixel_stats` to check if it's firing
   - Flag: no pixel, pixel not firing, missing events
9. **Cross-Reference**
   - Compare Meta performance with Google Ads (if both running)
   - Check if landing pages match ad creative and intent
10. **Report**
    - Update client note in Obsidian
    - `send_client_report` via Slack
    - Log patterns to Memory File
11. **Log** - Call `log_session`
