// Spacing/alignment similarity: gap consistency and how children line up
// on their cross-axis (start/center/end/stretch) across the whole subtree.

import type { Alignment, LayoutNode } from "@/lib/layout/types";
import { average, ratioSimilarity } from "./util";

function collectGaps(node: LayoutNode, out: number[]): void {
  if (typeof node.meta?.gap === "number") out.push(node.meta.gap);
  for (const child of node.children) collectGaps(child, out);
}

function emptyAlignmentCounts(): Record<Alignment, number> {
  return { start: 0, center: 0, end: 0, stretch: 0, mixed: 0 };
}

function collectAlignments(node: LayoutNode, out: Record<Alignment, number>): void {
  if (node.meta?.alignment) out[node.meta.alignment] += 1;
  for (const child of node.children) collectAlignments(child, out);
}

function alignmentCosine(a: Record<Alignment, number>, b: Record<Alignment, number>): number {
  const keys: Alignment[] = ["start", "center", "end", "stretch", "mixed"];
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const k of keys) {
    dot += a[k] * b[k];
    normA += a[k] * a[k];
    normB += b[k] * b[k];
  }
  if (normA === 0 && normB === 0) return 1; // neither side had any grouped children
  if (normA === 0 || normB === 0) return 0.3;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function spacingSimilarity(a: LayoutNode, b: LayoutNode): number {
  const gapsA: number[] = [];
  const gapsB: number[] = [];
  collectGaps(a, gapsA);
  collectGaps(b, gapsB);
  const gapScore =
    gapsA.length === 0 && gapsB.length === 0
      ? 1
      : ratioSimilarity(average(gapsA), average(gapsB));

  const alignA = emptyAlignmentCounts();
  const alignB = emptyAlignmentCounts();
  collectAlignments(a, alignA);
  collectAlignments(b, alignB);
  const alignScore = alignmentCosine(alignA, alignB);

  return 0.5 * gapScore + 0.5 * alignScore;
}
