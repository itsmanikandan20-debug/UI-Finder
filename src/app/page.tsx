"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Toolbar } from "@/components/canvas/Toolbar";
import { useEditorState } from "@/features/wireframe-editor/useEditorState";
import { normalizeWireframe } from "@/lib/layout/normalize";
import { describeWireframe } from "@/lib/layout/describe";
import { WireframeSummary } from "@/components/results/WireframeSummary";
import { ResultsPanel } from "@/components/results/ResultsPanel";
import type { SearchApiResponse, SearchRequestBody } from "@/lib/api-types";
import type { Wireframe } from "@/lib/layout/types";

// Konva touches `window` at import time — must never run during SSR.
const WireframeCanvas = dynamic(
  () => import("@/components/canvas/WireframeCanvas").then((m) => m.WireframeCanvas),
  { ssr: false, loading: () => <div className="h-[500px] animate-pulse rounded-2xl bg-surface-sunken" /> }
);

// Draw → Analyze (show what was understood) → confirm → Search → Results.
// The search API is never called until the designer confirms the summary.
type Stage = "editing" | "reviewing" | "results";

export default function HomePage() {
  const editor = useEditorState();
  const [stage, setStage] = useState<Stage>("editing");
  const [wireframe, setWireframe] = useState<Wireframe | null>(null);
  const [summary, setSummary] = useState<string[]>([]);
  const [results, setResults] = useState<SearchApiResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAnalyze() {
    setError(null);
    const doc = editor.exportDocument();
    const nextWireframe = normalizeWireframe(doc, doc.id, new Date().toISOString());
    setWireframe(nextWireframe);
    setSummary(describeWireframe(nextWireframe));
    setResults(null);
    setStage("reviewing");
  }

  function handleBackToEdit() {
    setStage("editing");
  }

  async function handleConfirmSearch() {
    if (!wireframe) return;
    setSearching(true);
    setError(null);
    try {
      const body: SearchRequestBody = { wireframe };
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Search failed.");
      }
      setResults((await res.json()) as SearchApiResponse);
      setStage("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="mx-auto max-w-content px-4 py-8 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">UI-Finder</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Sketch a rough layout — position, size and grouping only, no exact text, colors, or
          brand names needed — and find real, live websites whose sections match its structure.
        </p>
      </header>

      <Toolbar
        viewportLabel={editor.viewportLabel}
        onViewportChange={editor.setViewportLabel}
        onAdd={editor.addElement}
        onDuplicate={editor.duplicateSelected}
        onDelete={editor.deleteSelected}
        onClear={editor.clearAll}
        onAnalyze={handleAnalyze}
        canEdit={editor.selectedId !== null}
        canAnalyze={editor.elements.length > 0}
      />

      <div className="mt-4">
        <WireframeCanvas
          elements={editor.elements}
          selectedId={editor.selectedId}
          artboardWidth={editor.artboardWidth}
          artboardHeight={editor.artboardHeight}
          onSelect={editor.setSelectedId}
          onChange={editor.updateElement}
        />
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        Tip: drop a Heading and a few Boxes/Images inside a Section, then select one and hit
        Duplicate a couple of times to sketch a repeated card row — elements inside a
        Section/Row/Column are grouped automatically by position, no manual nesting needed.
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {(stage === "reviewing" || stage === "results") && (
        <div className="mt-6">
          <WireframeSummary
            summary={summary}
            onConfirm={handleConfirmSearch}
            onBack={handleBackToEdit}
            searching={searching}
          />
        </div>
      )}

      {stage === "results" && results && (
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-ink">Matches</h2>
          <ResultsPanel response={results} />
        </div>
      )}
    </main>
  );
}
