"use client";

import { Copy, Trash2, Wand2 } from "lucide-react";
import type { ViewportLabel } from "@/lib/layout/types";

interface Props {
  viewportLabel: ViewportLabel;
  onViewportChange: (v: ViewportLabel) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClear: () => void;
  onAnalyze: () => void;
  canEdit: boolean;
  canAnalyze: boolean;
}

export function Toolbar({
  viewportLabel,
  onViewportChange,
  onDuplicate,
  onDelete,
  onClear,
  onAnalyze,
  canEdit,
  canAnalyze,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-white p-3 shadow-panel">
      <p className="text-sm text-ink-muted">Draw directly on the canvas below — click and drag to sketch a shape.</p>

      <div className="mx-1 h-6 w-px bg-border" />

      <button
        type="button"
        onClick={onDuplicate}
        disabled={!canEdit}
        className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm text-ink-soft transition hover:border-brand-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Copy size={16} /> Duplicate
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!canEdit}
        className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm text-red-600 transition hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 size={16} /> Delete
      </button>
      <button
        type="button"
        onClick={onClear}
        className="rounded-xl px-3 py-1.5 text-sm text-ink-muted transition hover:text-ink"
      >
        Clear all
      </button>

      <div className="ml-auto flex items-center gap-2">
        <select
          value={viewportLabel}
          onChange={(e) => onViewportChange(e.target.value as ViewportLabel)}
          className="rounded-xl border border-border bg-white px-2 py-1.5 text-sm text-ink-soft"
        >
          <option value="desktop">Desktop · 1440</option>
          <option value="tablet">Tablet · 768</option>
          <option value="mobile">Mobile · 390</option>
        </select>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canAnalyze}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Wand2 size={16} />
          Analyze Wireframe
        </button>
      </div>
    </div>
  );
}
