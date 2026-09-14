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
