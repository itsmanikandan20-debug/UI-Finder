"use client";

import { Loader2, Search } from "lucide-react";

interface Props {
  summary: string[];
  onConfirm: () => void;
  onBack: () => void;
  searching: boolean;
}

/** Shown after "Analyze Wireframe", before any search happens — the designer confirms this is what they meant before UI-Finder searches the index. */
export function WireframeSummary({ summary, onConfirm, onBack, searching }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-panel">
      <h2 className="mb-3 text-sm font-semibold text-ink">Here&apos;s what I understood from your sketch:</h2>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink-soft">
        {summary.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={searching}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {searching ? "Searching..." : "Okay, Find Matches"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={searching}
          className="rounded-xl border border-border px-4 py-2 text-sm text-ink-soft transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          Back to edit
        </button>
      </div>
    </div>
  );
}
