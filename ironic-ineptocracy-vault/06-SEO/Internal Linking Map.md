# Internal Linking Map

> How pages connect to each other. Claude maintains and updates this.

## Link Architecture

```
Homepage
├── /the-book → Characters, Themes, Excerpt, Buy
├── /characters → Individual character pages → Themes, Book
├── /themes → Individual theme pages → Blog posts, Book
├── /blog → All posts → Pillars, Characters, Themes
├── /about → Book, Blog, Press
├── /excerpt → Book, Buy, Signup
└── /press → Book, About, Reviews
```

## Page-to-Page Links

| From Page | Links To | Anchor Text Suggestion |
|-----------|----------|----------------------|
| Homepage | /the-book | "Explore the novel" |
| Homepage | /characters | "Meet the characters" |
| Homepage | /excerpt | "Read the first chapter" |
| Each character page | /the-book | "Read the full story" |
| Each character page | Related character pages | "[Character name]" |
| Each theme page | /the-book | Book title |
| Each theme page | Related blog posts | Blog post title |
| Each blog post | Relevant pillar page | Topic phrase |
| Each blog post | /the-book or /buy | CTA anchor |

## Orphan Pages
> Pages with no internal links pointing to them (fix these)

- 

## Link Maintenance Log
| Date | Action | Pages Affected |
|------|--------|---------------|
| | | |
