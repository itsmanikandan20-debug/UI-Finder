export function clamp01(v: number): number {
  if (Number.isNaN(v) || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/** 1.0 when x === y, decaying toward 0 as they diverge relative to their scale. */
export function ratioSimilarity(x: number, y: number): number {
  const diff = Math.abs(x - y);
  const scale = Math.max(Math.abs(x), Math.abs(y));
  if (scale < 1e-6) return 1;
  return clamp01(1 - diff / scale);
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}
