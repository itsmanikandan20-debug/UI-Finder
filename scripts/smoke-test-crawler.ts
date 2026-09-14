// Dev-only sanity check: runs the REAL crawler pipeline (browser launch,
// DOM extraction, section detection, LayoutNode conversion, screenshot
// capture) against local HTML fixtures, then scores the result with the
// real matcher. This exists to prove the pipeline genuinely works end to
// end — it is NOT how the app gets its data. Fixture pages are not
// live websites, so nothing it produces is ever written to
// data/sections.seed.json or shown to a user as a search result: that
// would violate the "always a real live webpage" product requirement.
// Populate the real index with `npm run crawl` against real URLs
// instead (see scripts/seed-sites.ts).

import path from "node:path";
import { launchBrowser, newPage, loadPage } from "@/services/crawler/browser";
import { extractRenderedTree } from "@/services/crawler/extract";
import { detectSectionCandidates } from "@/services/crawler/sections";
import { rawSectionToLayoutNode } from "@/services/crawler/convert";
import { scoreSections } from "@/services/matcher/score";

const FIXTURES_DIR = process.argv[2];
if (!FIXTURES_DIR) {
  console.error("Usage: tsx scripts/smoke-test-crawler.ts <fixtures-dir>");
  process.exit(1);
}

async function analyzeFixture(browser: Awaited<ReturnType<typeof launchBrowser>>, file: string) {
  const page = await newPage(browser, 1440);
  await loadPage(page, `file://${path.join(FIXTURES_DIR, file)}`);
  const raw = await extractRenderedTree(page);
  const sections = detectSectionCandidates(raw, 1440);
  await page.close();
  return sections.map(rawSectionToLayoutNode);
}

async function main() {
  const browser = await launchBrowser();
  try {
    console.log("Analyzing saas-landing.html...");
    const saasSections = await analyzeFixture(browser, "saas-landing.html");
    console.log(`  -> detected ${saasSections.length} section(s)`);
    saasSections.forEach((s, i) => {
      console.log(
        `  [${i}] kind=${s.kind} children=${s.children.length} ` +
          `repeat=${s.children.find((c) => c.kind === "repeated_group")?.repeat?.count ?? "-"}`
      );
    });

    console.log("\nAnalyzing photo-portfolio.html...");
    const photoSections = await analyzeFixture(browser, "photo-portfolio.html");
    console.log(`  -> detected ${photoSections.length} section(s)`);

    if (saasSections.length >= 3 && photoSections.length >= 1) {
      // The "heading + 4 cards + split" section should be the middle one
      // once header/footer are excluded by the width/height thresholds.
      const cardsSection = saasSections.find((s) =>
        s.children.some((c) => c.kind === "repeated_group" && c.repeat?.count === 4)
      );
      if (!cardsSection) {
        console.log("\n[WARN] Could not find the expected 4-card section — inspect output above.");
      } else {
        const scoreVsItself = scoreSections(cardsSection, cardsSection);
        const scoreVsUnrelated = scoreSections(cardsSection, photoSections[0]);
        console.log(`\nSelf-similarity (sanity, should be ~100): ${scoreVsItself.similarity}`);
        console.log(`Similarity vs. unrelated full-bleed image section: ${scoreVsUnrelated.similarity}`);
        console.log(
          scoreVsItself.similarity > scoreVsUnrelated.similarity
            ? "PASS: real crawler output ranks a real match above a real mismatch."
            : "FAIL: scoring did not discriminate as expected."
        );
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
