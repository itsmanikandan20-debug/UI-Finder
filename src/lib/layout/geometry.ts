// Pure geometry helpers shared by the wireframe normalizer and the
// website crawler's section/repeat detection. Everything here works in
// whatever coordinate space it's given (pixels or 0..1 ratios) — callers
// decide which.

import type { Alignment } from "./types";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function approxEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function unionBox(boxes: Box[]): Box {
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.width));
  const y1 = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Express `box` as a ratio of `parent` — the core normalization step. */
export function toRatio(box: Box, parent: Box): Box {
  const w = parent.width || 1;
  const h = parent.height || 1;
  return {
    x: (box.x - parent.x) / w,
    y: (box.y - parent.y) / h,
    width: box.width / w,
    height: box.height / h,
  };
}

/** Does this set of boxes read as a horizontal sequence (row) or vertical (column)? */
export function isHorizontalSequence(items: Box[]): boolean {
  if (items.length < 2) return true;
  const xs = items.map((i) => i.x);
  const ys = items.map((i) => i.y);
  const xSpread = Math.max(...xs) - Math.min(...xs);
  const ySpread = Math.max(...ys) - Math.min(...ys);
  return xSpread >= ySpread;
}

export function computeGap(
  items: Box[],
  direction: "horizontal" | "vertical",
  bounds: Box
): number {
  if (items.length < 2) return 0;
  const sorted = [...items].sort((a, b) => (direction === "horizontal" ? a.x - b.x : a.y - b.y));
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap =
      direction === "horizontal"
        ? curr.x - (prev.x + prev.width)
        : curr.y - (prev.y + prev.height);
    gaps.push(gap);
  }
  const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const denom = direction === "horizontal" ? bounds.width : bounds.height;
  return denom > 0 ? avgGap / denom : 0;
}

export function computeAlignment(
  items: Box[],
  direction: "horizontal" | "vertical",
  bounds: Box
): Alignment {
  if (items.length === 0) return "start";
  const tol = 0.06;
  if (direction === "horizontal") {
    const crossTol = tol * (bounds.height || 1);
    const tops = items.map((i) => i.y - bounds.y);
    const bottoms = items.map((i) => i.y + i.height - bounds.y);
    const centers = items.map((i) => i.y + i.height / 2 - bounds.y);
    const heights = items.map((i) => i.height);
    if (heights.every((h) => approxEqual(h, bounds.height, crossTol))) return "stretch";
    if (tops.every((t) => approxEqual(t, tops[0], crossTol))) return "start";
    if (bottoms.every((b) => approxEqual(b, bottoms[0], crossTol))) return "end";
    if (centers.every((c) => approxEqual(c, centers[0], crossTol))) return "center";
    return "mixed";
  }
  const crossTol = tol * (bounds.width || 1);
  const lefts = items.map((i) => i.x - bounds.x);
  const rights = items.map((i) => i.x + i.width - bounds.x);
  const centers = items.map((i) => i.x + i.width / 2 - bounds.x);
  const widths = items.map((i) => i.width);
  if (widths.every((w) => approxEqual(w, bounds.width, crossTol))) return "stretch";
  if (lefts.every((l) => approxEqual(l, lefts[0], crossTol))) return "start";
  if (rights.every((r) => approxEqual(r, rights[0], crossTol))) return "end";
  if (centers.every((c) => approxEqual(c, centers[0], crossTol))) return "center";
  return "mixed";
}
