import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { JsonFileDiscoveryQueueStore } from "../json-store";
import type { DiscoveryQueueEntry } from "../../types";

function makeEntry(overrides: Partial<DiscoveryQueueEntry> = {}): DiscoveryQueueEntry {
  return {
    url: "https://example.com/",
    domain: "example.com",
    discoveryMethod: "seed",
    status: "pending",
    discoveredAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("JsonFileDiscoveryQueueStore", () => {
  let tmpPath: string;
  let store: JsonFileDiscoveryQueueStore;

  beforeEach(() => {
    tmpPath = path.join(os.tmpdir(), `discovery-queue-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    store = new JsonFileDiscoveryQueueStore(tmpPath);
  });

  afterEach(async () => {
    await fs.rm(tmpPath, { force: true });
  });

  it("enqueues and reports it as present", async () => {
    await store.enqueue(makeEntry());
    expect(await store.has("https://example.com/")).toBe(true);
    expect(await store.has("https://other.com/")).toBe(false);
  });

  it("does not duplicate an already-queued URL", async () => {
    await store.enqueue(makeEntry());
    await store.enqueue(makeEntry());
    const size = await store.size();
    expect(size.total).toBe(1);
  });

  it("takeBatch only returns pending entries, round-robined across domains", async () => {
    await store.enqueue(makeEntry({ url: "https://a.com/1", domain: "a.com" }));
    await store.enqueue(makeEntry({ url: "https://a.com/2", domain: "a.com" }));
    await store.enqueue(makeEntry({ url: "https://b.com/1", domain: "b.com" }));
    await store.updateStatus("https://a.com/1", "crawled");

    const batch = await store.takeBatch(2);
    expect(batch).toHaveLength(2);
    // Round-robin should pick one from each domain before repeating a.com.
    const domains = batch.map((e) => e.domain);
    expect(new Set(domains).size).toBe(2);
  });

  it("updateStatus marks an entry resolved and records a note", async () => {
    await store.enqueue(makeEntry());
    await store.updateStatus("https://example.com/", "failed", "timed out");
    const size = await store.size();
    expect(size.pending).toBe(0);
    expect(size.total).toBe(1);
  });
});
