// Real internet image search — SerpApi's Google Images engine. Given a
// plain-text query (built by gemini.ts from the wireframe's geometry, never
// the drawing itself), returns real images from real public web pages plus
// where each one came from. This never reads from or writes to UI-Finder's
// own crawled-section index (src/services/crawler/store) — it is a wholly
// separate, additive feature from live-website matching.

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";
// SerpApi proxies a live Google Images search, which can take noticeably
// longer than a typical JSON API — 15s was cutting it close in practice.
const FETCH_TIMEOUT_MS = 25000;
const MAX_IMAGES = 9;

export interface ImageSearchResultItem {
  imageUrl: string;
  thumbnailUrl?: string;
  sourceUrl: string;
  sourceTitle?: string;
}

export interface SerpApiSearchResult {
  images: ImageSearchResultItem[];
  /** Always populated, human-readable — surfaced to the caller so a zero-result or failed run says exactly why. */
  diagnostic: string;
}

interface SerpApiImageResult {
  original?: string;
  thumbnail?: string;
  link?: string;
  source?: string;
  title?: string;
}

interface SerpApiResponse {
  error?: string;
  images_results?: SerpApiImageResult[];
}

/** Fails open (empty array + a diagnostic) on any error — this is an optional feature, never something that should crash the page. */
export async function searchImages(query: string): Promise<SerpApiSearchResult> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return { images: [], diagnostic: "SERPAPI_API_KEY is not set — internet image search is inactive." };
  }

  const url = `${SERPAPI_ENDPOINT}?engine=google_images&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(
    apiKey
  )}`;

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { images: [], diagnostic: `network error reaching SerpApi: ${message}` };
  }

  if (!res.ok) {
    return { images: [], diagnostic: `SerpApi responded with HTTP ${res.status}` };
  }

  let data: SerpApiResponse;
  try {
    data = (await res.json()) as SerpApiResponse;
  } catch {
    return { images: [], diagnostic: "SerpApi response was not valid JSON" };
  }

  if (data.error) {
    return { images: [], diagnostic: `SerpApi error: ${data.error}` };
  }

  const raw = data.images_results ?? [];
  const images: ImageSearchResultItem[] = raw
    .map((item): ImageSearchResultItem | null => {
      const imageUrl = item.original;
      const sourceUrl = item.link;
      if (!imageUrl || !sourceUrl) return null;
      return {
        imageUrl,
        thumbnailUrl: item.thumbnail,
        sourceUrl,
        sourceTitle: item.title || item.source,
      };
    })
    .filter((item): item is ImageSearchResultItem => item !== null)
    .slice(0, MAX_IMAGES);

  if (images.length === 0) {
    return { images: [], diagnostic: `query succeeded but returned 0 usable image results for "${query}"` };
  }
  return { images, diagnostic: `ok — ${images.length} result(s)` };
}
