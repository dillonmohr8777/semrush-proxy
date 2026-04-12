# Vault Folder Structure

```
Mohr Media Second Brain/
├── 00-Inbox/
├── 01-Daily/
├── 02-Weekly/
├── 03-Quarterly/
├── 10-Clients/
│   └── <client-slug>/
│       ├── profile.md
│       ├── calls/
│       ├── assets/
│       ├── experiments/
│       └── runbooks/
├── 20-Offers/
│   └── <offer-slug>/
│       ├── canvas.md
│       ├── pricing.md
│       ├── proof/
│       └── versions/
├── 30-ICPs/
├── 40-Channels/
│   ├── cold-email/
│   ├── linkedin/
│   ├── paid-meta/
│   ├── paid-google/
│   ├── paid-linkedin/
│   ├── youtube/
│   ├── tiktok/
│   ├── x/
│   └── owned-blog/
├── 50-Experiments/
├── 60-Insights/
├── 70-Playbooks/
├── 80-People/
├── 90-Competitors/
├── 95-Tools/
└── 99-Meta/
    ├── MOCs/
    ├── Templates/
    ├── Improvements/
    └── Wiki-Log/
```

## Folder rules

- `00-Inbox/` is the only folder you drop raw captures into. Nothing stays here longer than 7 days.
- Numbered top level folders never rename. They are the stable IDs.
- Client, offer, ICP, channel folders always use lowercase slugs.
- Templates live only in `99-Meta/Templates/`.
