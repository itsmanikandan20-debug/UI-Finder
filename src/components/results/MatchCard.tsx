"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, MapPin } from "lucide-react";
import type { SearchMatch } from "@/lib/api-types";

function scoreTone(similarity: number): { bg: string; fg: string } {
  if (similarity >= 75) return { bg: "bg-score-high-bg", fg: "text-score-high" };
  if (similarity >= 50) return { bg: "bg-score-mid-bg", fg: "text-score-mid" };
  return { bg: "bg-score-low-bg", fg: "text-score-low" };
}

// Every value here is read directly from the real ScoreBreakdown the
// matcher computed for this candidate (src/services/matcher/score.ts) —
// never a placeholder or a display-only estimate. "Other" is labeled as
// what it actually measures (an exact repeated-element-count bonus), not
// left as an opaque catch-all.
const BREAKDOWN_ROWS: { key: keyof SearchMatch["score"]; label: string }[] = [
  { key: "structural", label: "Structural" },
  { key: "geometry", label: "Geometry" },
  { key: "spacing", label: "Spacing / alignment" },
  { key: "other", label: "Repeated elements" },
  { key: "visual", label: "Visual (content-mix proxy)" },
];

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-ink-soft">
        <span>{label}</span>
        <span className="tabular-nums text-ink-muted">{pct}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function MatchCard({ rank, match }: { rank: number; match: SearchMatch }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const tone = scoreTone(match.score.similarity);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-panel">
      <div className="flex h-40 items-center justify-center overflow-hidden bg-surface-sunken">
        {match.screenshotUrl ? (
          // This crop comes from the exact same section box the score
          // above was calculated from — see analyzePage.ts, where both
          // the screenshot and the scored LayoutNode are built from the
          // same detected `raw` element.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={match.screenshotUrl} alt="Matching section preview" className="h-full w-full object-cover object-top" />
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
        {!match.hasPreciseAnchor && match.approxPagePosition && (
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <MapPin size={12} /> Matching section detected {match.approxPagePosition}
          </p>
        )}

        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          className="flex items-center gap-1 self-start text-xs text-ink-muted hover:text-ink"
        >
          {showBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Why this matched
        </button>
        {showBreakdown && (
          <div className="flex flex-col gap-2 rounded-xl bg-surface-sunken p-3">
            {BREAKDOWN_ROWS.map((row) => (
              <ScoreBar key={row.key} label={row.label} value={match.score[row.key] as number} />
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2">
          <a
            href={match.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            {match.hasPreciseAnchor ? "Open Matching Section" : "Open Live Page"} <ExternalLink size={14} />
          </a>
          {match.hasPreciseAnchor ? (
            <p className="text-center text-[11px] text-ink-muted">
              Scrolls to the exact spot in Chrome/Edge — other browsers open the page normally.
            </p>
          ) : (
            <p className="text-center text-[11px] text-ink-muted">
              This site can&apos;t be linked directly to the matching section — it will open normally.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
