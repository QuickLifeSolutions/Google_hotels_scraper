# Performance Tracking

## Identified bottlenecks
- Unbounded hard-coded delays (`waitForTimeout`) add ~3 seconds per request cycle and stack with large result sets.
- Detail pages run serially because crawler concurrency is left at defaults and headless sessions aren't re-used aggressively.
- DOM traversal for hotel details requires multiple sequential tab clicks, keeping each Playwright page open longer than necessary.
- Heavy resources (images, fonts, media) are downloaded even though the scraper only needs metadata, wasting bandwidth and time.

## Fix plan
1. Remove fixed sleeps and wait on concrete DOM states instead; tighten selectors and add retry helpers.
2. Tune Playwright crawler for higher safe concurrency, session reuse, and deterministic navigation settings.
3. Collect hotel detail data via targeted evaluators without redundant tab switches; add early exits for missing data.
4. Block non-essential resource categories to reduce network overhead.
5. Document new input options and safeguards so the actor behaves predictably in production.

## Implemented improvements
- Added Google consent cookie pre-seeding in the navigation hook to bypass the multi-minute consent redirect loop before each crawl starts.
- Enabled reusable resource-blocking and tighter navigation timeouts per page while still allowing DOM scraping for required fields.
