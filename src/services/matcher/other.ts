// "Other signals" bucket (small weight by design) — currently just an
// exact repeat-count bonus: a wireframe with 4 repeated cards should
// score a real page's 4-card row higher than its 3-card or 5-card row,
// even after structural/geometry scoring has already rewarded the near
// miss. Kept separate and small so it nudges ranking without dominating.

import type { LayoutNode } from "@/lib/layout/types";

function maxRepeatCount(node: LayoutNode): number {
  let max = node.repeat?.count ?? 0;
  for (const child of node.children) {
    max = Math.max(max, maxRepeatCount(child));
  }
  return max;
}

export function otherSignals(a: LayoutNode, b: LayoutNode): number {
  const repeatA = maxRepeatCount(a);
  const repeatB = maxRepeatCount(b);
  if (repeatA === 0 && repeatB === 0) return 1;
  return repeatA === repeatB ? 1 : 0.4;
}
