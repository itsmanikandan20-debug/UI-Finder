// Populates the section index by running the real crawler/analyzer
// against the seed URL list (or URLs passed on the command line). Writes
// through the same SectionStore the app reads at search time — the local
// JSON store by default, or Postgres/pgvector when DATABASE_URL is set.
//
// Usage:
//   npm run crawl                      # crawl every URL in seed-sites.ts
//   npm run crawl -- https://a.com ...  # crawl just these URLs instead

import path from "node:path";
import { promises as fs } from "node:fs";
import { analyzePage } from "@/services/crawler/analyzePage";
import { createSectionStore } from "@/services/crawler/store";
import { SEED_SITES } from "./seed-sites";

const SCREENSHOT_DIR = path.join(process.cwd(), "data", "screenshots");
const CRAWL_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const urls = args.filter((a) => a !== "--force").length > 0 ? args.filter((a) => a !== "--force") : SEED_SITES;

  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  const store = await createSectionStore();

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const url of urls) {
    if (!force) {
      const existing = await store.getWebsiteByUrl(url);
      if (existing?.lastCrawledAt) {
        const age = Date.now() - new Date(existing.lastCrawledAt).getTime();
        if (age < CRAWL_CACHE_TTL_MS) {
          console.log(`Skipping ${url} — crawled ${Math.round(age / 86400000)}d ago (--force to re-crawl).`);
          skipped += 1;
          continue;
        }
      }
    }

    process.stdout.write(`Crawling ${url}... `);
    try {
      const result = await analyzePage(url, {
        viewportWidth: 1440,
        screenshotDir: SCREENSHOT_DIR,
        store,
      });
      console.log(`${result.sections.length} section(s) indexed.`);
      for (const warning of result.warnings) {
        console.log(`  [warn] ${warning}`);
      }
      succeeded += 1;
    } catch (err) {
      console.log(`FAILED — ${(err as Error).message}`);
      failed += 1;
    }
  }

  console.log(`\nDone. ${succeeded} succeeded, ${failed} failed, ${skipped} skipped (cached).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
