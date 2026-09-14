import postgres from "postgres";
import type { DiscoveryQueueEntry, DiscoveryStatus } from "../types";
import type { DiscoveryQueueStore } from "./types";

type Sql = ReturnType<typeof postgres>;

export class PostgresDiscoveryQueueStore implements DiscoveryQueueStore {
  private sql: Sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 3 });
  }

  async enqueue(entry: DiscoveryQueueEntry): Promise<void> {
    await this.sql`
      insert into discovery_queue (url, domain, discovery_method, discovered_from, status, discovered_at)
      values (${entry.url}, ${entry.domain}, ${entry.discoveryMethod}, ${entry.discoveredFrom ?? null}, ${entry.status}, ${entry.discoveredAt})
      on conflict (url) do nothing
    `;
  }

  async has(url: string): Promise<boolean> {
    const rows = await this.sql`select 1 from discovery_queue where url = ${url} limit 1`;
    return rows.length > 0;
  }

  async takeBatch(limit: number): Promise<DiscoveryQueueEntry[]> {
    // One row per domain per "round", via row_number() partitioned by
    // domain — the same diversity goal as the JSON store's round-robin,
    // expressed as a single query.
    const rows = await this.sql<
      {
        url: string;
        domain: string;
        discovery_method: string;
        discovered_from: string | null;
        status: string;
        discovered_at: string;
      }[]
    >`
      select url, domain, discovery_method, discovered_from, status, discovered_at from (
        select *, row_number() over (partition by domain order by discovered_at asc) as rn
        from discovery_queue
        where status = 'pending'
      ) ranked
      order by rn asc, discovered_at asc
      limit ${limit}
    `;
    return rows.map((r) => ({
      url: r.url,
      domain: r.domain,
      discoveryMethod: r.discovery_method as DiscoveryQueueEntry["discoveryMethod"],
      discoveredFrom: r.discovered_from ?? undefined,
      status: r.status as DiscoveryStatus,
      discoveredAt: r.discovered_at,
    }));
  }

  async updateStatus(url: string, status: DiscoveryStatus, note?: string): Promise<void> {
    await this.sql`
      update discovery_queue
      set status = ${status}, resolved_at = now(), note = ${note ?? null}
      where url = ${url}
    `;
  }

  async size(): Promise<{ pending: number; total: number }> {
    const rows = await this.sql<{ pending: number; total: number }[]>`
      select
        count(*) filter (where status = 'pending')::int as pending,
        count(*)::int as total
      from discovery_queue
    `;
    return rows[0] ?? { pending: 0, total: 0 };
  }
}
