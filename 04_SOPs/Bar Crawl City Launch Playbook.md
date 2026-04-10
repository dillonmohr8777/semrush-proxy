# Bar Crawl City Launch Playbook

**Purpose:** Reusable framework for launching Taco & Tequila Bar Crawl campaigns across any batch of cities for any event date. Built to scale — swap cities, swap dates, launch fast.

---

## 1. PRE-LAUNCH CHECKLIST

For each new event date batch:

- [ ] Confirm city list and event date from client (Andy)
- [ ] Verify ticket URLs on barcrawlusa.com for each city
- [ ] Confirm pricing (current: $25 GA / $40 VIP)
- [ ] Check for any city-specific restrictions (alcohol ad policy, venue changes)
- [ ] Confirm Google Ads and Meta Ads account access

---

## 2. CAMPAIGN ARCHITECTURE

### Core System (Build Once, Reuse Always)

The campaign system has two layers:

1. **Core Layer** — angles, copy frameworks, and templates that work across ALL cities
2. **City Layer** — localized inserts (neighborhood names, landmarks, bar scene references) layered on top

### 5 Core Angles

These angles are evergreen across all cities and event dates:

| # | Angle | Hook Logic |
|---|-------|------------|
| 1 | Group Chat / Social Plan | "Drop this in the group chat" — social proof, plans with friends |
| 2 | FOMO / Sellout Energy | "Last year sold out" — urgency, scarcity |
| 3 | VIP Upgrade Flex | Premium positioning — early entry, extra tokens, t-shirt, welcome shot |
| 4 | "This is your Saturday" | Lifestyle positioning — best Saturday plan vs staying home |
| 5 | Food + Drink Value | $25 gets tacos + tequila + bar crawl vs $60 normal night out |

---

## 3. GOOGLE ADS TEMPLATES

### Search Campaign — RSA Headline Templates

Use `{CITY}` and `{DATE}` as placeholders. Pin H1 and H2 for brand + city.

```
H1:  Taco & Tequila Bar Crawl — {CITY}
H2:  {DATE} | $25 GA / $40 VIP
H3:  Tacos, Tequila & {CITY}'s Best Bars
H4:  VIP: Early Entry + Welcome Shot
H5:  Limited Tickets — Don't Miss Out
H6:  Grab Your Crew — {CITY} Bar Crawl
H7:  Wristband Gets You Into Every Bar
H8:  {CITY}'s Biggest Bar Crawl Is Back
H9:  $25 Gets You Tacos + Tequila + Access
H10: VIP Perks: T-Shirt, Extra Tokens & More
H11: Best Saturday Plan in {CITY}
H12: Taco Tokens + Margaritas + Live DJ
H13: Bar Crawl Tickets Starting at $25
H14: Book Now — {CITY} Is Selling Fast
H15: The Bar Crawl Everyone's Talking About
```

### Search Campaign — Description Templates

```
D1: Join the Taco & Tequila Bar Crawl in {CITY} on {DATE}. GA $25 / VIP $40. Tacos, tequila, and the best bars in town. Get your tickets now.
D2: VIP gets early entry, a welcome shot, extra taco tokens, an event t-shirt, and voting rights for Best Taco & Best Margarita. Upgrade today.
D3: Wristband = access to every participating bar. Taco tokens included. Bring your crew to {CITY}'s biggest bar crawl event of the year.
D4: Limited tickets available for {CITY} on {DATE}. $25 general admission, $40 VIP. Groups, birthdays, and bachelor/ette parties welcome.
```

### Performance Max Assets

**Headlines (short):**
1. Taco & Tequila Bar Crawl
2. {CITY}'s Biggest Bar Crawl
3. $25 GA / $40 VIP
4. Tacos. Tequila. Bars. Done.
5. Get Your Wristband Now

**Long Headlines:**
1. The Taco & Tequila Bar Crawl Is Coming to {CITY} — Tickets Starting at $25
2. Grab Your Crew and Hit {CITY}'s Best Bars With Taco Tokens and Tequila
3. VIP Gets You Early Entry, a Welcome Shot, Extra Tokens, and a T-Shirt
4. {CITY}'s Best Saturday Plan: Tacos, Tequila, and a City-Wide Bar Crawl
5. Limited Tickets Available — {CITY} Taco & Tequila Bar Crawl {DATE}

**Audience Signals:**
- Interests: nightlife, bar crawl, food festivals, Eventbrite, tequila, tacos, happy hour
- Demographics: 21-45, skew 25-34
- Custom segments: searched "bar crawl near me," "things to do in {CITY}," "taco festival"

### Location Targeting Rule

**ALWAYS** set to `Presence: people in or regularly in your targeted locations` — NOT "Presence or interest." This prevents out-of-market impressions burning budget (learned from March audit).

### Alcohol Ad Policy Compliance

Google restricts alcohol-related ad copy. Avoid these words in headlines/descriptions:
- tequila, shots, margarita, drunk, wasted, booze, liquor

Approved alternatives:
- "Taco & Tequila Bar Crawl" as event name is generally accepted as brand
- Use "drinks," "cocktails," "beverages" in descriptions
- Lead with food (tacos, taco tokens) in headlines when flagged

---

## 4. META ADS TEMPLATES

### Campaign Structure

| Campaign | Objective | Targeting |
|----------|-----------|-----------|
| Prospecting | Conversions (ticket purchase) | Broad + Interest stacks (nightlife, food festivals, Eventbrite, local events) |
| Retargeting | Conversions (ticket purchase) | Site visitors (7d, 30d), video viewers (50%+), IG/FB engagers |

### Copy Framework Per Angle

For each angle, write:
- 3 Primary Texts (long-form captions)
- 3 Headlines (short, punchy)
- 2 Descriptions (one-liner support text)

Then create a **City Insert Version** for each — swap in local bar names, neighborhoods, landmarks.

### Localization Examples

| City | Local Insert |
|------|-------------|
| Greenville, SC | "Main Street is about to go off..." |
| Fort Worth, TX | "The Stockyards called. They said bring taco tokens." |
| St. Petersburg, FL | "Central Ave. Tacos. Tequila. You in?" |
| Indianapolis, IN | "Mass Ave bar crawl energy, but with tacos." |
| Portland, ME | "Old Port is getting a taco takeover." |

---

## 5. LANDING PAGE COPY FRAMEWORK

Each city page follows this structure:

1. **SEO fields:** meta title, meta description, URL slug, primary/secondary keywords
2. **Hero:** City-specific H1, H2 subheadline, locally-flavored hook copy
3. **Section 1:** 3 paragraphs — event history in city, local bar scene credibility, pricing
4. **Mid-page CTA:** City-specific, personality-driven button copy
5. **Section 2:** Social proof, group/birthday positioning, urgency
6. **VIP Section:** Early entry, extra tokens, t-shirt, welcome shot, Best Taco/Best Margarita voting
7. **VIP CTA:** Premium positioning button copy
8. **FAQ:** 4 city-specific FAQs in conversational tone
9. **Bonus editorial:** Locally-inspired headline + 2 closing paragraphs
10. **Final CTA:** Strongest conversion copy

**Delivery formats:**
- Individual .docx files with SEO fields at top
- Master JSON data object for WordPress publisher tool (Elementor template ID 15281)

---

## 6. EMAIL & SMS TEMPLATES

### Email — Announcement (Master Template)

```
Subject: {CITY}'s Taco & Tequila Bar Crawl — {DATE}
Preview: $25 gets you tacos, tequila, and access to every bar.

Body:
- Event name, city, date
- What's included (wristband, taco tokens, bar access)
- GA vs VIP breakdown
- CTA: Get Tickets
```

### Email — Last Chance (Master Template)

```
Subject: Final call — {CITY} is almost sold out
Preview: Don't be the one watching stories from the couch.

Body:
- Urgency framing
- Recap of what they're missing
- VIP upsell
- CTA: Grab Your Tickets Before They're Gone
```

### SMS Templates

```
Announcement: Taco & Tequila Bar Crawl is coming to {CITY} on {DATE}. $25 GA / $40 VIP. Tacos. Tequila. Every bar. Get tickets: {LINK}

Reminder: {CITY} bar crawl is THIS {DAY}. Your crew is going. Are you? Tickets: {LINK}

Final Call: Last chance — {CITY} Taco & Tequila Bar Crawl tickets are almost gone. Don't miss it: {LINK}
```

---

## 7. BUDGET & TESTING FRAMEWORK

### Budget Allocation (10-City Launch)

| Tier | Cities | % of Budget | Rationale |
|------|--------|-------------|-----------|
| Tier 1 (proven) | Fort Worth, Sarasota, Portland ME | 40% | Past performance data, repeat markets |
| Tier 2 (high potential) | Greenville, Indianapolis, St. Petersburg | 35% | Strong demo fit, mid-size metro |
| Tier 3 (test) | Columbia, Roswell, Gainesville GA | 25% | Smaller markets, validate demand |

### Testing Priority

1. Test **FOMO / Sellout** and **Group Chat** angles first (highest historical CTR for event brands)
2. Run 3 days at equal spend, then shift budget to winning angle
3. If CTR > 2% and CVR > 3%, scale that angle's budget 2x across all cities
4. VIP Upgrade angle works best as retargeting — run it in Campaign 2 only

---

## 8. CREATIVE DIRECTION

### Ad Visual Concepts

1. **Overhead taco spread** — colorful, messy, fun. Text overlay: city + date
2. **Wristband close-up** — hand holding a neon wristband with bar in background
3. **Group shot energy** — friends cheering with drinks, taco in hand
4. **VIP card design** — dark/gold premium card showing VIP perks list
5. **City skyline + taco mashup** — local skyline with taco/tequila iconography overlay

### Scroll-Stopping Hooks

1. "POV: You just got 4 taco tokens and a tequila wristband for $25"
2. "This is what your Saturday should look like"
3. "Last year it sold out. Just saying."

---

## 9. PROCESS: NEW MONTH LAUNCH

When a new batch of cities drops:

1. Get city list + date from Andy
2. Verify ticket URLs on barcrawlusa.com
3. Clone this playbook's templates — swap `{CITY}` and `{DATE}`
4. Write city-specific local inserts (neighborhoods, landmarks, bar names)
5. Generate landing page copy (use the 10-section framework above)
6. Export as .docx + JSON for WordPress publisher tool
7. Build Google Search + PMax campaigns from templates
8. Build Meta Prospecting + Retargeting campaigns
9. Draft email + SMS blasts
10. Launch, monitor daily, shift budget to winners by Day 3
