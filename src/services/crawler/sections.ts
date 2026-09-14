// Splits a page into candidate sections using geometry alone — direct
// children of the (collapsed) body that are wide and tall enough to be a
// meaningful region — never by looking at tag names, ids, or text.

import type { RawDomNode } from "./extract";

const MIN_SECTION_HEIGHT = 60;
const MIN_WIDTH_RATIO = 0.5;
const MAX_SECTIONS = 12;

export function detectSectionCandidates(root: RawDomNode | null, viewportWidth: number): RawDomNode[] {
  if (!root) return [];

  const direct = root.children.filter(
    (c) => c.height >= MIN_SECTION_HEIGHT && c.width >= viewportWidth * MIN_WIDTH_RATIO
  );

  // If the page didn't decompose into at least a couple of full-width
  // regions (e.g. everything sits in one big wrapper our collapse pass
  // didn't unwrap), fall back to treating the whole page as one section
  // rather than returning nothing.
  const candidates = direct.length >= 2 ? direct : [root];

  return candidates
    .slice()
    .sort((a, b) => a.y - b.y)
    .slice(0, MAX_SECTIONS);
}
