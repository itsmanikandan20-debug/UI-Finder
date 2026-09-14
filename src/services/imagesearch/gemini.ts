// Turns the *geometry* of a wireframe (the same normalized LayoutNode tree
// the matcher uses for live-website matching — never a rendered image, never
// raw pixels) into a short human-readable interpretation plus a plain-text
// phrase suitable for a real web image search. This is the "AI understands
// the drawing" step for the internet UI-image search feature; it has
// nothing to do with, and never touches, the live-website matcher/crawler.

import { z } from "zod";
import { getMatchableSections } from "@/lib/layout/normalize";
import type { LayoutNode, Wireframe } from "@/lib/layout/types";

// Google renames/retires Gemini model ids over time (and even a model that
// still LISTS as available can turn out to be retired the moment you call
// it), so a hardcoded model name is exactly the kind of thing that silently
// starts 404ing. These are just a fast-path starting guess — the real
// resilience is in understandWireframe(): a 404's error message usually
// names the replacement model directly ("...use models/X instead"), which
// is read and tried next; only if that isn't available does it fall back
// to asking ListModels what this key can actually use.
const GEMINI_MODEL_CANDIDATES = ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash"];
const FETCH_TIMEOUT_MS = 15000;
const MAX_MODEL_ATTEMPTS = 6;

export interface WireframeUnderstanding {
  /** Short bullet points describing what was drawn — the main container, then each notable region by position/count/arrangement, ending with one "Overall: ..." synthesis bullet. */
  summary: string[];
  searchQuery: string;
}

export interface GeminiUnderstandingResult {
  understanding: WireframeUnderstanding | null;
  /** Always populated, human-readable — surfaced to the caller so a failed/misconfigured run says exactly why, not just "nothing happened". */
  diagnostic: string;
}

const understandingSchema = z.object({
  summary: z.array(z.string().min(1)).min(1),
  searchQuery: z.string().min(1),
});

/** Strips ids (internal, meaningless to the model) so the prompt stays small and clean. */
function sanitizeForPrompt(node: LayoutNode): Omit<LayoutNode, "id" | "children"> & { children: unknown[] } {
  const { id: _id, children, ...rest } = node;
  return { ...rest, children: children.map(sanitizeForPrompt) };
}

function buildPrompt(wireframe: Wireframe): string {
  const sections = getMatchableSections(wireframe).map(sanitizeForPrompt);
  return `You are looking at the GEOMETRY of a rough wireframe sketch for ONE SECTION OF A PUBLIC MARKETING/CONTENT WEBSITE PAGE (e.g. a landing page, product page, or content site) — box positions and sizes only (0-1 ratios within their parent), never an actual image or real text/colors. This is explicitly NOT an admin dashboard, analytics panel, or software app screen — do not describe or search for one, even if the shapes could resemble one. Each section is a JSON tree of boxes; "kind" is one of root/section/row/column/repeated_group/box (a plain box carries no type — the designer never labeled it), "repeat" marks a repeated set of items, and x/y/width/height are 0-1 ratios.

Wireframe section(s):
${JSON.stringify(sections)}

Based ONLY on this geometry, respond with STRICT JSON, no markdown, no commentary, matching exactly this shape:
{
  "summary": [
    "one short bullet naming the main container/card",
    "one short bullet per other notable region, by position (top/left/right/center) and, if repeated, its count and arrangement — e.g. \\"4 small items on the left, arranged 2 x 2\\" or \\"a wide element at the top\\"",
    "3-5 bullets total covering the layout's distinct regions",
    "one final bullet starting with 'Overall:' giving a short label for the whole pattern, e.g. \\"Overall: two-column feature/content layout\\""
  ],
  "searchQuery": "a short, effective web search phrase (5-12 words) for finding real WEBSITE PAGE SECTION examples matching this layout — end with words like \\"website section design\\" or \\"landing page UI design\\"; never use the word \\"dashboard\\" or describe data tables/charts/admin panels"
}
Each summary bullet is one short plain sentence or fragment — no markdown, no numbering, no node ids or ratios, and no mention of dashboards/admin panels/software app screens.`;
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

/** Google's 404 messages for a retired model usually name the replacement directly, e.g. "...update your code to use models/gemini-3.6-flash...". Reading it beats hardcoding a version number that will just as surely go stale. */
function extractSuggestedModel(message: string): string | undefined {
  const match = message.match(/use\s+models\/([\w.-]+)/i);
  return match?.[1];
}

/**
 * Last resort when every candidate (hardcoded + suggested-by-error) 404s:
 * ask Google directly which models this specific key can actually use,
 * rather than guessing more names. Prefers a "flash" model (fast/cheap) if
 * more than one qualifies, and skips anything already tried and failed.
 */
async function discoverAvailableModel(
  apiKey: string,
  exclude: Set<string>
): Promise<{ model: string | null; diagnostic: string }> {
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

  const usable = (data.models ?? [])
    .filter(
      (m): m is { name: string; supportedGenerationMethods?: string[] } =>
        typeof m.name === "string" && Boolean(m.supportedGenerationMethods?.includes("generateContent"))
    )
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((name) => !exclude.has(name));

  const chosen = usable.find((name) => name.includes("flash")) ?? usable[0];
  if (!chosen) {
    return { model: null, diagnostic: "This API key has no untried model available that supports generateContent" };
  }
  return { model: chosen, diagnostic: "ok" };
}

interface GeminiAttempt {
  understanding: WireframeUnderstanding | null;
  diagnostic: string;
  /** True only for "this model name isn't available for this key" (HTTP 404) — worth trying another model. Any other failure is reported as-is. */
  retryNextModel: boolean;
  /** A replacement model name Google's own error message pointed at, if any — tried next, ahead of the remaining hardcoded guesses. */
  suggestedModel?: string;
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
    let suggestedModel: string | undefined;
    try {
      const errorBody = (await res.json()) as GeminiErrorBody;
      if (errorBody.error?.message) {
        detail = ` — ${errorBody.error.message}`;
        suggestedModel = extractSuggestedModel(errorBody.error.message);
      }
    } catch {
      // Body wasn't JSON (or had no error.message) — report the bare status only.
    }
    return {
      understanding: null,
      diagnostic: `Gemini responded with HTTP ${res.status} for model "${model}"${detail}`,
      retryNextModel: res.status === 404,
      suggestedModel,
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

/**
 * Fails open (null understanding + a diagnostic) on any error — this is one
 * optional feature among several, never something that should crash the
 * page. Tries, in order: the hardcoded candidates (jumping ahead to
 * whatever replacement model a 404's own error message names, as soon as
 * it names one — including one suggested by a model ListModels itself
 * offered, since a listed model can still turn out to be retired the
 * moment it's actually called); then, once those are exhausted, asks
 * ListModels once for anything else usable. Capped so a pathological chain
 * of suggestions can't loop forever.
 */
export async function understandWireframe(wireframe: Wireframe): Promise<GeminiUnderstandingResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { understanding: null, diagnostic: "GEMINI_API_KEY is not set — internet image search is inactive." };
  }

  const prompt = buildPrompt(wireframe);
  const tried = new Set<string>();
  const queue = [...GEMINI_MODEL_CANDIDATES];
  let lastDiagnostic = "Gemini returned no understanding for this wireframe";
  let askedListModels = false;

  while (tried.size < MAX_MODEL_ATTEMPTS) {
    if (queue.length === 0) {
      if (askedListModels) break;
      askedListModels = true;
      const discovered = await discoverAvailableModel(apiKey, tried);
      if (!discovered.model) {
        lastDiagnostic = `${lastDiagnostic} (then: ${discovered.diagnostic})`;
        break;
      }
      queue.push(discovered.model);
      continue;
    }

    const model = queue.shift() as string;
    if (tried.has(model)) continue;
    tried.add(model);

    const attempt = await callGemini(model, prompt, apiKey);
    if (attempt.retryNextModel) {
      lastDiagnostic = attempt.diagnostic;
      if (attempt.suggestedModel && !tried.has(attempt.suggestedModel)) {
        queue.unshift(attempt.suggestedModel);
      }
      continue;
    }
    return { understanding: attempt.understanding, diagnostic: attempt.diagnostic };
  }

  return { understanding: null, diagnostic: lastDiagnostic };
}
