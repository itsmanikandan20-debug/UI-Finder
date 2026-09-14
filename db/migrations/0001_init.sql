-- UI-Finder schema. Run on a Supabase (or any) Postgres instance with the
-- pgvector extension available. See scripts/migrate.ts / README for how
-- to apply this.

create extension if not exists vector;
create extension if not exists pgcrypto; -- gen_random_uuid()

create table if not exists websites (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  page_url text not null unique,
  title text,
  status text not null default 'pending' check (status in ('pending', 'crawled', 'failed', 'blocked')),
  last_crawled_at timestamptz,
  created_at timestamptz not null default now()
);

-- SIGNATURE_LENGTH in src/lib/layout/signature.ts must match this dimension.
create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references websites(id) on delete cascade,
  page_url text not null,
  -- Denormalized from websites(domain/title) for cheap result-card display
  -- without a join on every search.
  domain text not null,
  website_title text,
  section_index int not null,
  dom_selector text,
  viewport_width int not null,
  structure_json jsonb not null,
  layout_embedding vector(32),
  screenshot_ref text,
  crawled_at timestamptz not null default now()
);

create index if not exists sections_website_id_idx on sections (website_id);
create index if not exists sections_viewport_width_idx on sections (viewport_width);
create index if not exists sections_layout_embedding_idx
  on sections using ivfflat (layout_embedding vector_cosine_ops)
  with (lists = 100);

-- Not read by the search API yet (wireframes are matched statelessly,
-- client -> /api/search), but kept so a later version can let a designer
-- save/reopen a sketch without re-drawing it.
create table if not exists wireframes (
  id uuid primary key default gen_random_uuid(),
  owner_ref text,
  layout_json jsonb not null,
  created_at timestamptz not null default now()
);
