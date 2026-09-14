import { randomUUID } from "node:crypto";
import path from "node:path";
import { checkUrlSafetyResolved } from "./url-safety";
import { isAllowedByRobots } from "./robots";
import { detectBotChallenge, launchBrowser, loadPage, newPage } from "./browser";
import { extractRenderedTree } from "./extract";
import { detectSectionCandidates } from "./sections";
import { rawSectionToLayoutNode } from "./convert";
import { captureSectionScreenshot } from "./screenshot";
import type { ExtractedSection, WebsiteRecord } from "@/lib/layout/types";
import type { SectionStore } from "./store/types";

/**
 * Bump this whenever a change alters what gets extracted from a page —
 * section detection, LayoutNode conversion, or the fields captured on
 * ExtractedSection/WebsiteRecord. scripts/crawl.ts's time-based re-crawl
 * cache only reuses a cached record when its crawlerVersion matches this,
 * so a code change that changes extraction always gets fresh data on the
 * next `npm run crawl` instead of silently serving stale results for up
 * to 14 days.
 */
export const CRAWLER_VERSION = 2;

export interface AnalyzePageOptions {
  viewportWidth?: number;
  maxSections?: number;
  /** When set, a compressed JPEG crop of each detected section is saved here. */
  screenshotDir?: string;
  /** When set, the resulting website + sections are persisted immediately. */
  store?: SectionStore;
}

export interface AnalyzePageResult {
  url: string;
  finalUrl: string;
  viewportWidth: number;
  website: WebsiteRecord;
  sections: ExtractedSection[];
  warnings: string[];
}

export async function analyzePage(url: string, options: AnalyzePageOptions = {}): Promise<AnalyzePageResult> {
  const viewportWidth = options.viewportWidth ?? 1440;
  // Recursive section detection (src/services/crawler/sections.ts) finds
  // many more, more specific candidates per page than the old top-level-
  // only pass did — 40 keeps a real page's worth of granularity without
  // an unbounded crawl.
  const maxSections = options.maxSections ?? 40;
  const warnings: string[] = [];

  const safety = await checkUrlSafetyResolved(url);
  if (!safety.safe || !safety.url) {
    throw new Error(`Refusing to crawl ${url}: ${safety.reason}`);
  }

  const allowed = await isAllowedByRobots(url);
  if (!allowed) {
    throw new Error(`robots.txt disallows crawling ${url}`);
  }

  const domain = safety.url.hostname;
  const websiteId = randomUUID();
  const browser = await launchBrowser();

  try {
    const page = await newPage(browser, viewportWidth);
    await loadPage(page, url);

    const challenge = await detectBotChallenge(page);
    if (challenge) {
      warnings.push(
        "Bot-protection interstitial detected — results below may reflect the challenge page, not the real site."
      );
    }

    const finalUrl = page.url();
    const pageTitle = await page.title().catch(() => undefined);
    const { root: rawRoot, documentHeight } = await extractRenderedTree(page);
    const candidates = detectSectionCandidates(rawRoot, viewportWidth).slice(0, maxSections);
    if (candidates.length === 0) {
      warnings.push("No distinct sections could be detected on this page.");
    }

    const sections: ExtractedSection[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const raw = candidates[i];
      const layoutRoot = rawSectionToLayoutNode(raw);
      const sectionId = randomUUID();

      let screenshotRef: string | undefined;
      if (options.screenshotDir) {
        const fileName = `${websiteId}-${i}.jpg`;
        const outPath = path.join(options.screenshotDir, fileName);
        const captured = await captureSectionScreenshot(page, raw, outPath, viewportWidth);
        if (captured) screenshotRef = fileName;
      }

      sections.push({
        id: sectionId,
        websiteId,
        pageUrl: finalUrl,
        domain,
        websiteTitle: pageTitle,
        sectionIndex: i,
        domSelector: raw.tag,
        viewportWidth,
        root: layoutRoot,
        screenshotRef,
        // Navigation-only fields (never used in scoring — see
        // RawDomNode.snippetText): a short in-section text snippet for a
        // browser "scroll to text" deep link, and how far down the page
        // this section sits, for when no such link is possible.
        anchorSnippet: raw.snippetText || undefined,
        pageYRatio: documentHeight > 0 ? Math.min(1, Math.max(0, raw.y / documentHeight)) : undefined,
        pageBox: { x: raw.x, y: raw.y, width: raw.width, height: raw.height },
        crawledAt: new Date().toISOString(),
      });
    }

    const website: WebsiteRecord = {
      id: websiteId,
      domain,
      pageUrl: finalUrl,
      title: pageTitle,
      status: challenge ? "blocked" : "crawled",
      lastCrawledAt: new Date().toISOString(),
      crawlerVersion: CRAWLER_VERSION,
    };

    if (options.store) {
      await options.store.saveWebsite(website);
      for (const section of sections) {
        await options.store.saveSection(section);
      }
    }

    return { url, finalUrl, viewportWidth, website, sections, warnings };
  } finally {
    await browser.close();
  }
}
