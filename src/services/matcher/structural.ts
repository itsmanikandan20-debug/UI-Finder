// Structural similarity: does the SHAPE of the tree match — same rough
// kind of node, similar branching, similar repeat counts — independent
// of exact pixel geometry (that's geometry.ts's job).

import type { LayoutNode, NodeKind } from "@/lib/layout/types";
import { ratioSimilarity } from "./util";
import { bestPairingScore } from "./pairing";

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

  // Match each child to its best real counterpart on the other side
  // (by kind and substructure), not by array position. A candidate
  // section that's missing a heading the wireframe has, or has its
  // children in a different order, would otherwise get its children
  // compared against the wrong index-aligned neighbor — scoring an
  // exact structural match poorly just because something was inserted
  // or removed earlier in the list. Unmatched children (when counts
  // differ) count as zero, still pulling the average down as before.
  const avgPair = bestPairingScore(a.children, b.children, structuralSimilarity);

  return 0.2 * kindScore + 0.15 * countScore + 0.1 * repeatScore + 0.55 * avgPair;
}
