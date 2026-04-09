# Skill: Daily Summary

## When to use
When asked for a morning briefing, daily summary, or "what's going on today."

## Steps

1. **Read Memory File** - Load context via `read_memory_file`
2. **Create/Get Daily Note**
   - `daily_note` for today
3. **Pull Open Actions**
   - `get_open_actions` across all clients
   - Sort by urgency
4. **Quick Health Check Per Client**
   For each active client:
   - `account_performance` from Google Ads (LAST_7_DAYS) - just the trend
   - Note anything that moved significantly (spend spikes, conversion drops, CTR changes)
5. **Check For Issues**
   - Any disapproved ads?
   - Any conversion tracking gaps?
   - Any budget pacing issues?
6. **Build Summary**
   - What needs attention today
   - Open tasks ranked by priority
   - Any alerts or flags
   - Quick wins available
7. **Notify**
   - `send_daily_summary` via Slack
   - Update today's daily note in Obsidian
8. **Log** - Call `log_session`
