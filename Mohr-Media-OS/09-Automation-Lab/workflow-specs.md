# Workflow Specs

Every automation in the roadmap has a spec before it ships. This is the template and two worked examples.

## Workflow spec template

```
# Workflow: {{name}}

ID: {{automation_id}}
Owner: {{agent}}
Status: draft | queued | shipped | retired
Last updated: {{date}}

## Trigger
What fires this.

## Inputs
Named fields with types.

## Steps
1.
2.
3.

## Outputs
Named fields with destinations.

## Success criteria
How we know it worked.

## Failure modes
| Symptom | Likely cause | Recovery |

## Kill switch
Exact action to stop.

## Logs
Where runs are logged.

## Runbook link
```

## Worked example 1: Long form to short form splitter

```
# Workflow: Long form to short form splitter

ID: AUTO-04
Owner: content-machine
Status: queued

## Trigger
Long form piece tagged `status/approved` in the content folder.

## Inputs
- long_form_path
- brand_voice_reference
- distribution_channels

## Steps
1. Read long form content
2. Run prompt CP-05 with the content
3. Produce 5 social posts and 1 thread
4. Save each to `06-Content-Engine/drafts/short-form/<parent-slug>/`
5. Create calendar slots in `calendar.md`
6. Notify content-machine owner

## Outputs
- 5 short form posts
- 1 thread
- Calendar entries
- Vault ingest note

## Success criteria
- 6 assets generated
- 6 calendar slots created
- Ingest note exists in vault

## Failure modes
| Prompt failure | CP-05 returns error | Retry once, escalate to orchestrator |
| Voice mismatch | Humanizer skipped | Re run CP-04 |

## Kill switch
Disable trigger in automation runtime.

## Logs
`99-Meta/Wiki-Log/automation-AUTO-04.md`
```

## Worked example 2: Weekly report generator

```
# Workflow: Weekly report generator

ID: AUTO-10
Owner: execution-engine
Status: queued

## Trigger
Cron every Friday at 14:00 client local.

## Inputs
- client_slug
- sprint_week_number
- metrics_source

## Steps
1. Pull metrics for the week
2. Pull shipped items from sprint tracker
3. Pull blockers from client channel
4. Run prompt DP-04 with the inputs
5. Save to `clients/<slug>/reports/week-<n>.md`
6. Open draft for execution-engine review
7. On approval, send to client and ingest to vault

## Outputs
- Weekly report file
- Client email draft
- Vault ingest note

## Success criteria
- Report file exists
- Client email delivered before 17:00 client local
- Vault ingest note exists

## Failure modes
| Missing metrics | Data source down | Use last cached values, flag in report |
| Approval not received | Owner offline | Auto send draft with "pending review" notice |

## Kill switch
Disable cron in automation runtime.

## Logs
`99-Meta/Wiki-Log/automation-AUTO-10.md`
```
