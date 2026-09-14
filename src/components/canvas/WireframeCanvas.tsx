"use client";

import { useEffect, useRef } from "react";
import { Stage, Layer, Rect, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { ELEMENT_DEFAULTS, type CanvasElement } from "@/features/wireframe-editor/types";

const MAX_DISPLAY_WIDTH = 1040;

interface Props {
  elements: CanvasElement[];
  selectedId: string | null;
  artboardWidth: number;
  artboardHeight: number;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<Pick<CanvasElement, "x" | "y" | "width" | "height">>) => void;
}

export function WireframeCanvas({
  elements,
  selectedId,
  artboardWidth,
  artboardHeight,
  onSelect,
  onChange,
}: Props) {
  const trRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Record<string, Konva.Rect>>({});

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? shapeRefs.current[selectedId] : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements]);

  const displayScale = Math.min(1, MAX_DISPLAY_WIDTH / artboardWidth);

  return (
    <div className="overflow-auto rounded-2xl border border-border bg-surface-sunken p-4 shadow-panel">
      <Stage
        width={artboardWidth * displayScale}
        height={artboardHeight * displayScale}
        scaleX={displayScale}
        scaleY={displayScale}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) onSelect(null);
        }}
      >
        <Layer>
          <Rect x={0} y={0} width={artboardWidth} height={artboardHeight} fill="#ffffff" stroke="#E5E4ED" />
          {elements.map((el) => {
            const style = ELEMENT_DEFAULTS[el.kind];
            const isSelected = selectedId === el.id;
            return (
              <Rect
                key={el.id}
                ref={(node) => {
                  if (node) shapeRefs.current[el.id] = node;
                  else delete shapeRefs.current[el.id];
                }}
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                fill={style.fill}
                stroke={isSelected ? "#3568E0" : style.stroke}
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
            );
          })}
          {elements.map((el) => (
            <Text
              key={`${el.id}-label`}
              x={el.x + 8}
              y={el.y + 6}
              text={ELEMENT_DEFAULTS[el.kind].label}
              fontSize={12}
              fill={el.kind === "button" ? "#ffffff" : "#7A7788"}
              listening={false}
            />
          ))}
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
