// A deterministic, fixed-length numeric fingerprint of a LayoutNode
// subtree — NOT a learned/pretrained embedding. It exists purely to let
// a large section index be pre-filtered cheaply (pgvector ANN search, or
// a plain cosine scan for the small local dataset) before the expensive
// detailed structural/geometry comparison in services/matcher runs on
// just the shortlist. Every dimension here is a plain, explainable
// statistic — aspect ratio, child-count, kind mix, repeat count, etc.

import type { LayoutNode, NodeKind } from "./types";

export const SIGNATURE_LENGTH = 32;

const KIND_ORDER: NodeKind[] = [
  "section",
  "row",
  "column",
  "repeated_group",
  "heading",
  "text",
  "image",
  "button",
  "box",
];

interface TreeStats {
  nodeCount: number;
  leafCount: number;
  maxDepth: number;
  repeatedGroupCount: number;
  maxRepeatCount: number;
  kindCounts: Map<NodeKind, number>;
  imageLeaves: number;
  textLeaves: number;
  widthRatios: number[];
  heightRatios: number[];
  gaps: number[];
}

function walk(node: LayoutNode, depth: number, stats: TreeStats): void {
  stats.nodeCount += 1;
  stats.maxDepth = Math.max(stats.maxDepth, depth);
  stats.kindCounts.set(node.kind, (stats.kindCounts.get(node.kind) ?? 0) + 1);

  if (node.kind === "repeated_group") {
    stats.repeatedGroupCount += 1;
    stats.maxRepeatCount = Math.max(stats.maxRepeatCount, node.repeat?.count ?? 0);
  }
  if (typeof node.meta?.gap === "number") stats.gaps.push(node.meta.gap);
  if (node.meta?.hasImage) stats.imageLeaves += 1;
  if (node.meta?.hasText) stats.textLeaves += 1;

  if (node.children.length === 0) {
    stats.leafCount += 1;
  } else {
    stats.widthRatios.push(...node.children.map((c) => c.width));
    stats.heightRatios.push(...node.children.map((c) => c.height));
    for (const child of node.children) walk(child, depth + 1, stats);
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function clamp01(v: number): number {
  if (Number.isNaN(v) || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function layoutSignature(node: LayoutNode): number[] {
  const stats: TreeStats = {
    nodeCount: 0,
    leafCount: 0,
    maxDepth: 0,
    repeatedGroupCount: 0,
    maxRepeatCount: 0,
    kindCounts: new Map(),
    imageLeaves: 0,
    textLeaves: 0,
    widthRatios: [],
    heightRatios: [],
    gaps: [],
  };
  walk(node, 0, stats);

  const aspect = node.height > 0 ? node.width / node.height : 1;
  const vec: number[] = [
    clamp01(Math.log(aspect + 1) / Math.log(6)), // squashed aspect ratio
    clamp01(1 - 1 / (1 + stats.nodeCount)), // overall size of the tree
    clamp01(1 - 1 / (1 + stats.leafCount)),
    clamp01(stats.maxDepth / 6),
    clamp01(1 - 1 / (1 + stats.repeatedGroupCount)),
    clamp01(stats.maxRepeatCount / 8),
    clamp01(stats.leafCount > 0 ? stats.imageLeaves / stats.leafCount : 0),
    clamp01(stats.leafCount > 0 ? stats.textLeaves / stats.leafCount : 0),
    clamp01(average(stats.widthRatios)),
    clamp01(average(stats.heightRatios)),
    clamp01(average(stats.gaps) * 5),
  ];

  for (const kind of KIND_ORDER) {
    vec.push(clamp01((stats.kindCounts.get(kind) ?? 0) / Math.max(1, stats.nodeCount)));
  }

  while (vec.length < SIGNATURE_LENGTH) vec.push(0);
  return vec.slice(0, SIGNATURE_LENGTH);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
