# Skill: Process Transcript

## When to use
When raw meeting notes, call transcripts, or voice note dumps are provided.

## Steps

1. **Read Memory File** - Load context via `read_memory_file`
2. **Save Raw Transcript**
   - `process_transcript` with client name and raw text
3. **Extract Structure**
   - Read back the saved transcript
   - Pull out: summary, key points, decisions, action items, follow-ups
4. **Route Information**
   - Action items → Update client note under `## Next Actions`
   - Decisions → Update client note under `## Notes` with date prefix
   - Follow-ups → Add to client note
   - If any new service/offer discussed → Note in client overview
5. **Check For Urgency**
   - If anything needs immediate action → `send_urgent_alert` via Slack
   - If anything blocks other work → Flag it
6. **Check For Patterns**
   - If anything is a reusable learning → `update_memory_file`
   - If a new process emerges → Consider creating an SOP
7. **Notify**
   - `send_client_report` with transcript summary and action items
8. **Log** - Call `log_session`
