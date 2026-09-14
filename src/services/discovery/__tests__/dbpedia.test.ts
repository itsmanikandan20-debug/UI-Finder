import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCompanyDirectoryBatch } from "../dbpedia";

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

describe("fetchCompanyDirectoryBatch", () => {
  it("extracts homepage URLs from a well-formed SPARQL JSON response", async () => {
    mockSparqlJson(["https://example-company.com/", "https://another-company.org/"]);
    const result = await fetchCompanyDirectoryBatch(5);
    expect(result.homepages).toEqual(["https://example-company.com/", "https://another-company.org/"]);
    expect(result.diagnostic).toContain("ok");
  });

  it("requests the DBpedia SPARQL endpoint with a LIMIT matching the requested count, checking both homepage properties", async () => {
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ results: { bindings: [] } }) } as Response));
    vi.stubGlobal("fetch", fetchMock);
    await fetchCompanyDirectoryBatch(7);
    const calledUrl = fetchMock.mock.calls[0][0];
    const decoded = decodeURIComponent(calledUrl);
    expect(calledUrl).toContain("dbpedia.org/sparql");
    expect(decoded).toContain("LIMIT 7");
    expect(decoded).toContain("dbpedia.org/ontology/homepage");
    expect(decoded).toContain("xmlns.com/foaf/0.1/homepage");
  });

  it("reports the HTTP status when the endpoint responds with a non-OK status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) } as Response)));
    const result = await fetchCompanyDirectoryBatch(5);
    expect(result.homepages).toEqual([]);
    expect(result.diagnostic).toContain("503");
  });

  it("reports a parse failure on malformed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new Error("unexpected token");
        },
      } as unknown as Response))
    );
    const result = await fetchCompanyDirectoryBatch(5);
    expect(result.homepages).toEqual([]);
    expect(result.diagnostic).toContain("not valid JSON");
  });

  it("reports zero-match distinctly from a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ results: { bindings: [] } }) } as Response)));
    const result = await fetchCompanyDirectoryBatch(5);
    expect(result.homepages).toEqual([]);
    expect(result.diagnostic).toContain("matched 0 companies");
  });

  it("reports the underlying error message when the request throws (offline, timeout, etc.)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network unreachable");
      })
    );
    const result = await fetchCompanyDirectoryBatch(5);
    expect(result.homepages).toEqual([]);
    expect(result.diagnostic).toContain("network unreachable");
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
    const result = await fetchCompanyDirectoryBatch(5);
    expect(result.homepages).toEqual(["https://real.example.com/"]);
  });
});
