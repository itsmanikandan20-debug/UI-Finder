-- The section's original absolute box on the crawled page (CSS pixels at
-- viewport_width) — the exact region the screenshot and LayoutNode came
-- from. Not used in scoring; exposed via the API so a result can point
-- at precisely where on the page it came from. See
-- ExtractedSection.pageBox in src/lib/layout/types.ts.

alter table sections add column if not exists page_box jsonb;
