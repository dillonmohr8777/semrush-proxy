# Skill: Weekly Review

## When to use
When asked for a weekly review, weekly summary, or end-of-week report.

## Steps

1. **Read Memory File** - Load context via `read_memory_file`
2. **Pull Session History**
   - `list_notes` in `10_Sessions/` to find this week's session logs
   - Read each session log for the past 7 days
3. **Pull Open Actions**
   - `get_open_actions` across all clients
   - Flag anything overdue (older than 7 days)
4. **Per Client Review**
   For each active client:
   - Search Obsidian for recent notes and updates
   - `account_performance` from Google Ads (LAST_7_DAYS)
   - Note any changes, wins, or problems from the week
5. **Build Weekly Review**
   - Create from weekly-review template
   - Per client: status, key metrics, what changed, next actions
   - Wins this week
   - Problems found
   - Patterns noticed
   - Top 3 priorities for next week
6. **Save and Notify**
   - Save to `07_Daily_Notes/` as weekly review
   - `send_daily_summary` via Slack with the full overview
   - Update Memory File with any new patterns
7. **Log** - Call `log_session`
