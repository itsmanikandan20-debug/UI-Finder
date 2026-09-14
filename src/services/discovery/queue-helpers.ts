// Pure(ish) queue-population logic shared by scripts/discover-and-crawl.ts,
// pulled out of the script so it's actually unit-testable — the script
// itself is a thin loop that also calls the real crawler and network
// (sitemap fetch), neither of which can run in a test.

import { isBlockedDomain } from "./blocklist";
import { normalizeUrlForDedup, getDomain } from "./normalize-url";
import type { DiscoveryMethod } from "./types";
import type { DiscoveryQueueStore } from "./store/types";

/** Seeds the queue from a fixed URL list, filtering out blocked/invalid ones. Skips entirely if the queue already has anything. */
export async function seedQueueIfEmpty(queue: DiscoveryQueueStore, seedUrls: string[]): Promise<number> {
  const { total } = await queue.size();
  if (total > 0) return 0;

  let added = 0;
  for (const url of seedUrls) {
    const normalized = normalizeUrlForDedup(url);
    const domain = normalized ? getDomain(normalized) : null;
    if (!normalized || !domain || isBlockedDomain(domain)) continue;
    await queue.enqueue({
      url: normalized,
      domain,
      discoveryMethod: "seed",
      status: "pending",
      discoveredAt: new Date().toISOString(),
    });
    added += 1;
  }
  return added;
}

/** Filters, dedupes, and enqueues candidate URLs found while crawling. Returns how many were genuinely new. */
export async function enqueueDiscovered(
  queue: DiscoveryQueueStore,
  candidateUrls: string[],
  discoveredFrom: string,
  method: DiscoveryMethod
): Promise<number> {
  let added = 0;
  for (const raw of candidateUrls) {
    const normalized = normalizeUrlForDedup(raw);
    if (!normalized) continue;
    const domain = getDomain(normalized);
    if (!domain || isBlockedDomain(domain)) continue;
    if (await queue.has(normalized)) continue;
    await queue.enqueue({
      url: normalized,
      domain,
      discoveryMethod: method,
      discoveredFrom,
      status: "pending",
      discoveredAt: new Date().toISOString(),
    });
    added += 1;
  }
  return added;
}
