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

export const SEED_SITES: string[] = [
  "https://tailwindcss.com",
  "https://nextjs.org",
  "https://vercel.com",
  "https://playwright.dev",
  "https://react.dev",
  "https://svelte.dev",
  "https://vuejs.org",
  "https://www.docker.com",
  "https://www.figma.com",
  "https://stripe.com",
  "https://www.notion.so",
  "https://linear.app",
  "https://www.framer.com",
  "https://supabase.com",
  "https://www.postgresql.org",
];
