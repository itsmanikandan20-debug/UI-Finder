// A small, curated starting corpus for the local index — real, public,
// generally crawl-friendly pages spanning a range of common section
// shapes (marketing hero, feature grids, docs, pricing, blogs). This is
// intentionally NOT a large list: per the architecture, UI-Finder is not
// meant to crawl the open web at large — it grows a bounded, indexed
// corpus over time.
//
// Run `npm run crawl` to fetch and index these. Add/replace URLs here as
// you like; each is re-crawled only if its cached record is older than
// CRAWL_CACHE_TTL_MS (see scripts/crawl.ts).

// A few of these (Apple, Nike, Shopify, Microsoft in particular) run
// heavier bot-protection than the rest — analyzePage() will surface a
// warning per URL if it detects a challenge page rather than the real
// site rather than silently indexing the wrong thing (see
// src/services/crawler/browser.ts's detectBotChallenge).
export const SEED_SITES: string[] = [
  "https://www.apple.com",
  "https://www.airbnb.com",
  "https://www.nike.com",
  "https://www.spotify.com",
  "https://www.stripe.com",
  "https://linear.app",
  "https://vercel.com",
  "https://www.figma.com",
  "https://www.notion.so",
  "https://www.webflow.com",
  "https://www.shopify.com",
  "https://www.github.com",
  "https://www.slack.com",
  "https://www.supabase.com",
  "https://www.microsoft.com",
];
