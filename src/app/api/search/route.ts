import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMatchableSections } from "@/lib/layout/normalize";
import type { LayoutNode, Wireframe } from "@/lib/layout/types";
import { rankCandidates } from "@/services/matcher/rank";
import { createSectionStore } from "@/services/crawler/store";
import { resolveScreenshotUrl } from "@/lib/screenshot-url";
import type { SearchApiResponse, SectionSearchResult } from "@/lib/api-types";

const layoutNodeSchema: z.ZodType<LayoutNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    kind: z.enum([
      "root",
      "section",
      "row",
      "column",
      "repeated_group",
      "heading",
      "text",
      "image",
      "button",
      "box",
    ]),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    children: z.array(layoutNodeSchema),
    repeat: z
      .object({ count: z.number(), direction: z.enum(["horizontal", "vertical"]) })
      .optional(),
    meta: z
      .object({
        hasImage: z.boolean().optional(),
        hasText: z.boolean().optional(),
        alignment: z.enum(["start", "center", "end", "stretch", "mixed"]).optional(),
        gap: z.number().optional(),
      })
      .optional(),
  })
);

const wireframeSchema = z.object({
  id: z.string(),
  viewport: z.object({
    width: z.number(),
    label: z.enum(["desktop", "tablet", "mobile"]),
  }),
  root: layoutNodeSchema,
  createdAt: z.string(),
});

const bodySchema = z.object({ wireframe: wireframeSchema });

const TOP_K = 9;

export async function POST(req: NextRequest) {
  let wireframe: Wireframe;
  try {
    const json = await req.json();
    wireframe = bodySchema.parse(json).wireframe as Wireframe;
  } catch {
    return NextResponse.json({ error: "Invalid wireframe payload." }, { status: 400 });
  }

  const matchableSections = getMatchableSections(wireframe);
  if (matchableSections.length === 0) {
    return NextResponse.json({ error: "The wireframe is empty — add at least one element first." }, { status: 400 });
  }

  const store = await createSectionStore();
  const candidates = await store.allSections();

  const results: SectionSearchResult[] = matchableSections.map((section) => {
    const ranked = rankCandidates(section, candidates, { topK: TOP_K });
    return {
      wireframeSectionId: section.id,
      matches: ranked.map((r) => ({
        domain: r.section.domain,
        websiteTitle: r.section.websiteTitle,
        pageUrl: r.section.pageUrl,
        screenshotUrl: resolveScreenshotUrl(r.section.screenshotRef),
        score: r.score,
      })),
    };
  });

  const warnings: string[] = [];
  if (candidates.length === 0) {
    warnings.push("The section index is currently empty — run `npm run crawl` to index real pages.");
  }

  const response: SearchApiResponse = {
    results,
    indexedSectionCount: candidates.length,
    warnings,
  };
  return NextResponse.json(response);
}
