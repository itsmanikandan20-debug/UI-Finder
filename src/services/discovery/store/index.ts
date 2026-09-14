import { JsonFileDiscoveryQueueStore } from "./json-store";
import type { DiscoveryQueueStore } from "./types";

export type { DiscoveryQueueStore } from "./types";

/** Same DATABASE_URL-gated factory pattern as src/services/crawler/store/index.ts. */
export async function createDiscoveryQueueStore(): Promise<DiscoveryQueueStore> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    const { PostgresDiscoveryQueueStore } = await import("./postgres-store");
    return new PostgresDiscoveryQueueStore(connectionString);
  }
  return new JsonFileDiscoveryQueueStore();
}
