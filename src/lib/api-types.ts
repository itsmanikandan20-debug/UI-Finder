import type { ScoreBreakdown } from "@/services/matcher/score";
import type { Wireframe } from "@/lib/layout/types";

export interface SearchRequestBody {
  wireframe: Wireframe;
}

export interface SearchMatch {
  domain: string;
  websiteTitle?: string;
  pageUrl: string;
  screenshotUrl?: string;
  score: ScoreBreakdown;
  /** Best-effort deep link to the exact matched section — see src/lib/section-anchor.ts. */
  openUrl: string;
  /** True when openUrl can actually scroll to the section (Chrome/Edge text fragment); false means it just opens the page. */
  hasPreciseAnchor: boolean;
  /** Shown when hasPreciseAnchor is false, e.g. "≈34% down the page". */
  approxPagePosition?: string;
  /** The section's original box on the crawled page (CSS px at viewportWidth) — the exact region the screenshot/score came from. */
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface SectionSearchResult {
  wireframeSectionId: string;
  matches: SearchMatch[];
}

export interface SearchApiResponse {
  results: SectionSearchResult[];
  indexedSectionCount: number;
  warnings: string[];
}

// --- Internet UI-image search (additive to live-website matching) --------

export interface ImageSearchRequestBody {
  wireframe: Wireframe;
}

export interface WireframeUnderstanding {
  detectedPattern: string;
  structure: string;
  layout: string;
  searchQuery: string;
}

export interface ImageSearchResultItem {
  imageUrl: string;
  thumbnailUrl?: string;
  sourceUrl: string;
  sourceTitle?: string;
}

export interface ImageSearchApiResponse {
  /** False when GEMINI_API_KEY and/or SERPAPI_API_KEY aren't set — the feature is inactive, not broken. */
  configured: boolean;
  /** Human-readable status — set whenever there's nothing to show (not configured, Gemini/SerpApi failed, or zero results). */
  message?: string;
  understanding: WireframeUnderstanding | null;
  images: ImageSearchResultItem[];
}
