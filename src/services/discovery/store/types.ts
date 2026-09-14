import type { DiscoveryQueueEntry, DiscoveryStatus } from "../types";

export interface DiscoveryQueueStore {
  /** Inserts a new pending entry, or does nothing if this normalized URL is already queued/resolved. */
  enqueue(entry: DiscoveryQueueEntry): Promise<void>;
  /** True if this normalized URL already exists in the queue, in any status. */
  has(url: string): Promise<boolean>;
  /** Up to `limit` pending entries, prioritizing one per domain before repeating a domain. */
  takeBatch(limit: number): Promise<DiscoveryQueueEntry[]>;
  updateStatus(url: string, status: DiscoveryStatus, note?: string): Promise<void>;
  size(): Promise<{ pending: number; total: number }>;
}
