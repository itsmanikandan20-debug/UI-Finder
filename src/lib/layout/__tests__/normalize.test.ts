import { describe, expect, it } from "vitest";
import { normalizeWireframe, getMatchableSections } from "../normalize";
import type { EditorDocument } from "../types";

function doc(elements: EditorDocument["elements"]): EditorDocument {
  return {
    id: "doc-1",
    artboardWidth: 1440,
    artboardHeight: 900,
    viewportLabel: "desktop",
    elements,
  };
}

describe("normalizeWireframe", () => {
  it("converts absolute pixel boxes into 0..1 ratios relative to the artboard", () => {
    const wireframe = normalizeWireframe(
      doc([{ id: "a", x: 360, y: 0, width: 720, height: 90, parentId: null }]),
      "wf-1",
      "2024-01-01T00:00:00.000Z"
    );
    const [shape] = wireframe.root.children;
    expect(shape.x).toBeCloseTo(0.25);
    expect(shape.width).toBeCloseTo(0.5);
    expect(shape.height).toBeCloseTo(0.1);
    expect(shape.kind).toBe("box");
  });

  it("nests children relative to their own parent, not the artboard", () => {
    const wireframe = normalizeWireframe(
      doc([
        { id: "wrapper", x: 0, y: 0, width: 1440, height: 400, parentId: null },
        { id: "child", x: 144, y: 40, width: 720, height: 40, parentId: "wrapper" },
      ]),
      "wf-2",
      "2024-01-01T00:00:00.000Z"
    );
    const wrapper = wireframe.root.children[0];
    const child = wrapper.children[0];
    // 144/1440 = 0.1, 720/1440 = 0.5 — relative to the 1440-wide wrapper itself.
    expect(child.x).toBeCloseTo(0.1);
    expect(child.width).toBeCloseTo(0.5);
  });

  it("turns a top-level shape that contains others into a matchable 'section'", () => {
    const wireframe = normalizeWireframe(
      doc([
        { id: "wrapper", x: 0, y: 0, width: 1440, height: 400, parentId: null },
        { id: "child", x: 144, y: 40, width: 720, height: 40, parentId: "wrapper" },
      ]),
      "wf-2b",
      "2024-01-01T00:00:00.000Z"
    );
    expect(wireframe.root.children[0].kind).toBe("section");
  });

  it("infers 'row' vs 'column' for a nested (non-top-level) container from its children's arrangement", () => {
    const wireframe = normalizeWireframe(
      doc([
        { id: "section", x: 0, y: 0, width: 1440, height: 400, parentId: null },
        { id: "wrapper", x: 100, y: 20, width: 1200, height: 300, parentId: "section" },
        { id: "left", x: 100, y: 20, width: 500, height: 300, parentId: "wrapper" },
        { id: "right", x: 700, y: 20, width: 500, height: 300, parentId: "wrapper" },
      ]),
      "wf-2c",
      "2024-01-01T00:00:00.000Z"
    );
    const wrapper = wireframe.root.children[0].children[0];
    expect(wrapper.kind).toBe("row");
  });

  it("auto-detects 4 same-sized siblings as a repeated_group without any explicit tagging", () => {
    const cardWidth = 300;
    const elements: EditorDocument["elements"] = [];
    for (let i = 0; i < 4; i++) {
      elements.push({
        id: `card-${i}`,
        x: 50 + i * (cardWidth + 20),
        y: 200,
        width: cardWidth,
        height: 220,
        parentId: null,
      });
    }
    const wireframe = normalizeWireframe(doc(elements), "wf-3", "2024-01-01T00:00:00.000Z");
    const group = wireframe.root.children.find((n) => n.kind === "repeated_group");
    expect(group).toBeDefined();
    expect(group?.repeat?.count).toBe(4);
    expect(group?.repeat?.direction).toBe("horizontal");
  });

  it("respects explicit groupId even for just 2 duplicated elements", () => {
    const elements: EditorDocument["elements"] = [
      { id: "b1", x: 0, y: 0, width: 100, height: 40, parentId: null, groupId: "g1" },
      { id: "b2", x: 120, y: 0, width: 100, height: 40, parentId: null, groupId: "g1" },
    ];
    const wireframe = normalizeWireframe(doc(elements), "wf-4", "2024-01-01T00:00:00.000Z");
    expect(wireframe.root.children).toHaveLength(1);
    expect(wireframe.root.children[0].kind).toBe("repeated_group");
    expect(wireframe.root.children[0].repeat?.count).toBe(2);
  });

  it("falls back to the whole wireframe as one matchable section when nothing wraps anything else", () => {
    const wireframe = normalizeWireframe(
      doc([{ id: "a", x: 0, y: 0, width: 100, height: 40, parentId: null }]),
      "wf-5",
      "2024-01-01T00:00:00.000Z"
    );
    const sections = getMatchableSections(wireframe);
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe("root");
  });
});
