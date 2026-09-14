import { describe, expect, it } from "vitest";
import { describeWireframe } from "../describe";
import { normalizeWireframe } from "../normalize";
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

describe("describeWireframe", () => {
  it("describes a heading and a repeated card row in plain English", () => {
    const elements: EditorDocument["elements"] = [
      { id: "heading", kind: "heading", x: 500, y: 20, width: 400, height: 60, parentId: null },
    ];
    for (let i = 0; i < 4; i++) {
      elements.push({
        id: `card-${i}`,
        kind: "box",
        x: 100 + i * 320,
        y: 200,
        width: 280,
        height: 220,
        parentId: null,
      });
    }
    const wireframe = normalizeWireframe(doc(elements), "wf-1", new Date().toISOString());
    const summary = describeWireframe(wireframe);

    expect(summary).toHaveLength(1);
    expect(summary[0]).toContain("a heading");
    expect(summary[0]).toContain("a row of 4 repeated items");
    expect(summary[0]).not.toMatch(/repeated_group|LayoutNode|ratio/i);
  });

  it("describes a text/image row as two things next to each other", () => {
    const elements: EditorDocument["elements"] = [
      { id: "row", kind: "row", x: 100, y: 100, width: 1200, height: 400, parentId: null },
      { id: "text", kind: "text", x: 120, y: 120, width: 560, height: 360, parentId: "row" },
      { id: "image", kind: "image", x: 720, y: 120, width: 560, height: 360, parentId: "row" },
    ];
    const wireframe = normalizeWireframe(doc(elements), "wf-2", new Date().toISOString());
    const summary = describeWireframe(wireframe);

    expect(summary[0]).toContain("a text block next to an image");
  });

  it("labels multiple sections distinctly", () => {
    const elements: EditorDocument["elements"] = [
      { id: "s1", kind: "section", x: 0, y: 0, width: 1440, height: 300, parentId: null },
      { id: "h1", kind: "heading", x: 100, y: 20, width: 300, height: 40, parentId: "s1" },
      { id: "s2", kind: "section", x: 0, y: 320, width: 1440, height: 300, parentId: null },
      { id: "h2", kind: "text", x: 100, y: 340, width: 300, height: 40, parentId: "s2" },
    ];
    const wireframe = normalizeWireframe(doc(elements), "wf-3", new Date().toISOString());
    const summary = describeWireframe(wireframe);

    expect(summary).toHaveLength(2);
    expect(summary[0]).toContain("Section 1:");
    expect(summary[1]).toContain("Section 2:");
  });

  it("returns a friendly message for an empty wireframe", () => {
    const wireframe = normalizeWireframe(doc([]), "wf-4", new Date().toISOString());
    const summary = describeWireframe(wireframe);
    expect(summary[0]).toMatch(/nothing/i);
  });
});
