// Structural similarity: does the SHAPE of the tree match — same rough
// kind of node, similar branching, similar repeat counts — independent
// of exact pixel geometry (that's geometry.ts's job).

import type { LayoutNode, NodeKind } from "@/lib/layout/types";
import { ratioSimilarity } from "./util";

const KIND_GROUPS: Record<NodeKind, NodeKind[]> = {
  root: ["root", "section"],
  section: ["section", "root", "column"],
  row: ["row", "repeated_group"],
  column: ["column", "section"],
  repeated_group: ["repeated_group", "row"],
  heading: ["heading", "text"],
  text: ["text", "heading", "button"],
  image: ["image", "box"],
  button: ["button", "text"],
  box: ["box", "image", "column"],
};

function kindCompatibility(a: NodeKind, b: NodeKind): number {
  if (a === b) return 1;
  if (KIND_GROUPS[a]?.includes(b) || KIND_GROUPS[b]?.includes(a)) return 0.55;
  return 0.15;
}

function repeatCompatibility(a: LayoutNode, b: LayoutNode): number {
  if (!a.repeat && !b.repeat) return 1;
  return ratioSimilarity(a.repeat?.count ?? 0, b.repeat?.count ?? 0);
}

export function structuralSimilarity(a: LayoutNode, b: LayoutNode): number {
  const kindScore = kindCompatibility(a.kind, b.kind);
  const aIsLeaf = a.children.length === 0;
  const bIsLeaf = b.children.length === 0;

  // Two leaves: the only meaningful signal left is what kind of
  // placeholder each one is (both text-ish, both image-ish, ...).
  if (aIsLeaf && bIsLeaf) {
    return 0.7 * kindScore + 0.3 * repeatCompatibility(a, b);
  }

  // One side has real substructure (a row/group/section) and the other
  // is a single placeholder — that's a genuine structural mismatch, only
  // worth a little credit even when the kinds are loosely related.
  if (aIsLeaf !== bIsLeaf) {
    return 0.25 * kindScore;
  }

  const countScore = ratioSimilarity(a.children.length, b.children.length);
  const repeatScore = repeatCompatibility(a, b);

  // Children are always kept sorted top-to-bottom/left-to-right by the
  // normalizer and the crawler alike, so positional pairing is a
  // reasonable stand-in for full tree-edit-distance alignment without
  // the combinatorial cost. Walk up to the LONGER side so a child with no
  // counterpart on the other side drags the average down instead of
  // being silently ignored.
  const maxChildren = Math.max(a.children.length, b.children.length);
  let pairTotal = 0;
  for (let i = 0; i < maxChildren; i++) {
    const ca = a.children[i];
    const cb = b.children[i];
    if (ca && cb) pairTotal += structuralSimilarity(ca, cb);
  }
  const avgPair = maxChildren > 0 ? pairTotal / maxChildren : 0;

  return 0.2 * kindScore + 0.15 * countScore + 0.1 * repeatScore + 0.55 * avgPair;
}
