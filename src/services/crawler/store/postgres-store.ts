// Production store: Supabase/Postgres + pgvector. Behind the exact same
// SectionStore interface as the local JSON store, so the app, the
// crawler, and the tests never need to know which one is active — see
// store/index.ts's factory.

import postgres from "postgres";
import { layoutSignature, SIGNATURE_LENGTH } from "@/lib/layout/signature";
import type { ExtractedSection, LayoutNode, WebsiteRecord } from "@/lib/layout/types";
import type { SectionStore } from "./types";

type Sql = ReturnType<typeof postgres>;

export class PostgresSectionStore implements SectionStore {
  private sql: Sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 3 });
  }

  async saveWebsite(record: WebsiteRecord): Promise<void> {
    await this.sql`
      insert into websites (id, domain, page_url, title, status, last_crawled_at, crawler_version)
      values (
        ${record.id}, ${record.domain}, ${record.pageUrl}, ${record.title ?? null}, ${record.status},
        ${record.lastCrawledAt ?? null}, ${record.crawlerVersion ?? null}
      )
      on conflict (page_url) do update set
        title = excluded.title,
        status = excluded.status,
        last_crawled_at = excluded.last_crawled_at,
        crawler_version = excluded.crawler_version
    `;
  }

  async saveSection(section: ExtractedSection): Promise<void> {
    const vec = layoutSignature(section.root);
    const vecLiteral = `[${vec.join(",")}]`;
    await this.sql`
      insert into sections (
        id, website_id, page_url, domain, website_title, section_index, dom_selector, viewport_width,
        structure_json, layout_embedding, screenshot_ref, anchor_snippet, page_y_ratio, page_box, crawled_at
      ) values (
        ${section.id}, ${section.websiteId}, ${section.pageUrl}, ${section.domain}, ${section.websiteTitle ?? null},
        ${section.sectionIndex}, ${section.domSelector}, ${section.viewportWidth},
        ${this.sql.json(section.root as never)},
        ${vecLiteral}::vector(${SIGNATURE_LENGTH}),
        ${section.screenshotRef ?? null}, ${section.anchorSnippet ?? null}, ${section.pageYRatio ?? null},
        ${section.pageBox ? this.sql.json(section.pageBox as never) : null},
        ${section.crawledAt}
      )
      on conflict (id) do update set
        domain = excluded.domain,
        website_title = excluded.website_title,
        structure_json = excluded.structure_json,
        layout_embedding = excluded.layout_embedding,
        screenshot_ref = excluded.screenshot_ref,
        anchor_snippet = excluded.anchor_snippet,
        page_y_ratio = excluded.page_y_ratio,
        page_box = excluded.page_box,
        crawled_at = excluded.crawled_at
    `;
  }

  async allSections(): Promise<ExtractedSection[]> {
    const rows = await this.sql<
      {
        id: string;
        website_id: string;
        page_url: string;
        domain: string;
        website_title: string | null;
        section_index: number;
        dom_selector: string;
        viewport_width: number;
        structure_json: LayoutNode;
        screenshot_ref: string | null;
        anchor_snippet: string | null;
        page_y_ratio: number | null;
        page_box: { x: number; y: number; width: number; height: number } | null;
        crawled_at: string;
      }[]
    >`
      select id, website_id, page_url, domain, website_title, section_index, dom_selector, viewport_width,
             structure_json, screenshot_ref, anchor_snippet, page_y_ratio, page_box, crawled_at
      from sections
      limit 5000
    `;
    return rows.map((r) => ({
      id: r.id,
      websiteId: r.website_id,
      pageUrl: r.page_url,
      domain: r.domain,
      websiteTitle: r.website_title ?? undefined,
      sectionIndex: r.section_index,
      domSelector: r.dom_selector,
      viewportWidth: r.viewport_width,
      root: r.structure_json,
      screenshotRef: r.screenshot_ref ?? undefined,
      anchorSnippet: r.anchor_snippet ?? undefined,
      pageYRatio: r.page_y_ratio ?? undefined,
      pageBox: r.page_box ?? undefined,
      crawledAt: r.crawled_at,
    }));
  }

  async getWebsiteByUrl(pageUrl: string): Promise<WebsiteRecord | null> {
    const rows = await this.sql<
      {
        id: string;
        domain: string;
        page_url: string;
        title: string | null;
        status: string;
        last_crawled_at: string | null;
        crawler_version: number | null;
      }[]
    >`
      select id, domain, page_url, title, status, last_crawled_at, crawler_version
      from websites where page_url = ${pageUrl} limit 1
    `;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      domain: r.domain,
      pageUrl: r.page_url,
      title: r.title ?? undefined,
      status: r.status as WebsiteRecord["status"],
      lastCrawledAt: r.last_crawled_at ?? undefined,
      crawlerVersion: r.crawler_version ?? undefined,
    };
  }
}
