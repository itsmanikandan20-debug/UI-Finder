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
  detectedPattern: "Feature section",
  structure: "4 feature items + large visual/content panel",
  layout: "Left feature list -> Right visual",
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
      detectedPattern: "Feature section",
      structure: "4 feature items + large visual/content panel",
      layout: "Left feature list -> Right visual",
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

  it("reports the last model's diagnostic when every candidate model 404s", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ error: { message: "model not found" } }) } as Response))
    );
    const result = await understandWireframe(makeWireframe());
    expect(result.understanding).toBeNull();
    expect(result.diagnostic).toContain("model not found");
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
