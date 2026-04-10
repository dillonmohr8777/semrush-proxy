# Skill: Install Tracking Pixels

## When to use
When asked to install Meta Pixel, Google Ads conversion tracking, or any tracking code on a WordPress site.

## Meta Pixel Installation

### Via WordPress MCP (if site is connected)
1. Get the pixel ID from `get_pixels` (Meta Ads MCP)
2. Generate install code via `get_pixel_install_code`
3. Use WordPress MCP to check if a header/footer code plugin exists
4. If the site uses a theme with header code injection, draft an update with the pixel code
5. NEVER publish directly - create a draft or notify via Slack with the code to install

### Manual Installation (provide instructions)
1. Get the pixel code from `get_pixel_install_code`
2. Tell the user to add it to:
   - WordPress: Appearance → Theme Editor → header.php (before </head>)
   - OR use a plugin like "Insert Headers and Footers"
   - OR use a tag manager (Google Tag Manager)
3. Verify firing via `get_pixel_stats` after installation

### Event Setup
Standard events to recommend for each client type:
- **E-commerce**: Purchase, AddToCart, ViewContent, InitiateCheckout
- **Lead gen**: Lead, Contact, SubmitApplication
- **Local service**: Contact, Schedule, FindLocation
- **Events (Bar Crawl)**: Purchase, ViewContent, Lead

## Google Ads Conversion Tracking

### Check Current Setup
1. `conversion_actions` via Google Ads MCP to see what's configured
2. Look for:
   - Missing conversion actions (no phone call tracking, no form tracking)
   - Conversion actions with 0 conversions (broken tracking)
   - Duplicate or conflicting conversion actions
   - Wrong conversion counting (one vs every)

### Common Fixes
- Phone call tracking: Set up Google forwarding number or call extension tracking
- Form submissions: Install Google Ads tag + conversion linker in GTM or site header
- Purchase tracking: Confirm e-commerce conversion value is passing correctly

### Installation via WordPress
1. Generate the Global Site Tag (gtag.js) code
2. Generate the event snippet for each conversion action
3. Draft installation instructions or use WordPress MCP to add code to header
4. NEVER publish directly

## Verification Checklist
After any tracking installation:
- [ ] Pixel/tag is firing on all pages (check via pixel stats or Tag Assistant)
- [ ] Conversion events are set up for the right actions
- [ ] No duplicate tracking
- [ ] Attribution window is appropriate for the business
- [ ] Test conversion is recorded

## Report
- Send `send_client_report` via Slack with what was installed/fixed
- Log to Obsidian client note
- `log_session` when done
