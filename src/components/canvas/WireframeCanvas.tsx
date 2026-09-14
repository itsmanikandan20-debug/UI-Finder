"use client";

import { Fragment, useEffect, useRef } from "react";
import { Stage, Layer, Line, Rect, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { ELEMENT_DEFAULTS, type CanvasElement } from "@/features/wireframe-editor/types";

const MAX_DISPLAY_WIDTH = 1040;
const STROKE_COLOR = "#3568E0";
const SELECTED_COLOR = "#1E3FA0";

interface Props {
  elements: CanvasElement[];
  selectedId: string | null;
  draftPoints: number[] | null;
  artboardWidth: number;
  artboardHeight: number;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<Pick<CanvasElement, "x" | "y" | "width" | "height">>) => void;
  onStartStroke: (x: number, y: number) => void;
  onExtendStroke: (x: number, y: number) => void;
  onEndStroke: (points: number[] | null) => void;
}

/** Position relative to the Stage, in artboard (unscaled) coordinates — Konva's own pointer position already accounts for the Stage's scaleX/scaleY. */
function stagePointerPosition(stage: Konva.Stage): { x: number; y: number } | null {
  const pos = stage.getPointerPosition();
  return pos ? { x: pos.x / stage.scaleX(), y: pos.y / stage.scaleY() } : null;
}

export function WireframeCanvas({
  elements,
  selectedId,
  draftPoints,
  artboardWidth,
  artboardHeight,
  onSelect,
  onChange,
  onStartStroke,
  onExtendStroke,
  onEndStroke,
}: Props) {
  const trRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Record<string, Konva.Shape>>({});
  const isDrawing = useRef(false);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? shapeRefs.current[selectedId] : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements]);

  const displayScale = Math.min(1, MAX_DISPLAY_WIDTH / artboardWidth);

  function handleMouseDown(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = e.target.getStage();
    if (!stage || e.target !== stage) return; // clicked an existing shape — its own handler deals with selection/drag
    onSelect(null);
    const pos = stagePointerPosition(stage);
    if (!pos) return;
    isDrawing.current = true;
    onStartStroke(pos.x, pos.y);
  }

  function handleMouseMove(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stagePointerPosition(stage);
    if (!pos) return;
    onExtendStroke(pos.x, pos.y);
  }

  function handleMouseUp() {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    onEndStroke(draftPoints);
  }

  return (
    <div className="overflow-auto rounded-2xl border border-border bg-surface-sunken p-4 shadow-panel">
      <Stage
        width={artboardWidth * displayScale}
        height={artboardHeight * displayScale}
        scaleX={displayScale}
        scaleY={displayScale}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <Layer>
          <Line
            points={[0, 0, artboardWidth, 0, artboardWidth, artboardHeight, 0, artboardHeight, 0, 0]}
            closed
            fill="#ffffff"
            stroke="#E5E4ED"
            listening={false}
          />
          {elements.map((el) => {
            const isSelected = selectedId === el.id;
            const setRef = (node: Konva.Shape | null) => {
              if (node) shapeRefs.current[el.id] = node;
              else delete shapeRefs.current[el.id];
            };

            if (el.variant === "typed") {
              const style = ELEMENT_DEFAULTS[el.kind];
              return (
                <Fragment key={el.id}>
                  <Rect
                    ref={setRef}
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.height}
                    fill={style.fill}
                    stroke={isSelected ? SELECTED_COLOR : style.stroke}
                    strokeWidth={isSelected ? 2 : 1}
                    dash={style.dashed ? [6, 4] : undefined}
                    cornerRadius={el.kind === "button" ? 8 : 4}
                    draggable
                    onClick={() => onSelect(el.id)}
                    onTap={() => onSelect(el.id)}
                    onDragEnd={(e) => onChange(el.id, { x: e.target.x(), y: e.target.y() })}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);
                      onChange(el.id, {
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(20, Math.round(node.width() * scaleX)),
                        height: Math.max(20, Math.round(node.height() * scaleY)),
                      });
                    }}
                  />
                  <Text
                    x={el.x + 8}
                    y={el.y + 6}
                    text={style.label}
                    fontSize={12}
                    fill={el.kind === "button" ? "#ffffff" : "#7A7788"}
                    listening={false}
                  />
                </Fragment>
              );
            }

            const scaleX = el.baseWidth > 0 ? el.width / el.baseWidth : 1;
            const scaleY = el.baseHeight > 0 ? el.height / el.baseHeight : 1;
            return (
              <Line
                key={el.id}
                ref={setRef}
                points={el.points}
                x={el.x}
                y={el.y}
                scaleX={scaleX}
                scaleY={scaleY}
                stroke={isSelected ? SELECTED_COLOR : STROKE_COLOR}
                strokeWidth={isSelected ? 3.5 : 3}
                lineCap="round"
                lineJoin="round"
                tension={0.25}
                hitStrokeWidth={16}
                draggable
                onClick={() => onSelect(el.id)}
                onTap={() => onSelect(el.id)}
                onDragEnd={(e) => onChange(el.id, { x: e.target.x(), y: e.target.y() })}
                onTransformEnd={(e) => {
                  const node = e.target;
                  const nodeScaleX = node.scaleX();
                  const nodeScaleY = node.scaleY();
                  const width = Math.max(8, Math.round(el.baseWidth * nodeScaleX));
                  const height = Math.max(8, Math.round(el.baseHeight * nodeScaleY));
                  // Avoid a stale double-scaled flash before the next render applies
                  // the "real" scale via the width/height prop above.
                  node.scaleX(width / el.baseWidth);
                  node.scaleY(height / el.baseHeight);
                  onChange(el.id, { x: node.x(), y: node.y(), width, height });
                }}
              />
            );
          })}
          {draftPoints && draftPoints.length >= 2 && (
            <Line
              points={draftPoints}
              stroke={STROKE_COLOR}
              strokeWidth={3}
              lineCap="round"
              lineJoin="round"
              tension={0.25}
              listening={false}
            />
          )}
          <Transformer
            ref={trRef}
            rotateEnabled={false}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 20 || newBox.height < 20 ? oldBox : newBox)}
          />
        </Layer>
      </Stage>
    </div>
  );
}
