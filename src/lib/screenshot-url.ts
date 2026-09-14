/** A stored screenshotRef is either a full object-storage URL (production/Postgres) or a local filename (dev JSON store). */
export function resolveScreenshotUrl(ref?: string): string | undefined {
  if (!ref) return undefined;
  if (ref.startsWith("http://") || ref.startsWith("https://")) return ref;
  return `/api/screenshots/${encodeURIComponent(ref)}`;
}
