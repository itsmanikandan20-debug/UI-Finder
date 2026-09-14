import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { JsonFileDiscoveryQueueStore } from "../store/json-store";
import { seedQueueIfEmpty, enqueueDiscovered } from "../queue-helpers";

describe("seedQueueIfEmpty", () => {
  let tmpPath: string;
  let store: JsonFileDiscoveryQueueStore;

  beforeEach(() => {
    tmpPath = path.join(os.tmpdir(), `discovery-seed-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    store = new JsonFileDiscoveryQueueStore(tmpPath);
  });

  afterEach(async () => {
    await fs.rm(tmpPath, { force: true });
  });

  it("seeds from the given URL list, skipping blocked domains", async () => {
    const added = await seedQueueIfEmpty(store, [
      "https://real-company.com",
      "https://facebook.com/somepage",
      "https://another-real-site.io/",
    ]);
    expect(added).toBe(2);
    const { total } = await store.size();
    expect(total).toBe(2);
  });

  it("does nothing if the queue already has entries", async () => {
    await store.enqueue({
      url: "https://existing.com/",
      domain: "existing.com",
      discoveryMethod: "seed",
      status: "pending",
      discoveredAt: new Date().toISOString(),
    });
    const added = await seedQueueIfEmpty(store, ["https://should-not-be-added.com"]);
    expect(added).toBe(0);
    const { total } = await store.size();
    expect(total).toBe(1);
  });
});

describe("enqueueDiscovered", () => {
  let tmpPath: string;
  let store: JsonFileDiscoveryQueueStore;

  beforeEach(() => {
    tmpPath = path.join(os.tmpdir(), `discovery-enqueue-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    store = new JsonFileDiscoveryQueueStore(tmpPath);
  });

  afterEach(async () => {
    await fs.rm(tmpPath, { force: true });
  });

  it("filters out blocked domains and invalid URLs", async () => {
    const added = await enqueueDiscovered(
      store,
      ["https://facebook.com/x", "not a url", "https://partner.example.com/"],
      "https://source.example.com/",
      "link"
    );
    expect(added).toBe(1);
    const batch = await store.takeBatch(10);
    expect(batch).toHaveLength(1);
    expect(batch[0].url).toBe("https://partner.example.com/");
    expect(batch[0].discoveredFrom).toBe("https://source.example.com/");
    expect(batch[0].discoveryMethod).toBe("link");
  });

  it("does not re-add a URL that's already queued", async () => {
    await enqueueDiscovered(store, ["https://partner.example.com/"], "https://a.com/", "link");
    const addedAgain = await enqueueDiscovered(store, ["https://partner.example.com/"], "https://b.com/", "sitemap");
    expect(addedAgain).toBe(0);
    const { total } = await store.size();
    expect(total).toBe(1);
  });
});
