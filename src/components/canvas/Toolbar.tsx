"use client";

import {
  Heading1,
  Type,
  Image as ImageIcon,
  RectangleHorizontal,
  Columns,
  Rows,
  SquareStack,
  Square,
  Copy,
  Trash2,
  Search,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EditorElementKind, ViewportLabel } from "@/lib/layout/types";
import { ELEMENT_DEFAULTS } from "@/features/wireframe-editor/types";

interface Props {
  viewportLabel: ViewportLabel;
  onViewportChange: (v: ViewportLabel) => void;
  onAdd: (kind: EditorElementKind) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClear: () => void;
  onFindMatches: () => void;
  canEdit: boolean;
  canSearch: boolean;
  searching: boolean;
}

const ADDABLE: { kind: EditorElementKind; icon: LucideIcon }[] = [
  { kind: "section", icon: SquareStack },
  { kind: "row", icon: Rows },
  { kind: "column", icon: Columns },
  { kind: "heading", icon: Heading1 },
  { kind: "text", icon: Type },
  { kind: "image", icon: ImageIcon },
  { kind: "button", icon: RectangleHorizontal },
  { kind: "box", icon: Square },
];

export function Toolbar({
  viewportLabel,
  onViewportChange,
  onAdd,
  onDuplicate,
  onDelete,
  onClear,
  onFindMatches,
  canEdit,
  canSearch,
  searching,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-white p-3 shadow-panel">
      {ADDABLE.map(({ kind, icon: Icon }) => (
        <button
          key={kind}
          type="button"
          onClick={() => onAdd(kind)}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm text-ink-soft transition hover:border-brand-400 hover:text-brand-600"
        >
          <Icon size={16} />
          {ELEMENT_DEFAULTS[kind].label}
        </button>
      ))}

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
          onClick={onFindMatches}
          disabled={searching || !canSearch}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {searching ? "Searching..." : "Find Matches"}
        </button>
      </div>
    </div>
  );
}
