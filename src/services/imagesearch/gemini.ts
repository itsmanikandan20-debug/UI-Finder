// Turns the *geometry* of a wireframe (the same normalized LayoutNode tree
// the matcher uses for live-website matching — never a rendered image, never
// raw pixels) into a short human-readable interpretation plus a plain-text
// phrase suitable for a real web image search. This is the "AI understands
// the drawing" step for the internet UI-image search feature; it has
// nothing to do with, and never touches, the live-website matcher/crawler.

import { z } from "zod";
import { getMatchableSections } from "@/lib/layout/normalize";
import type { LayoutNode, Wireframe } from "@/lib/layout/types";

// Google renames/retires Gemini model ids over time, and a given API key's
// account can have access to a different set than another — a single
// hardcoded model name is exactly the kind of thing that silently starts
//404ing. Tried in order; only a 404 (model not found/unavailable) moves on
// to the next one — any other failure (bad key, blocked content, quota) is
// real and reported immediately rather than retried three times over.
const GEMINI_MODEL_CANDIDATES = ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash"];
const FETCH_TIMEOUT_MS = 15000;

export interface WireframeUnderstanding {
  detectedPattern: string;
  structure: string;
  layout: string;
  searchQuery: string;
}

export interface GeminiUnderstandingResult {
  understanding: WireframeUnderstanding | null;
  /** Always populated, human-readable — surfaced to the caller so a failed/misconfigured run says exactly why, not just "nothing happened". */
  diagnostic: string;
}

const understandingSchema = z.object({
  detectedPattern: z.string().min(1),
  structure: z.string().min(1),
  layout: z.string().min(1),
  searchQuery: z.string().min(1),
});

/** Strips ids (internal, meaningless to the model) so the prompt stays small and clean. */
function sanitizeForPrompt(node: LayoutNode): Omit<LayoutNode, "id" | "children"> & { children: unknown[] } {
  const { id: _id, children, ...rest } = node;
  return { ...rest, children: children.map(sanitizeForPrompt) };
}

function buildPrompt(wireframe: Wireframe): string {
  const sections = getMatchableSections(wireframe).map(sanitizeForPrompt);
  return `You are looking at the GEOMETRY of a rough UI wireframe sketch — box positions and sizes only (0-1 ratios within their parent), never an actual image or real text/colors. Each section is a JSON tree of boxes; "kind" is one of root/section/row/column/repeated_group/heading/text/image/button/box, "repeat" marks a repeated set of items, and x/y/width/height are 0-1 ratios.

Wireframe section(s):
${JSON.stringify(sections)}

Based ONLY on this geometry, respond with STRICT JSON, no markdown, no commentary, matching exactly this shape:
{
  "detectedPattern": "short label for the overall UI pattern, e.g. \\"Feature section\\"",
  "structure": "short plain-English description of the content, e.g. \\"4 feature items + large visual/content panel\\"",
  "layout": "short description of the arrangement, e.g. \\"Left feature list -> Right visual\\"",
  "searchQuery": "a short, effective web search phrase (5-12 words) for finding real UI design examples matching this layout, ending with words like \\"UI design\\" or \\"website design\\""
}`;
}

interface GeminiApiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
  promptFeedback?: { blockReason?: string };
}

interface GeminiErrorBody {
  error?: { message?: string };
}

interface GeminiModelsListResponse {
  models?: { name?: string; supportedGenerationMethods?: string[] }[];
}

/**
 * Last resort when every hardcoded candidate 404s: ask Google directly
 * which models this specific key can actually use, rather than guessing
 * more names. Prefers a "flash" model (fast/cheap) if more than one
 * qualifies.
 */
async function discoverAvailableModel(apiKey: string): Promise<{ model: string | null; diagnostic: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
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
    return { model: null, diagnostic: `network error listing Gemini models: ${message}` };
  }

  if (!res.ok) {
    return { model: null, diagnostic: `Gemini ListModels responded with HTTP ${res.status}` };
  }

  let data: GeminiModelsListResponse;
  try {
    data = (await res.json()) as GeminiModelsListResponse;
  } catch {
    return { model: null, diagnostic: "Gemini ListModels response was not valid JSON" };
  }

  const usable = (data.models ?? []).filter(
    (m): m is { name: string; supportedGenerationMethods?: string[] } =>
      typeof m.name === "string" && Boolean(m.supportedGenerationMethods?.includes("generateContent"))
  );
  const chosen = usable.find((m) => m.name.includes("flash")) ?? usable[0];
  if (!chosen) {
    return { model: null, diagnostic: "This API key has no model available that supports generateContent" };
  }
  return { model: chosen.name.replace(/^models\//, ""), diagnostic: "ok" };
}

interface GeminiAttempt {
  understanding: WireframeUnderstanding | null;
  diagnostic: string;
  /** True only for "this model name isn't available for this key" (HTTP 404) — worth trying the next candidate model. Any other failure is reported as-is. */
  retryNextModel: boolean;
}

async function callGemini(model: string, prompt: string, apiKey: string): Promise<GeminiAttempt> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  };

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { understanding: null, diagnostic: `network error reaching Gemini: ${message}`, retryNextModel: false };
  }

  if (!res.ok) {
    let detail = "";
    try {
      const errorBody = (await res.json()) as GeminiErrorBody;
      if (errorBody.error?.message) detail = ` — ${errorBody.error.message}`;
    } catch {
      // Body wasn't JSON (or had no error.message) — report the bare status only.
    }
    return {
      understanding: null,
      diagnostic: `Gemini responded with HTTP ${res.status} for model "${model}"${detail}`,
      retryNextModel: res.status === 404,
    };
  }

  let data: GeminiApiResponse;
  try {
    data = (await res.json()) as GeminiApiResponse;
  } catch {
    return { understanding: null, diagnostic: "Gemini response was not valid JSON", retryNextModel: false };
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const blockReason = data.promptFeedback?.blockReason;
    return {
      understanding: null,
      diagnostic: blockReason
        ? `Gemini declined to respond (${blockReason})`
        : "Gemini returned no understanding for this wireframe",
      retryNextModel: false,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { understanding: null, diagnostic: "Gemini's reply was not valid JSON", retryNextModel: false };
  }

  const result = understandingSchema.safeParse(parsed);
  if (!result.success) {
    return { understanding: null, diagnostic: "Gemini's reply did not match the expected format", retryNextModel: false };
  }

  return { understanding: result.data, diagnostic: "ok", retryNextModel: false };
}

/** Fails open (null understanding + a diagnostic) on any error — this is one optional feature among several, never something that should crash the page. */
export async function understandWireframe(wireframe: Wireframe): Promise<GeminiUnderstandingResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { understanding: null, diagnostic: "GEMINI_API_KEY is not set — internet image search is inactive." };
  }

  const prompt = buildPrompt(wireframe);
  let lastDiagnostic = "Gemini returned no understanding for this wireframe";

  for (const model of GEMINI_MODEL_CANDIDATES) {
    const attempt = await callGemini(model, prompt, apiKey);
    if (attempt.retryNextModel) {
      lastDiagnostic = attempt.diagnostic;
      continue;
    }
    return { understanding: attempt.understanding, diagnostic: attempt.diagnostic };
  }

  // Every hardcoded guess 404'd — ask Google what this key can actually use.
  const discovered = await discoverAvailableModel(apiKey);
  if (!discovered.model) {
    return { understanding: null, diagnostic: `${lastDiagnostic} (then: ${discovered.diagnostic})` };
  }
  const finalAttempt = await callGemini(discovered.model, prompt, apiKey);
  return { understanding: finalAttempt.understanding, diagnostic: finalAttempt.diagnostic };
}
