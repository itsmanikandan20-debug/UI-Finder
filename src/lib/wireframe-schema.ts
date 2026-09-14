// Shared zod schema for the wireframe payload both /api/search and
// /api/search-images accept over the wire. Factored out so the two routes
// can't silently drift from each other's validation rules.

import { z } from "zod";
import type { LayoutNode } from "./layout/types";

export const layoutNodeSchema: z.ZodType<LayoutNode> = z.lazy(() =>
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

export const wireframeSchema = z.object({
  id: z.string(),
  viewport: z.object({
    width: z.number(),
    label: z.enum(["desktop", "tablet", "mobile"]),
  }),
  root: layoutNodeSchema,
  createdAt: z.string(),
});
