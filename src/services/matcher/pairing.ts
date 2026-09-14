// Greedy best-match pairing between two child lists, used by both
// structural.ts and geometry.ts instead of comparing by array index.
//
// Index-based pairing silently breaks whenever a candidate section is a
// subset of the wireframe (missing a heading it doesn't happen to
// contain) or has its children in a different order: the wireframe's
// card-row at position 1 gets compared against whatever the candidate
// happens to have at position 1, instead of the candidate's actual card
// row. That can make a genuinely tight, correct match score worse than a
// loose, coincidentally-index-aligned one — the opposite of what the
// score is supposed to reflect.
//
// This instead scores every possible pair once, then greedily takes the
// best-scoring remaining pair until one side runs out — a cheap
// approximation of optimal bipartite matching that's more than good
// enough at the small child counts (≤ a few dozen) LayoutNode trees
// actually have.

import type { LayoutNode } from "@/lib/layout/types";

export function bestPairingScore(
  a: LayoutNode[],
  b: LayoutNode[],
  scoreFn: (x: LayoutNode, y: LayoutNode) => number
): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  if (a.length === 0 || b.length === 0) return 0;

  const candidatePairs: { i: number; j: number; score: number }[] = [];
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      candidatePairs.push({ i, j, score: scoreFn(a[i], b[j]) });
    }
  }
  candidatePairs.sort((p, q) => q.score - p.score);

  const usedA = new Set<number>();
  const usedB = new Set<number>();
  let total = 0;
  for (const pair of candidatePairs) {
    if (usedA.has(pair.i) || usedB.has(pair.j)) continue;
    usedA.add(pair.i);
    usedB.add(pair.j);
    total += pair.score;
  }
  // Divide by the longer side: an unmatched child (when counts differ)
  // still drags the average down, exactly as index-based pairing did.
  return total / maxLen;
}
