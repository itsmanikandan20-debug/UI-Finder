import { describe, expect, it } from "vitest";
import type { LayoutNode } from "@/lib/layout/types";
import { scoreSections } from "../score";
import { rankCandidates } from "../rank";
import type { ExtractedSection } from "@/lib/layout/types";

// The Section 28 test case: heading on top, 4 repeated cards in the
// middle, a text/image split at the bottom.
function referenceWireframeSection(): LayoutNode {
  return {
    id: "wf-section",
    kind: "section",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    children: [
      { id: "heading", kind: "heading", x: 0.3, y: 0.02, width: 0.4, height: 0.08, children: [], meta: { hasText: true } },
      {
        id: "cards",
        kind: "repeated_group",
        x: 0.05,
        y: 0.15,
        width: 0.9,
        height: 0.25,
        repeat: { count: 4, direction: "horizontal" },
        meta: { gap: 0.02, alignment: "start" },
        children: [0, 1, 2, 3].map((i) => ({
          id: `card-${i}`,
          kind: "box" as const,
          x: i * 0.24,
          y: 0,
          width: 0.22,
          height: 1,
          children: [],
          meta: { hasImage: true, hasText: true },
        })),
      },
      {
        id: "split",
        kind: "row",
        x: 0.05,
        y: 0.5,
        width: 0.9,
        height: 0.4,
        meta: { gap: 0.04, alignment: "center" },
        children: [
          { id: "content", kind: "text", x: 0, y: 0, width: 0.45, height: 1, children: [], meta: { hasText: true } },
          { id: "visual", kind: "image", x: 0.5, y: 0, width: 0.45, height: 1, children: [], meta: { hasImage: true } },
        ],
      },
    ],
  };
}

// A near-identical page section, at different absolute proportions but
// the same structural shape — should score very highly.
function closeMatchSection(): LayoutNode {
  const base = referenceWireframeSection();
  base.children[1].children = base.children[1].children.slice(0, 4).map((c, i) => ({
    ...c,
    x: i * 0.235 + 0.01,
  }));
  return base;
}

// A page with 3 cards instead of 4, otherwise similar — should score
// lower than the exact 4-card match but still recognizably in the family.
function partialMatchSection(): LayoutNode {
  const section = referenceWireframeSection();
  const cardsGroup = section.children[1];
  cardsGroup.repeat = { count: 3, direction: "horizontal" };
  cardsGroup.children = cardsGroup.children.slice(0, 3);
  return section;
}

// A single full-bleed image with no substructure at all — as structurally
// unrelated to "heading + 4 cards + text/image split" as it gets.
function farMismatchSection(): LayoutNode {
  return {
    id: "unrelated",
    kind: "section",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    children: [
      { id: "hero-image", kind: "image", x: 0, y: 0, width: 1, height: 1, children: [], meta: { hasImage: true } },
    ],
  };
}

describe("scoreSections", () => {
  it("scores a structurally near-identical section higher than an unrelated one", () => {
    const wf = referenceWireframeSection();
    const close = scoreSections(wf, closeMatchSection());
    const far = scoreSections(wf, farMismatchSection());
    expect(close.similarity).toBeGreaterThan(far.similarity);
    expect(close.similarity).toBeGreaterThan(70);
    expect(far.similarity).toBeLessThan(50);
  });

  it("ranks an exact repeat-count match above a partial (3 vs 4 cards) match", () => {
    const wf = referenceWireframeSection();
    const exact = scoreSections(wf, closeMatchSection());
    const partial = scoreSections(wf, partialMatchSection());
    expect(exact.similarity).toBeGreaterThan(partial.similarity);
  });

  it("never reports a similarity outside 0-100", () => {
    const wf = referenceWireframeSection();
    const far = scoreSections(wf, farMismatchSection());
    expect(far.similarity).toBeGreaterThanOrEqual(0);
    expect(far.similarity).toBeLessThanOrEqual(100);
  });
});

function toExtracted(id: string, root: LayoutNode): ExtractedSection {
  return {
    id,
    websiteId: `site-${id}`,
    pageUrl: `https://example.com/${id}`,
    domain: "example.com",
    sectionIndex: 0,
    domSelector: "section",
    viewportWidth: 1440,
    root,
    crawledAt: new Date().toISOString(),
  };
}

describe("rankCandidates", () => {
  it("orders candidates best-match first", () => {
    const wf = referenceWireframeSection();
    const candidates = [
      toExtracted("far", farMismatchSection()),
      toExtracted("partial", partialMatchSection()),
      toExtracted("close", closeMatchSection()),
    ];
    const ranked = rankCandidates(wf, candidates);
    expect(ranked[0].section.id).toBe("close");
    expect(ranked[ranked.length - 1].section.id).toBe("far");
  });

  it("respects topK", () => {
    const wf = referenceWireframeSection();
    const candidates = [
      toExtracted("far", farMismatchSection()),
      toExtracted("partial", partialMatchSection()),
      toExtracted("close", closeMatchSection()),
    ];
    const ranked = rankCandidates(wf, candidates, { topK: 1 });
    expect(ranked).toHaveLength(1);
    expect(ranked[0].section.id).toBe("close");
  });
});
