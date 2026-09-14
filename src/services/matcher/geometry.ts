// Geometry similarity: how close are the actual proportions — aspect
// ratio, relative sizes, positions of children — once both sides are
// already normalized to 0..1. This is where "a 1200px hero and a 1440px
// hero with the same proportions" gets treated as a strong match.

import type { LayoutNode } from "@/lib/layout/types";
import { ratioSimilarity, clamp01 } from "./util";

export function geometrySimilarity(a: LayoutNode, b: LayoutNode): number {
  const aspectA = a.width / (a.height || 1e-6);
  const aspectB = b.width / (b.height || 1e-6);
  const aspectScore = ratioSimilarity(aspectA, aspectB);

  const countScore = ratioSimilarity(a.children.length, b.children.length);

  const maxChildren = Math.max(a.children.length, b.children.length);
  if (maxChildren === 0) {
    return 0.5 * aspectScore + 0.5 * countScore;
  }

  // As in structural.ts: walk to the longer side so an unmatched child
  // pulls the average down rather than being skipped.
  let posSizeTotal = 0;
  for (let i = 0; i < maxChildren; i++) {
    const ca = a.children[i];
    const cb = b.children[i];
    if (!ca || !cb) continue;
    const wScore = ratioSimilarity(ca.width, cb.width);
    const hScore = ratioSimilarity(ca.height, cb.height);
    const xScore = clamp01(1 - Math.abs(ca.x - cb.x));
    const yScore = clamp01(1 - Math.abs(ca.y - cb.y));
    posSizeTotal += (wScore + hScore + xScore + yScore) / 4;
  }
  const avgPosSize = posSizeTotal / maxChildren;

  return 0.2 * aspectScore + 0.15 * countScore + 0.65 * avgPosSize;
}
