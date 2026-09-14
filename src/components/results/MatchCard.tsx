"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { SearchMatch } from "@/lib/api-types";

function scoreTone(similarity: number): { bg: string; fg: string } {
  if (similarity >= 75) return { bg: "bg-score-high-bg", fg: "text-score-high" };
  if (similarity >= 50) return { bg: "bg-score-mid-bg", fg: "text-score-mid" };
  return { bg: "bg-score-low-bg", fg: "text-score-low" };
}

export function MatchCard({ rank, match }: { rank: number; match: SearchMatch }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const tone = scoreTone(match.score.similarity);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-panel">
      <div className="flex h-40 items-center justify-center overflow-hidden bg-surface-sunken">
        {match.screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={match.screenshotUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <span className="px-4 text-center text-xs text-ink-muted">No preview available</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Match {String(rank).padStart(2, "0")}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone.bg} ${tone.fg}`}>
            {match.score.similarity} similarity
          </span>
        </div>

        <h3 className="truncate text-sm font-semibold text-ink" title={match.websiteTitle || match.domain}>
          {match.websiteTitle || match.domain}
        </h3>
        <p className="truncate text-xs text-ink-muted" title={match.pageUrl}>
          {match.pageUrl}
        </p>

        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          className="flex items-center gap-1 self-start text-xs text-ink-muted hover:text-ink"
        >
          {showBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Score breakdown
        </button>
        {showBreakdown && (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-surface-sunken p-3 text-xs text-ink-soft">
            <dt>Structural</dt>
            <dd className="text-right">{Math.round(match.score.structural * 100)}</dd>
            <dt>Geometry</dt>
            <dd className="text-right">{Math.round(match.score.geometry * 100)}</dd>
            <dt>Spacing/alignment</dt>
            <dd className="text-right">{Math.round(match.score.spacing * 100)}</dd>
            <dt>Visual (content-mix proxy)</dt>
            <dd className="text-right">{Math.round(match.score.visual * 100)}</dd>
            <dt>Other</dt>
            <dd className="text-right">{Math.round(match.score.other * 100)}</dd>
          </dl>
        )}

        <a
          href={match.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          Open Live Website <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
