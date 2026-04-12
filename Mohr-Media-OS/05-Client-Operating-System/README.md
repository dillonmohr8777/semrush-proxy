# Client Operating System

Every client runs through the same repeatable shape. This folder is the blueprint.

## Files

- `client-profile-template.md`
- `kickoff-checklist.md`
- `weekly-report-template.md`
- `monthly-review-template.md`
- `offboarding.md`
- `retention-playbook.md`

## Client folder shape

```
clients/
└── <client-slug>/
    ├── profile.md
    ├── contract.md
    ├── delivery-spec.md
    ├── sprints/
    ├── reports/
    ├── assets/
    └── retro/
```

## Rules

- One folder per client, slug only, lowercase
- Contract lives in version control
- Every sprint has its own folder with plan, standups, demo, retro
- No client asset is produced outside the client folder
