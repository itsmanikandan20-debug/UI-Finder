"use client";

import { useCallback, useState } from "react";
import { randomId } from "@/lib/id";
import type { EditorDocument, EditorElementKind, ViewportLabel } from "@/lib/layout/types";
import { ELEMENT_DEFAULTS, type CanvasElement } from "./types";

const ARTBOARD_WIDTH: Record<ViewportLabel, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 390,
};

const MIN_STROKE_SIZE = 8; // px — discards an accidental click-without-dragging

/**
 * Auto-nesting: rather than requiring the designer to explicitly drag a
 * shape "into" another (a whole extra interaction model a quick sketching
 * tool doesn't need), a container assignment is recomputed from pure
 * geometry after every move/resize/new stroke — whichever other shape a
 * box sits inside of, tightest fit wins. Any shape can act as a container
 * now (there's no more "this one's a Section, that one's just a Box" —
 * the designer never tags either). A candidate must be meaningfully larger
 * in area, which also guarantees this can never produce a cycle.
 */
function computeParents(elements: CanvasElement[]): CanvasElement[] {
  return elements.map((el) => {
    let bestParentId: string | null = null;
    let bestArea = Infinity;
    const elArea = el.width * el.height;

    for (const c of elements) {
      if (c.id === el.id) continue;
      const cArea = c.width * c.height;
      if (cArea <= elArea * 1.02) continue;

      const contains =
        el.x >= c.x - 1 &&
        el.y >= c.y - 1 &&
        el.x + el.width <= c.x + c.width + 1 &&
        el.y + el.height <= c.y + c.height + 1;

      if (contains && cArea < bestArea) {
        bestParentId = c.id;
        bestArea = cArea;
      }
    }

    return el.parentId === bestParentId ? el : { ...el, parentId: bestParentId };
  });
}

/** [x0, y0, x1, y1, ...] -> bounding box in the same (absolute) coordinate space. */
function boundingBoxOf(points: number[]): { x: number; y: number; width: number; height: number } {
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const x1 = Math.max(...xs);
  const y1 = Math.max(...ys);
  return { x: x0, y: y0, width: Math.max(x1 - x0, MIN_STROKE_SIZE), height: Math.max(y1 - y0, MIN_STROKE_SIZE) };
}

export function useEditorState() {
  const [viewportLabel, setViewportLabel] = useState<ViewportLabel>("desktop");
  const [elements, setElementsRaw] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftPoints, setDraftPoints] = useState<number[] | null>(null);

  const artboardWidth = ARTBOARD_WIDTH[viewportLabel];
  const artboardHeight = Math.round(artboardWidth * 0.72);

  const applyUpdate = useCallback((updater: (prev: CanvasElement[]) => CanvasElement[]) => {
    setElementsRaw((prev) => computeParents(updater(prev)));
  }, []);

  const addElement = useCallback(
    (kind: EditorElementKind) => {
      const defaults = ELEMENT_DEFAULTS[kind];
      const id = randomId();
      const width = Math.min(defaults.width, artboardWidth - 40);
      applyUpdate((prev) => [
        ...prev,
        {
          id,
          variant: "typed",
          kind,
          x: Math.max(20, Math.round((artboardWidth - width) / 2)),
          y: 30 + (prev.length % 6) * 30,
          width,
          height: defaults.height,
          parentId: null,
        },
      ]);
      setSelectedId(id);
    },
    [applyUpdate, artboardWidth]
  );

  const startStroke = useCallback((x: number, y: number) => {
    setSelectedId(null);
    setDraftPoints([x, y]);
  }, []);

  const extendStroke = useCallback((x: number, y: number) => {
    setDraftPoints((prev) => (prev ? [...prev, x, y] : prev));
  }, []);

  /**
   * Takes the just-finished path explicitly rather than reading draftPoints
   * from a setState updater — a functional setState updater must be pure,
   * and React (Strict Mode, in dev) double-invokes it to check exactly
   * that. This one wasn't: it had side effects (a random id, two other
   * setState calls), which meant every stroke was silently drawn twice.
   */
  const endStroke = useCallback(
    (points: number[] | null) => {
      setDraftPoints(null);
      if (!points || points.length < 2) return;
      const box = boundingBoxOf(points);
      // Store the path relative to the box's own top-left corner, so
      // moving/resizing the box later never needs to touch these points.
      const relativePoints = points.map((v, i) => v - (i % 2 === 0 ? box.x : box.y));
      const id = randomId();
      applyUpdate((els) => [
        ...els,
        {
          id,
          variant: "stroke",
          points: relativePoints,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          baseWidth: box.width,
          baseHeight: box.height,
          parentId: null,
        },
      ]);
      setSelectedId(id);
    },
    [applyUpdate]
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<Pick<CanvasElement, "x" | "y" | "width" | "height">>) => {
      applyUpdate((prev) => prev.map((el) => (el.id === id ? { ...el, ...patch } : el)));
    },
    [applyUpdate]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    applyUpdate((prev) => prev.filter((el) => el.id !== selectedId && el.parentId !== selectedId));
    setSelectedId(null);
  }, [applyUpdate, selectedId]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    applyUpdate((prev) => {
      const source = prev.find((el) => el.id === selectedId);
      if (!source) return prev;
      const groupId = source.groupId ?? randomId();
      // Offset from the rightmost existing member of the group, not
      // always the original — otherwise duplicating repeatedly stacks
      // every copy at the same spot instead of fanning them out.
      const siblings = prev.filter((el) => el.groupId === groupId);
      const rightmost = siblings.reduce((a, b) => (a.x > b.x ? a : b), source);
      const copy: CanvasElement = {
        ...source,
        id: randomId(),
        groupId,
        x: rightmost.x + rightmost.width + 24,
      };
      const withGroupOnSource = prev.map((el) => (el.id === selectedId ? { ...el, groupId } : el));
      return [...withGroupOnSource, copy];
    });
  }, [applyUpdate, selectedId]);

  const clearAll = useCallback(() => {
    setElementsRaw([]);
    setSelectedId(null);
    setDraftPoints(null);
  }, []);

  const exportDocument = useCallback((): EditorDocument => {
    return {
      id: randomId(),
      artboardWidth,
      artboardHeight,
      viewportLabel,
      elements: elements.map(({ id, x, y, width, height, parentId, groupId, ...rest }) => ({
        id,
        x,
        y,
        width,
        height,
        parentId,
        groupId,
        ...(rest.variant === "typed" ? { kind: rest.kind } : {}),
      })),
    };
  }, [elements, artboardWidth, artboardHeight, viewportLabel]);

  return {
    viewportLabel,
    setViewportLabel,
    artboardWidth,
    artboardHeight,
    elements,
    selectedId,
    setSelectedId,
    draftPoints,
    addElement,
    startStroke,
    extendStroke,
    endStroke,
    updateElement,
    deleteSelected,
    duplicateSelected,
    clearAll,
    exportDocument,
  };
}
