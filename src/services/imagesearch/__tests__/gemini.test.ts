import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { understandWireframe } from "../gemini";
import type { Wireframe } from "@/lib/layout/types";

function makeWireframe(): Wireframe {
  return {
    id: "wf-1",
    viewport: { width: 1440, label: "desktop" },
    createdAt: "2026-01-01T00:00:00.000Z",
    root: {
      id: "root",
      kind: "root",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      children: [
        {
          id: "section-1",
          kind: "section",
          x: 0,
          y: 0,
          width: 1,
          height: 0.5,
          children: [
            {
              id: "heading-1",
              kind: "heading",
              x: 0.1,
              y: 0.1,
              width: 0.4,
              height: 0.1,
              children: [],
              meta: { hasText: true },
            },
          ],
        },
      ],
    },
  };
}

function mockGeminiResponse(text: string, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    } as Response))
  );
}

const VALID_JSON = JSON.stringify({
  summary: [
    "Main container/card",
    "A wide element at the top",
    "4 small items on the left, arranged 2 x 2",
    "One larger content panel on the right",
    "Overall: two-column feature/content layout",
  ],
  searchQuery: "feature section left list right visual UI design",
});

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("understandWireframe", () => {
  it("reports inactive when GEMINI_API_KEY is missing, without calling fetch", async () => {
    vi.unstubAllEnvs();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).toBeNull();
    expect(result.diagnostic).toContain("GEMINI_API_KEY is not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses a well-formed Gemini response into a WireframeUnderstanding", async () => {
    mockGeminiResponse(VALID_JSON);
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).toEqual({
      summary: [
        "Main container/card",
        "A wide element at the top",
        "4 small items on the left, arranged 2 x 2",
        "One larger content panel on the right",
        "Overall: two-column feature/content layout",
      ],
      searchQuery: "feature section left list right visual UI design",
    });
    expect(result.diagnostic).toBe("ok");
  });

  it("sends the wireframe's geometry (kind/x/y/width/height) in the prompt, without leaking node ids", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: VALID_JSON }] } }] }),
    } as Response));
    vi.stubGlobal("fetch", fetchMock);
    await understandWireframe(makeWireframe());

    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse((init as RequestInit).body as string);
    const promptText = sentBody.contents[0].parts[0].text as string;
    expect(promptText).toContain('"kind":"heading"');
    expect(promptText).not.toContain("heading-1");
    expect(promptText).not.toContain("section-1");
  });

  it("reports the HTTP status when Gemini responds with a non-OK status, without trying another model", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as Response));
    vi.stubGlobal("fetch", fetchMock);
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).toBeNull();
    expect(result.diagnostic).toContain("429");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("includes Google's error message in the diagnostic when the error body has one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "API key not valid." } }),
      } as Response))
    );
    const result = await understandWireframe(makeWireframe());
    expect(result.diagnostic).toContain("API key not valid.");
  });

  it("falls back to the next model name on a 404 (model not found for this key), and succeeds if that one works", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("gemini-2.0-flash")) {
        return { ok: false, status: 404, json: async () => ({ error: { message: "models/gemini-2.0-flash is not found" } }) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: VALID_JSON }] } }] }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).not.toBeNull();
    expect(result.diagnostic).toBe("ok");
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it("reports the last model's diagnostic when every candidate AND the discovered model list 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ error: { message: "model not found" } }) } as Response))
    );
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).toBeNull();
    expect(result.diagnostic).toContain("model not found");
  });

  it("when every hardcoded candidate 404s, asks Gemini's ListModels for a real one and succeeds with it", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes(":generateContent")) {
        if (url.includes("gemini-2.5-flash")) {
          return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: VALID_JSON }] } }] }) } as Response;
        }
        return { ok: false, status: 404, json: async () => ({ error: { message: "model not found" } }) } as Response;
      }
      // ListModels
      return {
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            { name: "models/gemini-pro", supportedGenerationMethods: ["countTokens"] },
            { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
          ],
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).not.toBeNull();
    expect(result.diagnostic).toBe("ok");
    expect(fetchMock.mock.calls.some(([url]) => (url as string).includes("gemini-2.5-flash"))).toBe(true);
  });

  it("reads a replacement model name straight out of the 404 error message and tries it next", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("gemini-2.0-flash")) {
        return {
          ok: false,
          status: 404,
          json: async () => ({
            error: { message: "This model models/gemini-2.0-flash is no longer available. Please update your code to use models/gemini-3.6-flash instead." },
          }),
        } as Response;
      }
      if (url.includes("gemini-3.6-flash")) {
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: VALID_JSON }] } }] }) } as Response;
      }
      throw new Error(`unexpected model requested: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).not.toBeNull();
    expect(result.diagnostic).toBe("ok");
    // The suggested model jumps the queue — tried right after the one that named it, not after every other hardcoded guess.
    const calledModels = fetchMock.mock.calls.map(([url]) => url as string);
    expect(calledModels[0]).toContain("gemini-2.0-flash");
    expect(calledModels[1]).toContain("gemini-3.6-flash");
  });

  it("follows a suggestion even from a model ListModels itself discovered (the real case: a listed model that's since been retired)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes(":generateContent")) {
        if (url.includes("gemini-2.5-flash")) {
          return {
            ok: false,
            status: 404,
            json: async () => ({
              error: {
                message:
                  "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash for the latest features.",
              },
            }),
          } as Response;
        }
        if (url.includes("gemini-3.6-flash")) {
          return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: VALID_JSON }] } }] }) } as Response;
        }
        // The 3 hardcoded candidates — none of them exist for this key.
        return { ok: false, status: 404, json: async () => ({ error: { message: "model not found" } }) } as Response;
      }
      // ListModels: only gemini-2.5-flash is offered.
      return {
        ok: true,
        status: 200,
        json: async () => ({ models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).not.toBeNull();
    expect(result.diagnostic).toBe("ok");
    const calledModels = fetchMock.mock.calls.map(([url]) => url as string);
    expect(calledModels.some((u) => u.includes("gemini-2.5-flash"))).toBe(true);
    expect(calledModels.some((u) => u.includes("gemini-3.6-flash"))).toBe(true);
  });

  it("reports a clear diagnostic when ListModels has no generateContent-capable model", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes(":generateContent")) {
        return { ok: false, status: 404, json: async () => ({ error: { message: "model not found" } }) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ models: [{ name: "models/gemini-pro", supportedGenerationMethods: ["countTokens"] }] }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).toBeNull();
    expect(result.diagnostic).toContain("no untried model available that supports generateContent");
  });

  it("reports a network error when the request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network unreachable");
      })
    );
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).toBeNull();
    expect(result.diagnostic).toContain("network unreachable");
  });

  it("reports when Gemini's reply text is not valid JSON", async () => {
    mockGeminiResponse("this is not json");
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).toBeNull();
    expect(result.diagnostic).toContain("not valid JSON");
  });

  it("reports when Gemini's reply is valid JSON but missing required fields", async () => {
    mockGeminiResponse(JSON.stringify({ detectedPattern: "Feature section" }));
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).toBeNull();
    expect(result.diagnostic).toContain("did not match the expected format");
  });

  it("reports a block reason when Gemini returns no candidates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [], promptFeedback: { blockReason: "SAFETY" } }),
      } as Response))
    );
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).toBeNull();
    expect(result.diagnostic).toContain("SAFETY");
  });
});
