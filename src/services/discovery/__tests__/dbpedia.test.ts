import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRandomCompanyHomepages } from "../dbpedia";

function mockSparqlJson(homepages: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          results: { bindings: homepages.map((h) => ({ homepage: { value: h } })) },
        }),
      } as Response;
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRandomCompanyHomepages", () => {
  it("extracts homepage URLs from a well-formed SPARQL JSON response", async () => {
    mockSparqlJson(["https://example-company.com/", "https://another-company.org/"]);
    const urls = await fetchRandomCompanyHomepages(5);
    expect(urls).toEqual(["https://example-company.com/", "https://another-company.org/"]);
  });

  it("requests the DBpedia SPARQL endpoint with a LIMIT matching the requested count", async () => {
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ results: { bindings: [] } }) } as Response));
    vi.stubGlobal("fetch", fetchMock);
    await fetchRandomCompanyHomepages(7);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain("dbpedia.org/sparql");
    expect(decodeURIComponent(calledUrl)).toContain("LIMIT 7");
  });

  it("returns an empty array when the endpoint responds with a non-OK status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) } as Response)));
    expect(await fetchRandomCompanyHomepages(5)).toEqual([]);
  });

  it("returns an empty array on a malformed/empty JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) } as Response)));
    expect(await fetchRandomCompanyHomepages(5)).toEqual([]);
  });

  it("returns an empty array when the request throws (offline, timeout, etc.)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network unreachable");
      })
    );
    expect(await fetchRandomCompanyHomepages(5)).toEqual([]);
  });

  it("skips bindings with a missing or non-string homepage value", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: {
            bindings: [{ homepage: { value: "https://real.example.com/" } }, { homepage: {} }, {}],
          },
        }),
      } as Response))
    );
    expect(await fetchRandomCompanyHomepages(5)).toEqual(["https://real.example.com/"]);
  });
});
