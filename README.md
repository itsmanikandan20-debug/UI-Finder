# UI-Finder

**Draw a rough wireframe, find real, live websites whose sections match its
layout structure.** Not a keyword search, not a Pinterest/Dribbble-style
inspiration gallery, not a screenshot database — UI-Finder renders real
public webpages with a real browser, breaks them into sections by
geometry, and compares that structure directly against your sketch.
Every result links to an actual live page you can open immediately.

The matching signal is **structure and geometry** — position, size,
spacing, alignment, grouping, and repeated-element counts — never the
words on the page. A wireframe of "heading + 4 repeated cards + a
text/image split" is compared against real pages the same way regardless
of whether that real page calls its 4-card row "Features," "Services," or
nothing at all.

---

## Status: Phase 1–5 MVP

This is the first end-to-end slice described in the project's phased
plan: wireframe editor → layout JSON → real crawler/analyzer → matcher →
ranked results with live links. It is deliberately not the full 34-item
spec — see "What's not built yet" below.

## How it works

```
Wireframe editor (React Konva)
        │  draw sections/rows/columns/headings/boxes/images/buttons
        ▼
normalizeWireframe()            src/lib/layout/normalize.ts
        │  → LayoutNode tree, 0..1 ratios, repeated groups auto-detected
        ▼
POST /api/search                src/app/api/search/route.ts
        │
        ▼
SectionStore.allSections()      src/services/crawler/store
        │  local JSON file (zero setup) or Postgres+pgvector
        ▼
rankCandidates()                src/services/matcher/rank.ts
        │  signature-vector pre-filter → detailed structural/geometry/
        │  spacing/visual scoring → ranked matches
        ▼
Results UI                      match cards, similarity score, "Open Live Website"
```

Separately, **the crawler** (`src/services/crawler/`) is what populates
the index in the first place:

```
analyzePage(url)                 src/services/crawler/analyzePage.ts
  ├─ SSRF guard + robots.txt check
  ├─ Playwright: load the real page, wait for it to render
  ├─ extractRenderedTree()       walks the live DOM → geometry + isImage/hasText
  ├─ detectSectionCandidates()   splits the page into sections by geometry, not tags
  ├─ rawSectionToLayoutNode()    same repeated-group/gap/alignment logic as the editor
  └─ captureSectionScreenshot()  compressed crop of just that section
```

The wireframe editor and the crawler both reduce their input down to the
exact same `LayoutNode` tree shape (`src/lib/layout/types.ts`). That
symmetry is the point: the matcher (`src/services/matcher/`) has no idea
whether a tree came from a designer's sketch or a live webpage, and never
looks at text content as its primary signal.

## Try it (zero setup)

```bash
npm install
npm run dev
```

Open http://localhost:3000, sketch something (see the on-screen tip),
click **Find Matches**. With no further setup, you'll see an honest
empty-state message instead of fake results — see "About the seed data"
below for why, and how to fix it in about a minute.

## About the seed data (read this before judging results)

`data/sections.seed.json` — the index the app reads with zero setup —
**ships empty**. That's deliberate: this project's own principle is that
every result must point at a real, currently-live webpage, so shipping
fabricated "live site" fixture data as the default would directly
contradict that. It was built and verified in a sandboxed environment
with no general outbound internet access, so a real seed crawl couldn't
be run here.

Populate the index for real, from a machine with normal internet access:

```bash
npm run crawl              # crawls every URL in scripts/seed-sites.ts
npm run crawl -- https://your-own-url.com   # or crawl specific URLs
```

This runs the actual Playwright crawler against real public pages and
writes to `data/sections.local.json` (gitignored) or to Postgres if
`DATABASE_URL` is set. Re-running skips pages crawled within the last 14
days unless you pass `--force`.

The crawler pipeline itself **has** been run and verified end-to-end in
this environment — against local HTML fixtures rather than the live
internet, since that's all the sandbox could reach — confirming
Playwright launch, DOM extraction, section/repeated-element detection,
LayoutNode conversion, screenshot capture, and matcher scoring all work
correctly together. See `scripts/smoke-test-crawler.ts` to rerun that
check yourself.

## Project structure

```
src/
  app/
    page.tsx                  Editor + results, single page
    api/search/route.ts       Wireframe → ranked matches
    api/screenshots/[file]/   Serves local-store screenshot crops
  components/
    canvas/                   WireframeCanvas (Konva), Toolbar
    results/                  MatchCard, ResultsPanel
  features/wireframe-editor/  Editor state (add/move/resize/duplicate/auto-nest)
  lib/
    layout/                   Shared LayoutNode schema, normalizer, geometry
                               helpers, repeated-group detection, signature vector
    api-types.ts, id.ts, screenshot-url.ts
  services/
    crawler/                  Playwright analyzer: extract, sections, convert,
                               screenshot, robots/url-safety, store (JSON + Postgres)
    matcher/                  structural/geometry/spacing/visual/other scoring,
                               two-stage rank (signature pre-filter → detailed score)
scripts/
  seed-sites.ts                Curated real URLs to crawl
  crawl.ts                      Runs the crawler against them
  migrate.ts                    Applies db/migrations/*.sql
  smoke-test-crawler.ts         Dev-only: proves the crawler pipeline works,
                                 against local fixtures, never against the real index
db/migrations/0001_init.sql      Postgres + pgvector schema
```

## The layout schema

Both the editor and the crawler reduce everything to one recursive shape
(`src/lib/layout/types.ts`):

```ts
interface LayoutNode {
  id: string;
  kind: "root" | "section" | "row" | "column" | "repeated_group"
      | "heading" | "text" | "image" | "button" | "box";
  x: number; y: number; width: number; height: number; // 0..1, relative to parent
  children: LayoutNode[];
  repeat?: { count: number; direction: "horizontal" | "vertical" };
  meta?: { hasImage?: boolean; hasText?: boolean; alignment?: Alignment; gap?: number };
}
```

Absolute pixels are thrown away immediately — a 1200px-wide section and a
1440px-wide section with the same proportions read as the same shape.
Repeated elements (a row of cards) are auto-detected (3+ same-kind
siblings of near-identical size) both in the editor and from real DOMs,
and wrapped in a `repeated_group` node so "4 repeated cards" is a first-class,
directly comparable fact rather than 4 separate coincidences.

## Matching

`src/services/matcher/score.ts` combines five signals (weights are a
starting point per the product spec, expected to be retuned against real
results, not treated as final):

| Signal | Weight | What it measures |
|---|---|---|
| Structural | 35% | Tree shape: node kinds, branching, repeat counts |
| Geometry | 30% | Aspect ratio, relative position/size of children |
| Spacing/alignment | 15% | Gap consistency, start/center/end/stretch alignment |
| Visual | 15% | A **content-mix proxy** (image/text leaf ratios) — see below |
| Other | 5% | Exact repeat-count bonus (4 cards vs. 4 cards beats vs. 3) |

**On "visual similarity":** there is no pixel/perceptual visual model
wired in yet — that would mean depending on a specific paid vision API
for a core code path, which the project intentionally avoids (see
`src/services/matcher/visual.ts`). The "visual" bucket is a free,
honest proxy based on image/text content distribution, and is labeled as
exactly that everywhere it surfaces (never claimed as real pixel
comparison). It's built as a swappable `VisualSimilarityProvider`, so a
real perceptual-hash or embedding model can be dropped in later without
touching the rest of the scorer.

Results are labeled `"N similarity"` — an internal score, not a
probability or a guarantee — per the product's own anti-overclaiming
requirement.

Retrieval is two-stage (`src/services/matcher/rank.ts`): a cheap,
deterministic 32-dimension signature vector (`src/lib/layout/signature.ts`,
**not** a pretrained embedding — a hand-built feature vector of aspect
ratio, node-kind histogram, repeat counts, etc.) pre-filters candidates
by cosine similarity before the expensive detailed comparison runs on
just the shortlist. The same vector is what would back a pgvector ANN
index in Postgres at real scale.

## Database (optional — works fine without it)

Set `DATABASE_URL` to a Postgres instance with `pgvector` available
(e.g. Supabase) to switch from the local JSON store to Postgres —
nothing else in the app needs to change; `createSectionStore()`
(`src/services/crawler/store/index.ts`) picks the store based on that
one env var.

```bash
cp .env.example .env.local     # fill in DATABASE_URL
npm run db:migrate             # applies db/migrations/0001_init.sql
npm run crawl                  # now writes to Postgres instead of the JSON file
```

Schema (`db/migrations/0001_init.sql`): `websites`, `sections`
(structure_json + a `vector(32)` embedding + an ivfflat index), and an
unused-for-now `wireframes` table kept for a future "save my sketch"
feature. Nothing stores full page HTML/CSS or full-page screenshots —
only structural JSON, a small vector, and a reference to a compressed
section-crop thumbnail.

## Crawler safety

- **SSRF guard** (`src/services/crawler/url-safety.ts`): only http/https,
  blocks private/loopback hostnames and IP ranges, and re-checks after
  DNS resolution (catches a public-looking hostname that resolves to a
  private address).
- **robots.txt** (`src/services/crawler/robots.ts`): fetched and checked
  before every crawl; fails open (allows) only when robots.txt itself is
  unreachable, per its role as a courtesy check.
- **Bot-protection detection**: a Cloudflare-style interstitial is
  detected and flagged in the result's warnings rather than silently
  indexed as if it were the real page.
- **Bounded extraction**: depth/breadth caps during DOM walking, a
  request timeout, and a 14-day crawl cache (`--force` to bypass) so the
  same page isn't re-analyzed on every run.

## What's not built yet (by design, per the phased plan)

- Screenshot/hand-drawn-wireframe upload (architecture leaves room for
  it — normalize a raster sketch into the same `LayoutNode` shape — but
  isn't implemented).
- Saving/reopening a wireframe (the `wireframes` table exists; nothing
  reads/writes it yet — search is currently stateless, client → API).
  Real perceptual/visual similarity model (currently the honest
  content-mix proxy described above).
- Mobile/tablet crawling (the editor supports those viewports; the
  crawler only ever renders desktop width so far).
- A real, populated site index — this needs to be built by running
  `npm run crawl` somewhere with real internet access.

## Development

```bash
npm run dev         # dev server
npm run build        # production build
npm run lint          # eslint
npm run typecheck      # tsc --noEmit
npm test                # vitest — matcher + normalizer unit tests
```

## Environment variables

See `.env.example`. Everything is optional; the app runs fully with none
of them set.
