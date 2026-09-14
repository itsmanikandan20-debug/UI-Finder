"use client";

import { useState } from "react";
import type { SearchApiResponse } from "@/lib/api-types";
import { MatchCard } from "./MatchCard";

export function ResultsPanel({ response }: { response: SearchApiResponse }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (response.indexedSectionCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-white p-8 text-center text-sm text-ink-muted">
        The section index is empty, so there is nothing yet to compare your wireframe against.
        <br />
        Run{" "}
        <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-ink">npm run crawl</code>{" "}
        to index some real pages first — see the README.
      </div>
    );
  }

  const section = response.results[activeIndex];
  if (!section) return null;

  return (
    <div>
      {response.results.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {response.results.map((r, i) => (
            <button
              key={r.wireframeSectionId}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                i === activeIndex
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-border text-ink-muted hover:text-ink"
              }`}
            >
              Section {i + 1}
            </button>
          ))}
        </div>
      )}

      {section.matches.length === 0 ? (
        <p className="text-sm text-ink-muted">No matches found for this section.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {section.matches.map((m, i) => (
            <MatchCard key={`${m.pageUrl}-${i}`} rank={i + 1} match={m} />
          ))}
        </div>
      )}

      {response.warnings.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-amber-700">
          {response.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
