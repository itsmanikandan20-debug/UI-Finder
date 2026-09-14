// Converts the editor's flat, absolute-pixel EditorDocument into the
// normalized LayoutNode tree the matcher operates on. This is the one
// place raw pixels get thrown away in favor of ratios — from here on,
// a 1200px-wide section and a 1440px-wide section with the same
// proportions are indistinguishable, which is the point.
//
// The designer never tags a shape's type (no Section/Row/Heading/Image
// picker) — every EditorElement is just a bounding box. Structure is
// inferred from geometry alone: a box containing others becomes a
// container (a top-level one is a matchable "section"; a nested one is a
// "row" or "column" depending on how its children are arranged); a box
// with nothing inside it is a plain leaf ("box"). Repetition detection
// (repeats.ts) already worked this way — grouping by size, not by a kind
// tag someone typed in — so it's unaffected.

import { computeAlignment, computeGap, isHorizontalSequence, toRatio, unionBox, type Box } from "./geometry";
import { detectRepeatedGroups } from "./repeats";
import type { EditorDocument, EditorElement, LayoutNode, NodeKind, Wireframe } from "./types";

function buildNode(
  el: EditorElement,
  parentBox: Box,
  byParent: Map<string, EditorElement[]>,
  isTopLevel: boolean
): LayoutNode {
  const ratio = toRatio(el, parentBox);
  const ownBox: Box = { x: el.x, y: el.y, width: el.width, height: el.height };
  const kids = byParent.get(el.id) ?? [];

  if (kids.length === 0) {
    return { id: el.id, kind: "box", x: ratio.x, y: ratio.y, width: ratio.width, height: ratio.height, children: [] };
  }

  const children = buildChildren(kids, ownBox, byParent, false);
  const kind: NodeKind = isTopLevel ? "section" : isHorizontalSequence(kids) ? "row" : "column";
  return { id: el.id, kind, x: ratio.x, y: ratio.y, width: ratio.width, height: ratio.height, children };
}

/**
 * detectRepeatedGroups's auto-detect step buckets by `kind` first, then
 * checks size similarity within each bucket — a coarse pre-filter that
 * matters when items carry a real, meaningful type (the crawler's real DOM
 * elements). Nothing here carries a type at all, so the bucket key is
 * built from rounded size instead: it still separates a big wrapper shape
 * from a row of small similarly-sized cards before the fine-grained
 * size check runs, rather than lumping everything into one bucket that
 * then fails the similarity check for having wildly different sizes.
 */
function sizeBucket(el: Box): string {
  const round = (n: number) => Math.round(n / 40);
  return `${round(el.width)}x${round(el.height)}`;
}

function buildChildren(
  kids: EditorElement[],
  parentBox: Box,
  byParent: Map<string, EditorElement[]>,
  isTopLevel: boolean
): LayoutNode[] {
  if (kids.length === 0) return [];

  const groupable = kids.map((k) => ({ ...k, kind: sizeBucket(k) }));
  const { groups, ungrouped } = detectRepeatedGroups(groupable);
  const nodes: LayoutNode[] = [];

  for (const group of groups) {
    const groupBox = unionBox(group);
    const ratio = toRatio(groupBox, parentBox);
    const direction: "horizontal" | "vertical" = isHorizontalSequence(group)
      ? "horizontal"
      : "vertical";
    const items = [...group]
      .sort((a, b) => (direction === "horizontal" ? a.x - b.x : a.y - b.y))
      .map((item) => buildNode(item, groupBox, byParent, false));

    nodes.push({
      id: `group-${group[0].id}`,
      kind: "repeated_group",
      x: ratio.x,
      y: ratio.y,
      width: ratio.width,
      height: ratio.height,
      children: items,
      repeat: { count: group.length, direction },
      meta: {
        gap: computeGap(group, direction, groupBox),
        alignment: computeAlignment(group, direction, groupBox),
      },
    });
  }

  for (const el of ungrouped) {
    nodes.push(buildNode(el, parentBox, byParent, isTopLevel));
  }

  nodes.sort((a, b) => a.y - b.y || a.x - b.x);
  return nodes;
}

export function normalizeWireframe(doc: EditorDocument, id: string, createdAt: string): Wireframe {
  const byParent = new Map<string, EditorElement[]>();
  for (const el of doc.elements) {
    if (el.parentId == null) continue;
    const list = byParent.get(el.parentId) ?? [];
    list.push(el);
    byParent.set(el.parentId, list);
  }

  const topLevel = doc.elements.filter((el) => el.parentId == null);
  const artboardBox: Box = { x: 0, y: 0, width: doc.artboardWidth, height: doc.artboardHeight };

  return {
    id,
    viewport: { width: doc.artboardWidth, label: doc.viewportLabel },
    root: {
      id: "root",
      kind: "root",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      children: buildChildren(topLevel, artboardBox, byParent, true),
    },
    createdAt,
  };
}

/**
 * The matcher compares section-sized units, not whole pages. If the
 * designer's drawing has top-level shapes that wrap other shapes, those
 * become "section" nodes automatically — use those; otherwise treat the
 * whole wireframe as a single section so a quick unsectioned sketch still
 * works.
 */
export function getMatchableSections(wireframe: Wireframe): LayoutNode[] {
  const explicit = wireframe.root.children.filter((n) => n.kind === "section");
  if (explicit.length > 0) return explicit;
  return [wireframe.root];
}
