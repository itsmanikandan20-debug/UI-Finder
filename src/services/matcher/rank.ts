// Two-stage retrieval: a cheap signature-vector pre-filter cuts the
// candidate pool down before the expensive detailed comparison runs —
// the same two-stage shape the pgvector-backed store uses in production,
// just done with a plain in-process cosine scan when the candidate list
// is already small (e.g. the local JSON store).

import type { ExtractedSection } from "@/lib/layout/types";
import type { LayoutNode } from "@/lib/layout/types";
import { cosineSimilarity, layoutSignature } from "@/lib/layout/signature";
import { scoreSections, DEFAULT_WEIGHTS, type ScoreBreakdown, type ScoreWeights } from "./score";

export interface RankedMatch {
  section: ExtractedSection;
  score: ScoreBreakdown;
}

export interface RankOptions {
  prefilterLimit?: number;
  topK?: number;
  weights?: ScoreWeights;
}

export function rankCandidates(
  wireframeSection: LayoutNode,
  candidates: ExtractedSection[],
  options: RankOptions = {}
): RankedMatch[] {
  const prefilterLimit = options.prefilterLimit ?? 200;
  const topK = options.topK ?? 10;
  const weights = options.weights ?? DEFAULT_WEIGHTS;

  const wireframeSig = layoutSignature(wireframeSection);

  const shortlisted = candidates
    .map((section) => ({ section, coarse: cosineSimilarity(wireframeSig, layoutSignature(section.root)) }))
    .sort((a, b) => b.coarse - a.coarse)
    .slice(0, prefilterLimit);

  const detailed: RankedMatch[] = shortlisted.map(({ section }) => ({
    section,
    score: scoreSections(wireframeSection, section.root, weights),
  }));

  detailed.sort((a, b) => b.score.similarity - a.score.similarity);
  return detailed.slice(0, topK);
}
