// The designer draws free-hand — no Section/Row/Heading/Image type picker.
// A CanvasElement is a pen stroke: `points` is the raw path, authored
// relative to the shape's own bounding box at draw time (so (0,0) is the
// box's top-left corner); x/y/width/height is that box's current position
// and size on the artboard, which can move/resize independently of the
// stroke's original path (resizing scales the path rather than redrawing
// it — see WireframeCanvas.tsx).

export interface CanvasElement {
  id: string;
  /** Flat [x0, y0, x1, y1, ...] pairs, relative to the box's own top-left corner at draw time. */
  points: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  /** The box's size when the stroke was drawn — the reference `points` was authored against; width/height divided by these give the current display scale. */
  baseWidth: number;
  baseHeight: number;
  parentId: string | null;
  groupId?: string;
}
