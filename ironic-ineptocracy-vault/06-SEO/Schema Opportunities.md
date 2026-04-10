# Schema Opportunities

> Structured data that helps Google understand and feature the book.

## Book Schema (Priority 1)
- Page: Homepage or /the-book
- Type: `Book`
- Properties: name, author, genre, description, isbn, datePublished, publisher, image, url
- Status: [ ] Implemented

## Person Schema (Priority 2)
- Page: /about
- Type: `Person`
- Properties: name, url, sameAs (social profiles), description, jobTitle
- Status: [ ] Implemented

## Article Schema
- Page: Every blog post
- Type: `Article` or `BlogPosting`
- Properties: headline, author, datePublished, dateModified, image, description
- Status: [ ] Implemented

## FAQ Schema
- Page: FAQ page, relevant blog posts with Q&A sections
- Type: `FAQPage`
- Properties: Question + Answer pairs
- Status: [ ] Implemented

## Review Schema (When Available)
- Page: Homepage or reviews page
- Type: `Review`
- Properties: reviewBody, author, reviewRating
- Status: [ ] Waiting for reviews

## BreadcrumbList Schema
- Page: All pages
- Type: `BreadcrumbList`
- Status: [ ] Implemented
