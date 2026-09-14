import type { LayoutNode } from "@/lib/layout/types";
import { structuralSimilarity } from "./structural";
import { geometrySimilarity } from "./geometry";
import { spacingSimilarity } from "./spacing";
import { contentMixProxyProvider, type VisualSimilarityProvider } from "./visual";
import { otherSignals } from "./other";
import { clamp01 } from "./util";

export interface ScoreWeights {
  structural: number;
  geometry: number;
  spacing: number;
  visual: number;
  other: number;
}

// Starting weights per the product spec — expected to be retuned once
// there's a real corpus of results to eyeball, not treated as final.
export const DEFAULT_WEIGHTS: ScoreWeights = {
  structural: 0.35,
  geometry: 0.3,
  spacing: 0.15,
  visual: 0.15,
  other: 0.05,
};

export interface ScoreBreakdown {
  structural: number;
  geometry: number;
  spacing: number;
  visual: number;
  other: number;
  /**
   * 0-100 internal similarity score — NOT a probability or a guarantee.
   * Surface it as "N similarity", never "N% match guaranteed".
   */
  similarity: number;
}

export function scoreSections(
  wireframeSection: LayoutNode,
  candidate: LayoutNode,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  visualProvider: VisualSimilarityProvider = contentMixProxyProvider
): ScoreBreakdown {
  const structural = structuralSimilarity(wireframeSection, candidate);
  const geometry = geometrySimilarity(wireframeSection, candidate);
  const spacing = spacingSimilarity(wireframeSection, candidate);
  const visual = visualProvider(wireframeSection, candidate);
  const other = otherSignals(wireframeSection, candidate);

  const weighted =
    structural * weights.structural +
    geometry * weights.geometry +
    spacing * weights.spacing +
    visual * weights.visual +
    other * weights.other;

  return {
    structural,
    geometry,
    spacing,
    visual,
    other,
    similarity: Math.round(clamp01(weighted) * 100),
  };
}
