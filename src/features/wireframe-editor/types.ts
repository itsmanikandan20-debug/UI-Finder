import type { EditorElementKind } from "@/lib/layout/types";

export interface CanvasElement {
  id: string;
  kind: EditorElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
  groupId?: string;
}

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
