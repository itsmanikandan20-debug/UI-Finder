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
