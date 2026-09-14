// Zero-setup default: a small checked-in fixture dataset
// (data/sections.seed.json, produced by actually running the crawler —
// see scripts/crawl.ts) plus a gitignored local file that crawls during
// development append to. This is what makes the app work end-to-end with
// no database at all, mirroring the "works with zero setup" bar the rest
// of the project holds itself to.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExtractedSection, WebsiteRecord } from "@/lib/layout/types";
import type { SectionStore } from "./types";

const SEED_PATH = path.join(process.cwd(), "data", "sections.seed.json");
const LOCAL_PATH = path.join(process.cwd(), "data", "sections.local.json");

interface JsonDataset {
  websites: WebsiteRecord[];
  sections: ExtractedSection[];
}

const EMPTY_DATASET: JsonDataset = { websites: [], sections: [] };

async function readJson(file: string): Promise<JsonDataset> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw);
    return { websites: parsed.websites ?? [], sections: parsed.sections ?? [] };
  } catch {
    return { ...EMPTY_DATASET };
  }
}

export class JsonFileSectionStore implements SectionStore {
  async saveWebsite(record: WebsiteRecord): Promise<void> {
    const data = await readJson(LOCAL_PATH);
    const idx = data.websites.findIndex((w) => w.pageUrl === record.pageUrl);
    if (idx >= 0) data.websites[idx] = record;
    else data.websites.push(record);
    await this.write(data);
  }

  async saveSection(section: ExtractedSection): Promise<void> {
    const data = await readJson(LOCAL_PATH);
    const idx = data.sections.findIndex((s) => s.id === section.id);
    if (idx >= 0) data.sections[idx] = section;
    else data.sections.push(section);
    await this.write(data);
  }

  async allSections(): Promise<ExtractedSection[]> {
    const [seed, local] = await Promise.all([readJson(SEED_PATH), readJson(LOCAL_PATH)]);
    return [...seed.sections, ...local.sections];
  }

  async getWebsiteByUrl(pageUrl: string): Promise<WebsiteRecord | null> {
    const [seed, local] = await Promise.all([readJson(SEED_PATH), readJson(LOCAL_PATH)]);
    const found = [...local.websites, ...seed.websites].find((w) => w.pageUrl === pageUrl);
    return found ?? null;
  }

  private async write(data: JsonDataset): Promise<void> {
    await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
    await fs.writeFile(LOCAL_PATH, JSON.stringify(data, null, 2));
  }
}
