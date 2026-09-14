// Splits a page into candidate sections using geometry alone — never by
// tag names, ids, or text.
//
// This walks the ENTIRE rendered tree, not just the page's direct
// top-level children. Looking only at direct children treats a real,
// complex page (Apple/GitHub/Webflow-scale sites in particular) as a
// handful of giant wrapper divs, each silently containing dozens of
// unrelated sub-blocks (hero + feature grid + testimonials + footer nav
// all flattened into one 30+-child "section"). A designer's wireframe is
// a small, focused composition — comparing it against one of those mega-
// blocks dilutes any real match into noise. Walking the whole tree lets
// a specific, appropriately-sized sub-region (e.g. exactly the 4-card
// grid, or exactly a text/image split) become its own independently
// scoreable candidate — which is what a section actually is.

import type { RawDomNode } from "./extract";

const MIN_SECTION_HEIGHT = 60;
const MIN_WIDTH_RATIO = 0.35;
const MIN_SECTION_CHILDREN = 1;
// A node with more children than this reads as "a big chunk of the page
// containing several sections", not one section — recurse past it
// instead of treating it as a single candidate.
const MAX_SECTION_CHILDREN = 14;
const MAX_SECTIONS = 60;
// Skip a candidate whose box is essentially identical to one already
// collected (a redundant wrapper at another tree level) — keeps the
// index from filling up with near-duplicate screenshots of the same
// visual region.
const DUPLICATE_OVERLAP_THRESHOLD = 0.97;

function boxArea(n: RawDomNode): number {
  return n.width * n.height;
}

function overlapRatio(a: RawDomNode, b: RawDomNode): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = boxArea(a) + boxArea(b) - intersection;
  return union > 0 ? intersection / union : 0;
}

function isPlausibleSection(node: RawDomNode, viewportWidth: number): boolean {
  return (
    node.height >= MIN_SECTION_HEIGHT &&
    node.width >= viewportWidth * MIN_WIDTH_RATIO &&
    node.children.length >= MIN_SECTION_CHILDREN &&
    node.children.length <= MAX_SECTION_CHILDREN
  );
}

function walkForCandidates(node: RawDomNode, viewportWidth: number, out: RawDomNode[]): void {
  if (isPlausibleSection(node, viewportWidth)) {
    const isDuplicate = out.some((existing) => overlapRatio(existing, node) >= DUPLICATE_OVERLAP_THRESHOLD);
    if (!isDuplicate) out.push(node);
  }
  // Recurse regardless of whether this node qualified — a mega-wrapper
  // that got excluded for having too many children is exactly the case
  // where its individual children (the real sections) still need finding.
  for (const child of node.children) {
    walkForCandidates(child, viewportWidth, out);
  }
}

export function detectSectionCandidates(root: RawDomNode | null, viewportWidth: number): RawDomNode[] {
  if (!root) return [];

  const candidates: RawDomNode[] = [];
  walkForCandidates(root, viewportWidth, candidates);

  // Sparse/unusual page where nothing qualified — fall back to the whole
  // page as one section rather than returning nothing.
  if (candidates.length === 0) return [root];

  return candidates.sort((a, b) => a.y - b.y || boxArea(b) - boxArea(a)).slice(0, MAX_SECTIONS);
}
