// Translates a wireframe's structure into a short, plain-English summary
// — no technical terms (no "repeated_group", no ratios, no node ids).
// This is shown to the designer as "here's what I understood" before any
// search happens, so it needs to read like something a person wrote, not
// a dump of the internal LayoutNode tree.

import { getMatchableSections } from "./normalize";
import type { LayoutNode, Wireframe } from "./types";

function describeLeaf(node: LayoutNode): string {
  switch (node.kind) {
    case "heading":
      return "a heading";
    case "text":
      return "a text block";
    case "image":
      return "an image";
    case "button":
      return "a button";
    default:
      return "a placeholder block";
  }
}

function describeChild(node: LayoutNode): string {
  if (node.kind === "repeated_group") {
    const count = node.repeat?.count ?? node.children.length;
    return `a row of ${count} repeated items`;
  }
  if (node.kind === "row") {
    return node.children.length === 2
      ? `${describeChild(node.children[0])} next to ${describeChild(node.children[1])}`
      : "a row of items side by side";
  }
  if (node.kind === "column") {
    return "a column of stacked items";
  }
  if (node.children.length === 0) {
    return describeLeaf(node);
  }
  return "a group of elements";
}

function joinWithCommas(parts: string[]): string {
  if (parts.length === 0) return "nothing recognizable";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** One plain-English sentence per matchable section of the wireframe. */
export function describeWireframe(wireframe: Wireframe): string[] {
  const sections = getMatchableSections(wireframe);
  if (sections.length === 0) return ["Nothing drawn yet."];

  return sections.map((section, i) => {
    const parts = section.children.map(describeChild);
    const label = sections.length > 1 ? `Section ${i + 1}: ` : "";
    return `${label}${joinWithCommas(parts)}`;
  });
}
