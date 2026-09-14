import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSitemapUrls } from "../sitemap";

function mockFetchOnce(responses: Record<string, { ok: boolean; text: string }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const entry = responses[url];
      if (!entry) return { ok: false, text: async () => "" } as Response;
      return { ok: entry.ok, text: async () => entry.text } as Response;
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchSitemapUrls", () => {
  it("extracts <loc> entries from a plain sitemap", async () => {
    mockFetchOnce({
      "https://example.com/sitemap.xml": {
        ok: true,
        text: `<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/pricing</loc></url></urlset>`,
      },
    });
    const urls = await fetchSitemapUrls("https://example.com");
    expect(urls).toEqual(["https://example.com/", "https://example.com/pricing"]);
  });

  it("follows one level of sitemap-index nesting", async () => {
    mockFetchOnce({
      "https://example.com/sitemap.xml": {
        ok: true,
        text: `<sitemapindex><sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap></sitemapindex>`,
      },
      "https://example.com/sitemap-pages.xml": {
        ok: true,
        text: `<urlset><url><loc>https://example.com/about</loc></url></urlset>`,
      },
    });
    const urls = await fetchSitemapUrls("https://example.com");
    expect(urls).toEqual(["https://example.com/about"]);
  });

  it("returns an empty array when there is no sitemap", async () => {
    mockFetchOnce({});
    const urls = await fetchSitemapUrls("https://example.com");
    expect(urls).toEqual([]);
  });
});
