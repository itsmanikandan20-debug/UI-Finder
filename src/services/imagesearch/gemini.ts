// Turns the *geometry* of a wireframe (the same normalized LayoutNode tree
// the matcher uses for live-website matching — never a rendered image, never
// raw pixels) into a short human-readable interpretation plus a plain-text
// phrase suitable for a real web image search. This is the "AI understands
// the drawing" step for the internet UI-image search feature; it has
// nothing to do with, and never touches, the live-website matcher/crawler.

import { z } from "zod";
import { getMatchableSections } from "@/lib/layout/normalize";
import type { LayoutNode, Wireframe } from "@/lib/layout/types";

const GEMINI_MODEL = "gemini-2.0-flash";
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

/** Fails open (null understanding + a diagnostic) on any error — this is one optional feature among several, never something that should crash the page. */
export async function understandWireframe(wireframe: Wireframe): Promise<GeminiUnderstandingResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { understanding: null, diagnostic: "GEMINI_API_KEY is not set — internet image search is inactive." };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;
  const body = {
    contents: [{ parts: [{ text: buildPrompt(wireframe) }] }],
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
    return { understanding: null, diagnostic: `network error reaching Gemini: ${message}` };
  }

  if (!res.ok) {
    return { understanding: null, diagnostic: `Gemini responded with HTTP ${res.status}` };
  }

  let data: GeminiApiResponse;
  try {
    data = (await res.json()) as GeminiApiResponse;
  } catch {
    return { understanding: null, diagnostic: "Gemini response was not valid JSON" };
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const blockReason = data.promptFeedback?.blockReason;
    return {
      understanding: null,
      diagnostic: blockReason
        ? `Gemini declined to respond (${blockReason})`
        : "Gemini returned no understanding for this wireframe",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { understanding: null, diagnostic: "Gemini's reply was not valid JSON" };
  }

  const result = understandingSchema.safeParse(parsed);
  if (!result.success) {
    return { understanding: null, diagnostic: "Gemini's reply did not match the expected format" };
  }

  return { understanding: result.data, diagnostic: "ok" };
}
