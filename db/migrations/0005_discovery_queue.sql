-- Bookkeeping for automatic website discovery (scripts/discover-and-crawl.ts).
-- Not website content — just which URLs have been found, how, and
-- whether they've been crawled yet. See
-- src/services/discovery/types.ts.

create table if not exists discovery_queue (
  url text primary key,
  domain text not null,
  discovery_method text not null check (discovery_method in ('seed', 'sitemap', 'link')),
  discovered_from text,
  status text not null default 'pending' check (status in ('pending', 'crawled', 'failed', 'blocked', 'rejected')),
  discovered_at timestamptz not null default now(),
  resolved_at timestamptz,
  note text
);

create index if not exists discovery_queue_status_idx on discovery_queue (status);
create index if not exists discovery_queue_domain_idx on discovery_queue (domain);
