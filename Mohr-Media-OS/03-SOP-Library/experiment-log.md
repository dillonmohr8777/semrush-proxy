# SOP: Experiment Log

Owner: every agent, stored by memory-engine
Trigger: Any deliberate test with a hypothesis
Cadence: Per experiment
Inputs: Hypothesis, metric, duration, owner, variant details
Outputs: Experiment note, baseline, result, lesson, next action
Failure modes: No hypothesis, metric drift, untracked variant, no lesson logged

## Experiment entry template

```
# Experiment: <name>

Owner: <agent>
Start date: <date>
End date: <date>
Hypothesis: <one sentence>
Variable changed: <what>
Control: <what>
Metric: <primary>
Target movement: <n>
Duration: <days>

## Result
Baseline: <n>
Outcome: <n>
Movement: <n>
Statistical confidence or volume caveat: <text>

## Lesson
One sentence insight.

## Next action
Scale, kill, iterate, shelve.
```

## Steps

1. Draft hypothesis before any change
2. Write baseline into the note
3. Run the experiment for the full duration even if early data looks good or bad
4. Capture result
5. Write the one sentence lesson
6. Pick a next action
7. Link the experiment to the relevant MOC in the vault

## Hard rules

- No rolling scope changes mid experiment
- No declaring results before the end date
- No experiment without a metric
- No experiment without a lesson logged
