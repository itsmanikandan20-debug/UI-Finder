-- Navigation-only fields for "Open Matching Section": a short in-section
-- text snippet (for a browser "scroll to text" deep link) and how far
-- down the page the section sits. Neither is ever read by the matcher —
-- see ExtractedSection.anchorSnippet / pageYRatio in
-- src/lib/layout/types.ts.

alter table sections add column if not exists anchor_snippet text;
alter table sections add column if not exists page_y_ratio real;
