// Translates a wireframe's structure into a short, plain-English summary
// — no technical terms (no "repeated_group", no ratios, no node ids).
// This is shown to the designer as "here's what I understood" before any
// search happens, so it needs to read like something a person wrote, not
// a dump of the internal LayoutNode tree.

import { isHorizontalSequence } from "./geometry";
import { getMatchableSections } from "./normalize";
import type { LayoutNode, Wireframe } from "./types";

// Leaves are always a plain, untyped shape now — the designer never tags
// what a box is meant to represent, so the wording stays honest about
// that rather than guessing "heading" or "image" from geometry alone.
function describeLeaf(): string {
  return "a drawn shape";
}

function describeChild(node: LayoutNode): string {
  if (node.kind === "repeated_group") {
    const count = node.repeat?.count ?? node.children.length;
    return `a row of ${count} repeated items`;
  }
  if (node.kind === "row") {
    return describeSiblings(node.children) ?? "a row of items side by side";
  }
  if (node.kind === "column") {
    return "a column of stacked items";
  }
  if (node.children.length === 0) {
    return describeLeaf();
  }
  return "a group of elements";
}

/**
 * The most natural way to sketch "two things side by side" is drawing them
 * directly inside one wrapper shape — no need for an extra nested
 * row-shaped wrapper just to unlock this wording. Applies to exactly 2
 * children that actually read as horizontal, wherever they show up
 * (a section's own children, or a nested row's).
 */
function describeSiblings(children: LayoutNode[]): string | null {
  if (children.length !== 2 || !isHorizontalSequence(children)) return null;
  return `${describeChild(children[0])} next to ${describeChild(children[1])}`;
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
    const sideBySide = describeSiblings(section.children);
    const body = sideBySide ?? joinWithCommas(section.children.map(describeChild));
    const label = sections.length > 1 ? `Section ${i + 1}: ` : "";
    return `${label}${body}`;
  });
}
