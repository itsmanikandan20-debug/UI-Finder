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

/**
 * Auto-nesting: rather than requiring the designer to explicitly drag
 * elements "into" a section/row/column (a whole extra interaction model
 * a quick sketching tool doesn't need), a container assignment is
 * recomputed from pure geometry after every move/resize — whichever
 * section/row/column an element's box sits inside of, tightest fit wins.
 * A candidate must be meaningfully larger in area, which also guarantees
 * this can never produce a cycle.
 */
function computeParents(elements: CanvasElement[]): CanvasElement[] {
  const containers = elements.filter((e) => e.kind === "section" || e.kind === "row" || e.kind === "column");

  return elements.map((el) => {
    let bestParentId: string | null = null;
    let bestArea = Infinity;
    const elArea = el.width * el.height;

    for (const c of containers) {
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

export function useEditorState() {
  const [viewportLabel, setViewportLabel] = useState<ViewportLabel>("desktop");
  const [elements, setElementsRaw] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  }, []);

  const exportDocument = useCallback((): EditorDocument => {
    return {
      id: randomId(),
      artboardWidth,
      artboardHeight,
      viewportLabel,
      elements: elements.map(({ id, kind, x, y, width, height, parentId, groupId }) => ({
        id,
        kind,
        x,
        y,
        width,
        height,
        parentId,
        groupId,
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
    addElement,
    updateElement,
    deleteSelected,
    duplicateSelected,
    clearAll,
    exportDocument,
  };
}
