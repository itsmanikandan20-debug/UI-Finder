// Converts a RawDomNode subtree (crawler-side) into the same LayoutNode
// shape the wireframe editor produces (src/lib/layout/normalize.ts). Same
// repeated-group detection, same gap/alignment math — the whole point is
// that the matcher can't tell which side a tree came from.

import { randomUUID } from "node:crypto";
import {
  computeAlignment,
  computeGap,
  isHorizontalSequence,
  toRatio,
  unionBox,
  type Box,
} from "@/lib/layout/geometry";
import { detectRepeatedGroups } from "@/lib/layout/repeats";
import type { LayoutNode, LayoutNodeMeta, NodeKind } from "@/lib/layout/types";
import type { RawDomNode } from "./extract";

function kindOf(raw: RawDomNode): NodeKind {
  if (raw.isImage) return "image";
  if (/^h[1-6]$/.test(raw.tag)) return "heading";
  if (raw.tag === "button") return "button";
  if (raw.hasOwnText) return "text";
  if (raw.children.length > 0) {
    const boxes = raw.children.map((c) => ({ x: c.x, y: c.y, width: c.width, height: c.height }));
    return isHorizontalSequence(boxes) ? "row" : "column";
  }
  return "box";
}

interface Groupable extends Box {
  id: string;
  kind: string;
  raw: RawDomNode;
}

function buildChildren(rawChildren: RawDomNode[], parentBox: Box): LayoutNode[] {
  if (rawChildren.length === 0) return [];

  const groupable: Groupable[] = rawChildren.map((r) => ({
    id: randomUUID(),
    kind: kindOf(r),
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    raw: r,
  }));

  const { groups, ungrouped } = detectRepeatedGroups(groupable);
  const nodes: LayoutNode[] = [];

  for (const group of groups) {
    const groupBox = unionBox(group);
    const ratio = toRatio(groupBox, parentBox);
    const direction: "horizontal" | "vertical" = isHorizontalSequence(group) ? "horizontal" : "vertical";
    const items = [...group]
      .sort((a, b) => (direction === "horizontal" ? a.x - b.x : a.y - b.y))
      .map((g) => buildNode(g.raw, groupBox));

    nodes.push({
      id: randomUUID(),
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
    nodes.push(buildNode(g.raw, parentBox));
  }

  nodes.sort((a, b) => a.y - b.y || a.x - b.x);
  return nodes;
}

function buildNode(raw: RawDomNode, parentBox: Box): LayoutNode {
  const ratio = toRatio(raw, parentBox);
  const ownBox: Box = { x: raw.x, y: raw.y, width: raw.width, height: raw.height };
  const kind = kindOf(raw);
  const children = buildChildren(raw.children, ownBox);

  const meta: LayoutNodeMeta = {};
  if (raw.isImage) meta.hasImage = true;
  if (raw.hasOwnText) meta.hasText = true;
  if (raw.children.length > 1) {
    const boxes = raw.children.map((c) => ({ x: c.x, y: c.y, width: c.width, height: c.height }));
    const direction = isHorizontalSequence(boxes) ? "horizontal" : "vertical";
    meta.gap = computeGap(boxes, direction, ownBox);
    meta.alignment = computeAlignment(boxes, direction, ownBox);
  }

  return {
    id: randomUUID(),
    kind,
    x: ratio.x,
    y: ratio.y,
    width: ratio.width,
    height: ratio.height,
    children,
    meta: Object.keys(meta).length > 0 ? meta : undefined,
  };
}

/** Converts a detected section's raw subtree into a section-rooted LayoutNode (0..1 relative to itself). */
export function rawSectionToLayoutNode(raw: RawDomNode): LayoutNode {
  const ownBox: Box = { x: raw.x, y: raw.y, width: raw.width, height: raw.height };
  const node = buildNode(raw, ownBox);
  return { ...node, kind: "section" };
}
