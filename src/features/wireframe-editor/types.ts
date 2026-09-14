// Two ways to add a shape, side by side: pick a type from the toolbar
// (a TypedCanvasElement — a plain rectangle with that type's default
// look) or draw free-hand with the mouse (a StrokeCanvasElement — a pen
// path, authored relative to its own bounding box at draw time; resizing
// scales the path rather than redrawing it — see WireframeCanvas.tsx).
// Only a typed element carries a `kind`; normalize.ts uses that directly
// when present, and infers structure from geometry alone when absent.

import type { EditorElementKind } from "@/lib/layout/types";

interface BaseCanvasElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
  /** Elements sharing a groupId under the same parent are treated as one repeated set. */
  groupId?: string;
}

export interface TypedCanvasElement extends BaseCanvasElement {
  variant: "typed";
  kind: EditorElementKind;
}

export interface StrokeCanvasElement extends BaseCanvasElement {
  variant: "stroke";
  /** Flat [x0, y0, x1, y1, ...] pairs, relative to the box's own top-left corner at draw time. */
  points: number[];
  /** The box's size when the stroke was drawn — the reference `points` was authored against; width/height divided by these give the current display scale. */
  baseWidth: number;
  baseHeight: number;
}

export type CanvasElement = TypedCanvasElement | StrokeCanvasElement;

export interface ElementStyle {
  width: number;
  height: number;
  fill: string;
  stroke: string;
  label: string;
  dashed?: boolean;
}

export const ELEMENT_DEFAULTS: Record<EditorElementKind, ElementStyle> = {
  section: { width: 900, height: 320, fill: "rgba(53,104,224,0.03)", stroke: "#9AB2E8", label: "Section", dashed: true },
  row: { width: 700, height: 120, fill: "rgba(53,104,224,0.05)", stroke: "#B7C7EF", label: "Row", dashed: true },
  column: { width: 220, height: 320, fill: "rgba(53,104,224,0.05)", stroke: "#B7C7EF", label: "Column", dashed: true },
  heading: { width: 360, height: 48, fill: "#E5ECFB", stroke: "#8FB6FF", label: "Heading" },
  text: { width: 320, height: 32, fill: "#F1F1F6", stroke: "#D2D0DF", label: "Text" },
  image: { width: 280, height: 180, fill: "#E7E5EE", stroke: "#B8B4C9", label: "Image" },
  button: { width: 140, height: 44, fill: "#3568E0", stroke: "#264FBF", label: "Button" },
  box: { width: 220, height: 160, fill: "#F1EFF6", stroke: "#D2D0DF", label: "Box" },
};

export const ADDABLE_KINDS: EditorElementKind[] = [
  "section",
  "row",
  "column",
  "heading",
  "text",
  "image",
  "button",
  "box",
];
