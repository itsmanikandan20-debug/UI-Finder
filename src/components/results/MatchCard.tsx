"use client";

import { ExternalLink } from "lucide-react";
import type { SearchMatch } from "@/lib/api-types";

export function MatchCard({ match }: { match: SearchMatch }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-panel">
      <div className="flex h-40 items-center justify-center overflow-hidden bg-surface-sunken">
        {match.screenshotUrl ? (
          // This crop comes from the exact same section box the "Open
          // Matching Section" link below points at — see analyzePage.ts,
          // where the screenshot, the scored LayoutNode, and the anchor
          // are all built from the same detected `raw` element.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={match.screenshotUrl} alt="Matching section preview" className="h-full w-full object-cover object-top" />
        ) : (
          <span className="px-4 text-center text-xs text-ink-muted">No preview available</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="truncate text-sm font-semibold text-ink" title={match.websiteTitle || match.domain}>
          {match.websiteTitle || match.domain}
        </h3>
        <p className="truncate text-xs text-ink-muted" title={match.pageUrl}>
          {match.pageUrl}
        </p>

        <a
          href={match.openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          {/* Never "Open Matching Section" unless openUrl can actually
              jump there — see hasPreciseAnchor in src/lib/section-anchor.ts.
              A top-of-page link never gets labeled as if it were precise. */}
          {match.hasPreciseAnchor ? "Open Matching Section" : "Open Live Page"} <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
