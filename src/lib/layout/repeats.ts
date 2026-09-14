// Repeated-element detection, shared by the wireframe normalizer (where
// grouping may already be explicit, e.g. from "duplicate") and the
// crawler (where it never is — real DOMs don't tag their card grids).

import { approxEqual, type Box } from "./geometry";

interface Groupable extends Box {
  id: string;
  kind: string;
  groupId?: string;
}

export function detectRepeatedGroups<T extends Groupable>(
  items: T[]
): { groups: T[][]; ungrouped: T[] } {
  const groups: T[][] = [];
  const consumed = new Set<string>();

  // 1. Explicit grouping wins (e.g. the editor's "duplicate" action tags
  //    the copy with the same groupId as its source).
  const byGroupId = new Map<string, T[]>();
  for (const item of items) {
    if (!item.groupId) continue;
    const list = byGroupId.get(item.groupId) ?? [];
    list.push(item);
    byGroupId.set(item.groupId, list);
  }
  for (const list of byGroupId.values()) {
    if (list.length >= 2) {
      groups.push(list);
      list.forEach((i) => consumed.add(i.id));
    }
  }

  // 2. Auto-detect remaining siblings of the same kind with near-identical
  //    size — the "four repeated cards" pattern nobody tags by hand.
  //    Require >=3 to avoid false positives on two coincidentally similar
  //    boxes.
  const remaining = items.filter((i) => !consumed.has(i.id));
  const byKind = new Map<string, T[]>();
  for (const item of remaining) {
    const list = byKind.get(item.kind) ?? [];
    list.push(item);
    byKind.set(item.kind, list);
  }
  for (const list of byKind.values()) {
    if (list.length < 3) continue;
    const avgW = list.reduce((s, i) => s + i.width, 0) / list.length;
    const avgH = list.reduce((s, i) => s + i.height, 0) / list.length;
    const sizesMatch =
      list.every((i) => approxEqual(i.width, avgW, avgW * 0.2)) &&
      list.every((i) => approxEqual(i.height, avgH, avgH * 0.2));
    if (!sizesMatch) continue;
    groups.push(list);
    list.forEach((i) => consumed.add(i.id));
  }

  const ungrouped = items.filter((i) => !consumed.has(i.id));
  return { groups, ungrouped };
}
