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
  it("describes a lone shape and a repeated card row in plain English", () => {
    const elements: EditorDocument["elements"] = [
      { id: "lone", x: 500, y: 20, width: 400, height: 60, parentId: null },
    ];
    for (let i = 0; i < 4; i++) {
      elements.push({
        id: `card-${i}`,
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
    expect(summary[0]).toContain("a drawn shape");
    expect(summary[0]).toContain("a row of 4 repeated items");
    expect(summary[0]).not.toMatch(/repeated_group|LayoutNode|ratio/i);
  });

  it("describes two shapes drawn directly inside one wrapper (the natural way to sketch this) as 'X next to Y', with no extra nested wrapper needed", () => {
    const elements: EditorDocument["elements"] = [
      { id: "wrapper", x: 0, y: 0, width: 1440, height: 400, parentId: null },
      { id: "left", x: 100, y: 40, width: 600, height: 320, parentId: "wrapper" },
      { id: "right", x: 740, y: 40, width: 600, height: 320, parentId: "wrapper" },
    ];
    const wireframe = normalizeWireframe(doc(elements), "wf-1b", new Date().toISOString());
    const summary = describeWireframe(wireframe);

    expect(summary[0]).toContain("a drawn shape next to a drawn shape");
  });

  it("describes a nested row of two shapes as 'X next to Y'", () => {
    const elements: EditorDocument["elements"] = [
      { id: "outer", x: 0, y: 0, width: 1440, height: 400, parentId: null },
      { id: "row", x: 100, y: 100, width: 1200, height: 300, parentId: "outer" },
      { id: "left", x: 120, y: 120, width: 560, height: 260, parentId: "row" },
      { id: "right", x: 720, y: 120, width: 560, height: 260, parentId: "row" },
    ];
    const wireframe = normalizeWireframe(doc(elements), "wf-2", new Date().toISOString());
    const summary = describeWireframe(wireframe);

    expect(summary[0]).toContain("a drawn shape next to a drawn shape");
  });

  it("labels multiple sections distinctly (any top-level shape wrapping another becomes a section)", () => {
    const elements: EditorDocument["elements"] = [
      { id: "s1", x: 0, y: 0, width: 1440, height: 300, parentId: null },
      { id: "h1", x: 100, y: 20, width: 300, height: 40, parentId: "s1" },
      { id: "s2", x: 0, y: 320, width: 1440, height: 300, parentId: null },
      { id: "h2", x: 100, y: 340, width: 300, height: 40, parentId: "s2" },
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
