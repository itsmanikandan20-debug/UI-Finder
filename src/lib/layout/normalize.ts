// Converts the editor's flat, absolute-pixel EditorDocument into the
// normalized LayoutNode tree the matcher operates on. This is the one
// place raw pixels get thrown away in favor of ratios — from here on,
// a 1200px-wide section and a 1440px-wide section with the same
// proportions are indistinguishable, which is the point.
//
// Two authoring paths feed the same tree: a shape explicitly typed via
// the toolbar (el.kind is set — used as authored, exactly like before
// free-hand drawing existed) and a free-hand drawn shape (el.kind is
// absent — structure inferred from geometry alone: a box containing
// others becomes a container, a top-level one a matchable "section", a
// nested one a "row"/"column" depending on how its children are
// arranged; childless is a plain "box" leaf).

import { computeAlignment, computeGap, isHorizontalSequence, toRatio, unionBox, type Box } from "./geometry";
import { detectRepeatedGroups } from "./repeats";
import type { EditorDocument, EditorElement, EditorElementKind, LayoutNode, LayoutNodeMeta, NodeKind, Wireframe } from "./types";

function leafMeta(kind: EditorElementKind): LayoutNodeMeta | undefined {
  if (kind === "image") return { hasImage: true };
  if (kind === "heading" || kind === "text" || kind === "button") return { hasText: true };
  return undefined;
}

function buildNode(
  el: EditorElement,
  parentBox: Box,
  byParent: Map<string, EditorElement[]>,
  isTopLevel: boolean
): LayoutNode {
  const ratio = toRatio(el, parentBox);
  const ownBox: Box = { x: el.x, y: el.y, width: el.width, height: el.height };
  const kids = byParent.get(el.id) ?? [];
  const children = buildChildren(kids, ownBox, byParent, false);

  if (el.kind) {
    // Explicitly typed via the toolbar — the designer said what this is, so use it as authored regardless of nesting depth.
    return {
      id: el.id,
      kind: el.kind,
      x: ratio.x,
      y: ratio.y,
      width: ratio.width,
      height: ratio.height,
      children,
      meta: leafMeta(el.kind),
    };
  }

  const kind: NodeKind = kids.length === 0 ? "box" : isTopLevel ? "section" : isHorizontalSequence(kids) ? "row" : "column";
  return { id: el.id, kind, x: ratio.x, y: ratio.y, width: ratio.width, height: ratio.height, children };
}

/**
 * detectRepeatedGroups's auto-detect step buckets by `kind` first, then
 * checks size similarity within each bucket. For an explicitly typed
 * shape that bucket key is its real type (matches how the crawler groups
 * real DOM elements — a set of same-type siblings of similar size);
 * for a free-hand shape (no type at all) it's built from rounded size
 * instead, so a big wrapper still separates from a row of small
 * similarly-sized cards before the fine-grained check runs. Typed and
 * free-hand siblings never accidentally group with each other, since
 * their keys come from different spaces.
 */
function sizeBucket(el: Box): string {
  const round = (n: number) => Math.round(n / 40);
  return `size:${round(el.width)}x${round(el.height)}`;
}

function groupKey(el: EditorElement): string {
  return el.kind ?? sizeBucket(el);
}

function buildChildren(
  kids: EditorElement[],
  parentBox: Box,
  byParent: Map<string, EditorElement[]>,
  isTopLevel: boolean
): LayoutNode[] {
  if (kids.length === 0) return [];

  // A minimal, separate shape for detectRepeatedGroups — its grouping
  // key is derived (real kind, or a size bucket), not a real
  // EditorElementKind, so it can't just override `kind` on the real
  // element and stay assignable back to EditorElement. Original elements
  // are looked up by id afterward.
  const byId = new Map(kids.map((k) => [k.id, k]));
  const groupable = kids.map((k) => ({
    id: k.id,
    kind: groupKey(k),
    x: k.x,
    y: k.y,
    width: k.width,
    height: k.height,
    groupId: k.groupId,
  }));
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
      .map((item) => buildNode(byId.get(item.id) as EditorElement, groupBox, byParent, false));

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

  for (const g of ungrouped) {
    nodes.push(buildNode(byId.get(g.id) as EditorElement, parentBox, byParent, isTopLevel));
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
 * The matcher compares section-sized units, not whole pages. Explicit
 * "Section" shapes, and any top-level free-hand shape that wraps other
 * shapes, both become "section" nodes automatically — use those;
 * otherwise treat the whole wireframe as a single section so a quick
 * unsectioned sketch still works.
 */
export function getMatchableSections(wireframe: Wireframe): LayoutNode[] {
  const explicit = wireframe.root.children.filter((n) => n.kind === "section");
  if (explicit.length > 0) return explicit;
  return [wireframe.root];
}
