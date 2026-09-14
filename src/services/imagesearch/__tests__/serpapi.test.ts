import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchImages } from "../serpapi";

beforeEach(() => {
  vi.stubEnv("SERPAPI_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function mockSerpApiJson(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status, json: async () => body } as Response))
  );
}

describe("searchImages", () => {
  it("reports inactive when SERPAPI_API_KEY is missing, without calling fetch", async () => {
    vi.unstubAllEnvs();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await searchImages("feature section UI design");
    expect(result.images).toEqual([]);
    expect(result.diagnostic).toContain("SERPAPI_API_KEY is not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests SerpApi's google_images engine with the given query", async () => {
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => ({ images_results: [] }) } as Response));
    vi.stubGlobal("fetch", fetchMock);
    await searchImages("feature section left list right visual UI design");
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain("serpapi.com/search.json");
    expect(calledUrl).toContain("engine=google_images");
    expect(decodeURIComponent(calledUrl)).toContain("feature section left list right visual UI design");
  });

  it("extracts image/source fields from a well-formed images_results array", async () => {
    mockSerpApiJson({
      images_results: [
        { original: "https://example.com/shot.png", thumbnail: "https://example.com/thumb.png", link: "https://example.com/design", title: "Example Design" },
      ],
    });
    const result = await searchImages("feature section UI design");
    expect(result.images).toEqual([
      {
        imageUrl: "https://example.com/shot.png",
        thumbnailUrl: "https://example.com/thumb.png",
        sourceUrl: "https://example.com/design",
        sourceTitle: "Example Design",
      },
    ]);
    expect(result.diagnostic).toContain("ok");
  });

  it("falls back to the source domain as the title when no title is present", async () => {
    mockSerpApiJson({
      images_results: [{ original: "https://example.com/shot.png", link: "https://example.com/design", source: "example.com" }],
    });
    const result = await searchImages("feature section UI design");
    expect(result.images[0].sourceTitle).toBe("example.com");
  });

  it("skips results missing the fields needed to show/open them", async () => {
    mockSerpApiJson({
      images_results: [
        { original: "https://example.com/shot.png" },
        { link: "https://example.com/design" },
        { original: "https://example.com/ok.png", link: "https://example.com/ok" },
      ],
    });
    const result = await searchImages("feature section UI design");
    expect(result.images).toEqual([
      { imageUrl: "https://example.com/ok.png", thumbnailUrl: undefined, sourceUrl: "https://example.com/ok", sourceTitle: undefined },
    ]);
  });

  it("reports a distinct diagnostic when the query succeeds but returns nothing usable", async () => {
    mockSerpApiJson({ images_results: [] });
    const result = await searchImages("an extremely obscure query");
    expect(result.images).toEqual([]);
    expect(result.diagnostic).toContain("0 usable image results");
  });

  it("reports SerpApi's own error field distinctly from an HTTP failure", async () => {
    mockSerpApiJson({ error: "Invalid API key." });
    const result = await searchImages("feature section UI design");
    expect(result.images).toEqual([]);
    expect(result.diagnostic).toContain("Invalid API key");
  });

  it("reports the HTTP status when SerpApi responds with a non-OK status", async () => {
    mockSerpApiJson({}, false, 401);
    const result = await searchImages("feature section UI design");
    expect(result.images).toEqual([]);
    expect(result.diagnostic).toContain("401");
  });

  it("reports a network error when the request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network unreachable");
      })
    );
    const result = await searchImages("feature section UI design");
    expect(result.images).toEqual([]);
    expect(result.diagnostic).toContain("network unreachable");
  });

  it("caps results at 9 images", async () => {
    mockSerpApiJson({
      images_results: Array.from({ length: 15 }, (_, i) => ({
        original: `https://example.com/${i}.png`,
        link: `https://example.com/page-${i}`,
      })),
    });
    const result = await searchImages("feature section UI design");
    expect(result.images).toHaveLength(9);
  });
});
