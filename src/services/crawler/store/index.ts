import { JsonFileSectionStore } from "./json-store";
import type { SectionStore } from "./types";

export type { SectionStore } from "./types";

/**
 * DATABASE_URL set → Supabase/Postgres + pgvector.
 * Unset → the local JSON store (seed fixtures + gitignored local file),
 * so the app runs fully with zero setup. Async because the Postgres
 * driver is only imported when actually needed.
 */
export async function createSectionStore(): Promise<SectionStore> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    const { PostgresSectionStore } = await import("./postgres-store");
    return new PostgresSectionStore(connectionString);
  }
  return new JsonFileSectionStore();
}
