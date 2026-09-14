// Sitemaps exist specifically to be machine-read — fetching one is the
// most "polite" possible discovery method there is, and it finds more
// PAGES on a domain we already trust (pricing, features, about) rather
// than new domains, which is exactly what grows section variety per
// site without widening the crawl frontier recklessly.
//
// Deliberately minimal: no XML parser dependency, just enough regex
// extraction to pull <loc> entries and follow one level of sitemap-index
// nesting. Anything malformed or absent is treated as "no sitemap" —
// never an error.

const FETCH_TIMEOUT_MS = 6000;
const MAX_URLS = 20;
const MAX_NESTED_SITEMAPS = 3;

async function fetchText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "UI-Finder-Bot" } });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractLocs(xml: string): string[] {
  const matches = xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi);
  return Array.from(matches, (m) => m[1]);
}

/** Fetches origin/sitemap.xml, following at most a few nested sitemap-index entries, capped at MAX_URLS total. */
export async function fetchSitemapUrls(origin: string): Promise<string[]> {
  const rootXml = await fetchText(`${origin.replace(/\/$/, "")}/sitemap.xml`);
  if (!rootXml) return [];

  const locs = extractLocs(rootXml);
  if (locs.length === 0) return [];

  // A sitemap INDEX points at other sitemap files (also ending in .xml,
  // often containing "sitemap" in the path) rather than pages directly.
  const looksLikeIndex = locs.every((loc) => /sitemap.*\.xml($|\?)/i.test(loc));
  if (!looksLikeIndex) {
    return locs.slice(0, MAX_URLS);
  }

  const pageUrls: string[] = [];
  for (const nested of locs.slice(0, MAX_NESTED_SITEMAPS)) {
    const nestedXml = await fetchText(nested);
    if (!nestedXml) continue;
    pageUrls.push(...extractLocs(nestedXml));
    if (pageUrls.length >= MAX_URLS) break;
  }
  return pageUrls.slice(0, MAX_URLS);
}
