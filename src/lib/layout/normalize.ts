// Converts the editor's flat, absolute-pixel EditorDocument into the
// normalized LayoutNode tree the matcher operates on. This is the one
// place raw pixels get thrown away in favor of ratios — from here on,
// a 1200px-wide section and a 1440px-wide section with the same
// proportions are indistinguishable, which is the point.

import { computeAlignment, computeGap, isHorizontalSequence, toRatio, unionBox, type Box } from "./geometry";
import { detectRepeatedGroups } from "./repeats";
import type {
  EditorDocument,
  EditorElement,
  EditorElementKind,
  LayoutNode,
  LayoutNodeMeta,
  Wireframe,
} from "./types";

function leafMeta(kind: EditorElementKind): LayoutNodeMeta | undefined {
  if (kind === "image") return { hasImage: true };
  if (kind === "heading" || kind === "text" || kind === "button") return { hasText: true };
  return undefined;
}

function buildNode(
  el: EditorElement,
  parentBox: Box,
  byParent: Map<string, EditorElement[]>
): LayoutNode {
  const ratio = toRatio(el, parentBox);
  const ownBox: Box = { x: el.x, y: el.y, width: el.width, height: el.height };
  const kids = byParent.get(el.id) ?? [];
  return {
    id: el.id,
    kind: el.kind,
    x: ratio.x,
    y: ratio.y,
    width: ratio.width,
    height: ratio.height,
    children: buildChildren(kids, ownBox, byParent),
    meta: leafMeta(el.kind),
  };
}

function buildChildren(
  kids: EditorElement[],
  parentBox: Box,
  byParent: Map<string, EditorElement[]>
): LayoutNode[] {
  if (kids.length === 0) return [];

  const { groups, ungrouped } = detectRepeatedGroups(kids);
  const nodes: LayoutNode[] = [];

  for (const group of groups) {
    const groupBox = unionBox(group);
    const ratio = toRatio(groupBox, parentBox);
    const direction: "horizontal" | "vertical" = isHorizontalSequence(group)
      ? "horizontal"
      : "vertical";
    const items = [...group]
      .sort((a, b) => (direction === "horizontal" ? a.x - b.x : a.y - b.y))
      .map((item) => buildNode(item, groupBox, byParent));

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
    nodes.push(buildNode(el, parentBox, byParent));
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
      children: buildChildren(topLevel, artboardBox, byParent),
    },
    createdAt,
  };
}

/**
 * The matcher compares section-sized units, not whole pages. If the
 * designer wrapped parts of the sketch in explicit "section" containers,
 * use those; otherwise treat the whole wireframe as a single section so
 * a quick unsectioned sketch still works.
 */
export function getMatchableSections(wireframe: Wireframe): LayoutNode[] {
  const explicit = wireframe.root.children.filter((n) => n.kind === "section");
  if (explicit.length > 0) return explicit;
  return [wireframe.root];
}
