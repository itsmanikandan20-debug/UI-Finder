// Normalizes a URL for dedup purposes only (deciding "have we already
// queued/crawled this page") — never used for matching or storage of the
// canonical URL itself (analyzePage() always stores the real page.url()
// after redirects).

export function normalizeUrlForDedup(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    // Strip a single trailing slash (but keep root "/" as-is) and common
    // tracking query params that don't change the page's actual content.
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
    for (const param of TRACKING_PARAMS) url.searchParams.delete(param);
    return url.toString();
  } catch {
    return null;
  }
}

export function getDomain(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}
