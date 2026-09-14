// Zero-setup default, same philosophy as the section index's JSON store
// (src/services/crawler/store/json-store.ts): a single gitignored local
// file, read/written on every call. Fine at the scale a local discovery
// run actually operates at (tens to low hundreds of queued URLs).

import { promises as fs } from "node:fs";
import path from "node:path";
import type { DiscoveryQueueEntry, DiscoveryStatus } from "../types";
import type { DiscoveryQueueStore } from "./types";

const DEFAULT_QUEUE_PATH = path.join(process.cwd(), "data", "discovery-queue.local.json");

interface QueueFile {
  entries: DiscoveryQueueEntry[];
}

async function readQueue(queuePath: string): Promise<QueueFile> {
  try {
    const raw = await fs.readFile(queuePath, "utf-8");
    const parsed = JSON.parse(raw);
    return { entries: parsed.entries ?? [] };
  } catch {
    return { entries: [] };
  }
}

async function writeQueue(queuePath: string, data: QueueFile): Promise<void> {
  await fs.mkdir(path.dirname(queuePath), { recursive: true });
  await fs.writeFile(queuePath, JSON.stringify(data, null, 2));
}

/** Round-robins across domains so a batch doesn't fill up with 10 pages from the same site. */
function pickDiverseBatch(pending: DiscoveryQueueEntry[], limit: number): DiscoveryQueueEntry[] {
  const byDomain = new Map<string, DiscoveryQueueEntry[]>();
  for (const entry of pending) {
    const list = byDomain.get(entry.domain) ?? [];
    list.push(entry);
    byDomain.set(entry.domain, list);
  }
  const domainQueues = Array.from(byDomain.values());
  const picked: DiscoveryQueueEntry[] = [];
  let round = 0;
  while (picked.length < limit) {
    let addedThisRound = false;
    for (const queue of domainQueues) {
      if (picked.length >= limit) break;
      if (round < queue.length) {
        picked.push(queue[round]);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
    round += 1;
  }
  return picked;
}

export class JsonFileDiscoveryQueueStore implements DiscoveryQueueStore {
  constructor(private readonly queuePath: string = DEFAULT_QUEUE_PATH) {}

  async enqueue(entry: DiscoveryQueueEntry): Promise<void> {
    const data = await readQueue(this.queuePath);
    if (data.entries.some((e) => e.url === entry.url)) return;
    data.entries.push(entry);
    await writeQueue(this.queuePath, data);
  }

  async has(url: string): Promise<boolean> {
    const data = await readQueue(this.queuePath);
    return data.entries.some((e) => e.url === url);
  }

  async takeBatch(limit: number): Promise<DiscoveryQueueEntry[]> {
    const data = await readQueue(this.queuePath);
    const pending = data.entries.filter((e) => e.status === "pending");
    return pickDiverseBatch(pending, limit);
  }

  async updateStatus(url: string, status: DiscoveryStatus, note?: string): Promise<void> {
    const data = await readQueue(this.queuePath);
    const entry = data.entries.find((e) => e.url === url);
    if (!entry) return;
    entry.status = status;
    entry.resolvedAt = new Date().toISOString();
    if (note) entry.note = note;
    await writeQueue(this.queuePath, data);
  }

  async size(): Promise<{ pending: number; total: number }> {
    const data = await readQueue(this.queuePath);
    return { pending: data.entries.filter((e) => e.status === "pending").length, total: data.entries.length };
  }
}
