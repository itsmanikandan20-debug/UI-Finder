// Geometry similarity: how close are the actual proportions — aspect
// ratio, relative sizes, positions of children — once both sides are
// already normalized to 0..1. This is where "a 1200px hero and a 1440px
// hero with the same proportions" gets treated as a strong match.

import type { LayoutNode } from "@/lib/layout/types";
import { ratioSimilarity, clamp01 } from "./util";
import { bestPairingScore } from "./pairing";

function childPositionSizeScore(ca: LayoutNode, cb: LayoutNode): number {
  const wScore = ratioSimilarity(ca.width, cb.width);
  const hScore = ratioSimilarity(ca.height, cb.height);
  const xScore = clamp01(1 - Math.abs(ca.x - cb.x));
  const yScore = clamp01(1 - Math.abs(ca.y - cb.y));
  return (wScore + hScore + xScore + yScore) / 4;
}

export function geometrySimilarity(a: LayoutNode, b: LayoutNode): number {
  const aspectA = a.width / (a.height || 1e-6);
  const aspectB = b.width / (b.height || 1e-6);
  const aspectScore = ratioSimilarity(aspectA, aspectB);

  const countScore = ratioSimilarity(a.children.length, b.children.length);

  if (a.children.length === 0 || b.children.length === 0) {
    return 0.5 * aspectScore + 0.5 * countScore;
  }

  // Best-match pairing, same rationale as structural.ts: a candidate
  // missing one sibling the wireframe has shouldn't get every remaining
  // child compared against the wrong index-shifted neighbor.
  const avgPosSize = bestPairingScore(a.children, b.children, childPositionSizeScore);

  return 0.2 * aspectScore + 0.15 * countScore + 0.65 * avgPosSize;
}
