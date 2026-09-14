export type DiscoveryMethod = "seed" | "sitemap" | "link";
export type DiscoveryStatus = "pending" | "crawled" | "failed" | "blocked" | "rejected";

export interface DiscoveryQueueEntry {
  /** Normalized (see normalize-url.ts) — this is also the dedup key. */
  url: string;
  domain: string;
  discoveryMethod: DiscoveryMethod;
  /** The URL that led here, for traceability — undefined for original seeds. */
  discoveredFrom?: string;
  status: DiscoveryStatus;
  discoveredAt: string;
  /** Set once the entry leaves "pending". */
  resolvedAt?: string;
  /** Why it failed/was rejected/blocked, if applicable. */
  note?: string;
}
