-- Tracks which version of the extraction logic (CRAWLER_VERSION in
-- src/services/crawler/analyzePage.ts) produced a website's cached
-- sections. scripts/crawl.ts's time-based re-crawl cache only reuses a
-- record when this matches the current version, so a crawler code
-- change always gets fresh data on the next `npm run crawl` instead of
-- silently serving stale results for up to 14 days.

alter table websites add column if not exists crawler_version int;
