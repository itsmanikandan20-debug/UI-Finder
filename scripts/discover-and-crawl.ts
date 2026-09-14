// Automatic website discovery + crawling. Unlike scripts/crawl.ts (a
// fixed, hand-typed URL list), this reads from a growing queue: it seeds
// itself from scripts/seed-sites.ts on first run, then after crawling
// each page it follows that page's own outbound links and checks its
// sitemap for more of its own pages — queuing both for a FUTURE run.
// Every run only touches a small, bounded batch (politeness + "start
// small" by design, not a fixed technical ceiling) — run it again
// (e.g. on a schedule) to keep growing the index over time.
//
// Usage:
//   npm run discover                # small safe batch (default 8)
//   npm run discover -- --batch 20  # a bigger batch, once you trust it
//
// Uses only free mechanisms: link-following and sitemap.xml — no paid
// search/discovery API. See the architecture note in README.md.

import path from "node:path";
import { promises as fs } from "node:fs";
import { analyzePage } from "@/services/crawler/analyzePage";
import { createSectionStore } from "@/services/crawler/store";
import { createDiscoveryQueueStore } from "@/services/discovery/store";
import { fetchSitemapUrls } from "@/services/discovery/sitemap";
import { seedQueueIfEmpty, enqueueDiscovered } from "@/services/discovery/queue-helpers";
import { SEED_SITES } from "./seed-sites";

const SCREENSHOT_DIR = path.join(process.cwd(), "data", "screenshots");
const DEFAULT_BATCH_SIZE = 8; // "start with a small safe batch" — grow this once you trust the results
const POLITENESS_DELAY_MS = 2000; // pause between crawls, regardless of domain

function parseArgs(): { batchSize: number } {
  const args = process.argv.slice(2);
  const batchFlagIndex = args.indexOf("--batch");
  const parsed = batchFlagIndex >= 0 ? parseInt(args[batchFlagIndex + 1], 10) : NaN;
  return { batchSize: Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH_SIZE };
}

async function main() {
  const { batchSize } = parseArgs();
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  const queue = await createDiscoveryQueueStore();
  const sectionStore = await createSectionStore();

  const seeded = await seedQueueIfEmpty(queue, SEED_SITES);
  if (seeded > 0) console.log(`Discovery queue was empty — seeded ${seeded} URL(s) from scripts/seed-sites.ts.\n`);

  const batch = await queue.takeBatch(batchSize);
  if (batch.length === 0) {
    const { total } = await queue.size();
    console.log(
      total === 0
        ? "Nothing queued and no seeds configured — add URLs to scripts/seed-sites.ts."
        : `No pending URLs right now (${total} already resolved). Everything discovered so far has been crawled.`
    );
    return;
  }

  console.log(`Discovery run: ${batch.length} URL(s) this batch (--batch to change).\n`);

  let crawled = 0;
  let failed = 0;
  let newlyDiscovered = 0;

  for (const entry of batch) {
    process.stdout.write(`Crawling ${entry.url} [${entry.discoveryMethod}]... `);
    try {
      const result = await analyzePage(entry.url, {
        viewportWidth: 1440,
        screenshotDir: SCREENSHOT_DIR,
        store: sectionStore,
      });
      console.log(`${result.sections.length} section(s) indexed.`);
      for (const warning of result.warnings) console.log(`  [warn] ${warning}`);
      await queue.updateStatus(entry.url, "crawled");
      crawled += 1;

      const pageUrl = new URL(result.finalUrl);
      const isSeedOrHomepage = entry.discoveryMethod === "seed" || pageUrl.pathname === "/";
      const sitemapUrls = isSeedOrHomepage ? await fetchSitemapUrls(pageUrl.origin).catch(() => []) : [];

      const fromLinks = await enqueueDiscovered(queue, result.links, result.finalUrl, "link");
      const fromSitemap = await enqueueDiscovered(queue, sitemapUrls, result.finalUrl, "sitemap");
      newlyDiscovered += fromLinks + fromSitemap;
      if (fromLinks + fromSitemap > 0) {
        console.log(`  -> queued ${fromLinks} link(s) + ${fromSitemap} sitemap page(s) for a future run.`);
      }
    } catch (err) {
      const message = (err as Error).message;
      console.log(`FAILED — ${message}`);
      await queue.updateStatus(entry.url, "failed", message);
      failed += 1;
    }

    await new Promise((resolve) => setTimeout(resolve, POLITENESS_DELAY_MS));
  }

  const { pending, total } = await queue.size();
  console.log(
    `\nDone. ${crawled} crawled, ${failed} failed, ${newlyDiscovered} new URL(s) discovered this run.\n` +
      `Queue: ${pending} pending / ${total} total. Run "npm run discover" again to keep growing the index.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
