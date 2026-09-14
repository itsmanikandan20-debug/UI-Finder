"use client";

import { ExternalLink, Globe, Loader2 } from "lucide-react";
import type { ImageSearchApiResponse } from "@/lib/api-types";

interface Props {
  status: "idle" | "loading" | "done" | "error";
  response?: ImageSearchApiResponse;
  error?: string;
  onSearch: () => void;
}

/**
 * Additional, optional feature alongside live-website section matching:
 * Gemini turns the wireframe's geometry into a short interpretation + a
 * text search phrase, then SerpApi's Google Images engine searches the real
 * internet with that phrase. Stays inactive (with a plain-English reason)
 * until both GEMINI_API_KEY and SERPAPI_API_KEY are set.
 */
export function ImageSearchPanel({ status, response, error, onSearch }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Globe size={16} className="text-brand-600" />
          Search the internet for similar UI designs
        </h2>
        <button
          type="button"
          onClick={onSearch}
          disabled={status === "loading"}
          className="flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-sm text-ink-soft transition hover:border-brand-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
          {status === "loading" ? "Searching the web..." : "Search the Internet"}
        </button>
      </div>

      {status === "error" && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {status === "done" && response && !response.configured && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{response.message}</p>
      )}

      {status === "done" && response?.configured && !response.understanding && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{response.message}</p>
      )}

      {status === "done" && response?.understanding && (
        <div className="mt-3 space-y-1 rounded-xl bg-surface-sunken p-4 text-sm text-ink-soft">
          <p>
            <span className="font-medium text-ink">Detected UI pattern:</span> {response.understanding.detectedPattern}
          </p>
          <p>
            <span className="font-medium text-ink">Structure:</span> {response.understanding.structure}
          </p>
          <p>
            <span className="font-medium text-ink">Layout:</span> {response.understanding.layout}
          </p>
        </div>
      )}

      {status === "done" && response?.understanding && response.images.length === 0 && (
        <p className="mt-3 text-sm text-ink-muted">{response.message ?? "No images found for this search."}</p>
      )}

      {status === "done" && response && response.images.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {response.images.map((img, i) => (
            <div
              key={`${img.sourceUrl}-${i}`}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-panel"
            >
              <div className="flex h-40 items-center justify-center overflow-hidden bg-surface-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.thumbnailUrl ?? img.imageUrl}
                  alt="UI design reference found on the internet"
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="truncate text-xs text-ink-muted" title={img.sourceUrl}>
                  {img.sourceTitle || img.sourceUrl}
                </p>
                <a
                  href={img.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
                >
                  Open Source Page <ExternalLink size={14} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
