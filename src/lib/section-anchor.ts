// Builds a best-effort deep link to the exact matched section on a live
// page, and an honest fallback description when one isn't possible — per
// the product requirement that a result must never silently claim more
// precision than it has.
//
// The mechanism is a browser "scroll to text" fragment
// (https://example.com/page#:~:text=some%20visible%20text), supported by
// Chrome and Edge; other browsers simply ignore the fragment and open
// the page normally. It's built from a short snippet of the section's
// own visible text (ExtractedSection.anchorSnippet), captured purely for
// this navigation purpose and never used anywhere in scoring.

export interface SectionAnchor {
  /** URL to open for "Open Matching Section" — a text-fragment deep link when possible, else the plain page URL. */
  openUrl: string;
  /** True when openUrl can actually jump to the section (Chrome/Edge); false means it just opens the page. */
  hasPreciseAnchor: boolean;
  /** Human-readable fallback, e.g. "≈34% down the page" — shown when hasPreciseAnchor is false. */
  approxPagePosition?: string;
}

export function buildSectionAnchor(
  pageUrl: string,
  anchorSnippet: string | undefined,
  pageYRatio: number | undefined
): SectionAnchor {
  const approxPagePosition =
    typeof pageYRatio === "number" ? `≈${Math.round(pageYRatio * 100)}% down the page` : undefined;

  const snippet = anchorSnippet?.trim();
  if (!snippet || snippet.length < 3) {
    return { openUrl: pageUrl, hasPreciseAnchor: false, approxPagePosition };
  }

  try {
    const url = new URL(pageUrl);
    const existingHash = url.hash ? url.hash.slice(1) : "";
    url.hash = `${existingHash}:~:text=${encodeURIComponent(snippet)}`;
    return { openUrl: url.toString(), hasPreciseAnchor: true, approxPagePosition };
  } catch {
    return { openUrl: pageUrl, hasPreciseAnchor: false, approxPagePosition };
  }
}
