import type { ExtractedSection, WebsiteRecord } from "@/lib/layout/types";

export interface SectionStore {
  saveWebsite(record: WebsiteRecord): Promise<void>;
  saveSection(section: ExtractedSection): Promise<void>;
  allSections(): Promise<ExtractedSection[]>;
  getWebsiteByUrl(pageUrl: string): Promise<WebsiteRecord | null>;
}
