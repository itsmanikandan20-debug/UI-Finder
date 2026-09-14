// Shared structural-layout schema.
//
// Both the wireframe editor and the website crawler reduce whatever they
// see (a canvas sketch, or a rendered DOM) down to this same tree shape.
// The matcher only ever operates on LayoutNode trees — it has no idea
// whether a given tree came from a designer's sketch or a live webpage.
// That symmetry is the whole point: one comparison function, two sources.

export type NodeKind =
  | "root"
  | "section"
  | "row"
  | "column"
  | "repeated_group"
  | "heading"
  | "text"
  | "image"
  | "button"
  | "box";

export type Alignment = "start" | "center" | "end" | "stretch" | "mixed";

export interface RepeatInfo {
  count: number;
  direction: "horizontal" | "vertical";
}

export interface LayoutNodeMeta {
  hasImage?: boolean;
  hasText?: boolean;
  alignment?: Alignment;
  /** Gap between children, normalized to the parent's width (row) or height (column). */
  gap?: number;
}

export interface LayoutNode {
  id: string;
  kind: NodeKind;
  /** Position and size normalized to 0..1 within the immediate parent's box. */
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutNode[];
  repeat?: RepeatInfo;
  meta?: LayoutNodeMeta;
}

export type ViewportLabel = "desktop" | "tablet" | "mobile";

export interface Wireframe {
  id: string;
  viewport: {
    width: number;
    label: ViewportLabel;
  };
  /** kind === "root"; x=y=0, width=height=1; children are top-level sections. */
  root: LayoutNode;
  createdAt: string;
}

// --- Editor-side authoring model -------------------------------------
// The canvas works in absolute pixels on a fixed-width artboard. This is
// converted into the normalized LayoutNode tree by normalize.ts before it
// is ever sent to the matcher — the matcher never sees raw pixels.

export type EditorElementKind =
  | "section"
  | "row"
  | "column"
  | "heading"
  | "text"
  | "image"
  | "button"
  | "box";

export interface EditorElement {
  id: string;
  kind: EditorElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
  /** Elements sharing a groupId under the same parent are treated as one repeated set. */
  groupId?: string;
}

export interface EditorDocument {
  id: string;
  artboardWidth: number;
  artboardHeight: number;
  viewportLabel: ViewportLabel;
  elements: EditorElement[];
}

// --- Website-side extraction model ------------------------------------
// One ExtractedSection per detected section of a crawled page. Its `root`
// is a LayoutNode subtree (kind "section") directly comparable to a
// wireframe's top-level section nodes.

export interface ExtractedSection {
  id: string;
  websiteId: string;
  pageUrl: string;
  /** Denormalized from the owning website record for cheap display without a join. */
  domain: string;
  websiteTitle?: string;
  sectionIndex: number;
  domSelector: string;
  viewportWidth: number;
  root: LayoutNode;
  screenshotRef?: string;
  /**
   * A short text snippet captured from within this section, used ONLY to
   * build a "scroll to text" deep link on the results page (never fed
   * into structural matching — the matcher never reads this field).
   */
  anchorSnippet?: string;
  /** How far down the full page this section sits (0 = top, 1 = bottom). Navigation-only. */
  pageYRatio?: number;
  crawledAt: string;
}

export interface WebsiteRecord {
  id: string;
  domain: string;
  pageUrl: string;
  title?: string;
  status: "pending" | "crawled" | "failed" | "blocked";
  lastCrawledAt?: string;
}
