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
Results UI                      match cards, similarity score, "Open Matching Section"
```

Separately, **the crawler** (`src/services/crawler/`) is what populates
the index in the first place:

```
analyzePage(url)                 src/services/crawler/analyzePage.ts
  ├─ SSRF guard + robots.txt check
  ├─ Playwright: load the real page, wait for it to render
  ├─ extractRenderedTree()       walks the live DOM → geometry + isImage/hasText
  ├─ detectSectionCandidates()   walks the WHOLE tree for section-sized sub-regions,
  │                              not just top-level children — see below
  ├─ rawSectionToLayoutNode()    same repeated-group/gap/alignment logic as the editor
  └─ captureSectionScreenshot()  compressed crop of just THAT specific sub-region
```

**Section detection walks the entire tree, not just top-level children.**
A real, complex page (Apple/GitHub/Webflow-scale sites especially) is
usually just a handful of giant top-level wrapper `<div>`s, each silently
containing dozens of unrelated sub-blocks. Looking only at direct
children treats the whole page as one enormous "section," diluting any
real match into noise and making a specific matching sub-region (e.g.
exactly a 4-card feature grid) impossible to isolate, screenshot, or link
to on its own. `detectSectionCandidates()` (`src/services/crawler/sections.ts`)
instead walks every node, and any reasonably-sized sub-tree with a small,
coherent child count becomes its own independently-scoreable candidate —
so the matcher can find and rank the specific region that actually
resembles your sketch, not just "somewhere on this page." The screenshot
shown for a result is always cropped from that exact candidate — the same
box used to compute its score, never a different one.

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

No browser download step is needed: the crawler (`npm run crawl`, used
below) automatically uses whatever Google Chrome or Microsoft Edge is
already installed on your machine, via `playwright-core` + Playwright's
`channel` option — never Playwright's own downloaded Chromium build. If
neither is found, it fails with a clear message telling you what to
install (or how to point it at a browser via `CHROMIUM_EXECUTABLE_PATH`
in `.env.local`) instead of trying to download one itself.

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

## Automatic website discovery

`npm run crawl` only ever touches the fixed list in `scripts/seed-sites.ts`.
`npm run discover` (`scripts/discover-and-crawl.ts`) is the growth path:
instead of a hand-maintained list, it works off a queue that grows itself.

```bash
npm run discover                # a small, safe batch (default 8 URLs)
npm run discover -- --batch 20  # a bigger batch, once you trust the results
```

**How it grows the index without crawling "the whole internet" and
without you maintaining a list:**

1. **First run**: the queue is empty, so it seeds itself from
   `scripts/seed-sites.ts` (your original 15 sites still work as the
   starting point — nothing about them changes).
2. **Every run asks DBpedia for a batch of genuinely new, unrelated
   companies** (`src/services/discovery/dbpedia.ts`) — this is the
   deliberate "find companies we've never heard of" source, separate
   from anything already in the index. DBpedia is a free, public,
   no-signup service that extracts structured facts from Wikipedia
   infoboxes; any Wikipedia page for a company typically lists its
   official homepage, and DBpedia exposes that as `dbo:homepage` via a
   public SPARQL endpoint (`https://dbpedia.org/sparql`) — one plain
   HTTP GET, no API key. A random offset into DBpedia's company list is
   picked each run for variety, so repeated runs surface different
   companies rather than the same handful. If the endpoint is slow or
   unreachable, this fails open (an empty result) and the rest of the
   run continues normally.
3. **Every crawl also looks for more, for free, from what it just saw**:
   while a page is open anyway, `extractRenderedTree()`
   (`src/services/crawler/extract.ts`) collects its outbound `<a href>`
   links — same-domain or a completely different domain, whatever the
   page actually links to (never fed into matching — see the comment
   there) — and for a site's homepage, its `/sitemap.xml` is checked for
   more of *that same site's* pages. This is opportunistic (it depends
   on what the page happens to link to), unlike DBpedia's deliberate
   sourcing, but it's genuinely free and catches things DBpedia
   wouldn't — a footer "customers" or "built with" page, for instance.
   All of it gets queued as `pending` for a **future** run — this run
   never crawls something it just discovered.
4. **Filtering before anything gets queued**
   (`src/services/discovery/`): `blocklist.ts` skips domains that aren't
   useful for layout discovery (social platforms, ad/tracking
   infrastructure, login-walled apps); `normalize-url.ts` dedupes so the
   same page never gets queued twice, from any source.
5. **Politeness by construction, not just convention**: a 2-second pause
   between every crawl, and `takeBatch()` round-robins across domains
   (see `src/services/discovery/store/json-store.ts`) so a batch can't
   fill up with 10 pages from one site. The batch size is small by
   default on purpose — grow it once you've watched a few runs and trust
   what it's finding.
6. **Run it again later** (by hand, or on a schedule — cron, a scheduled
   GitHub Action, whatever you already have) to keep pulling from the
   queue and keep discovering further outward. 15 → hundreds → thousands
   happens gradually across many runs, never all at once.

This uses only free mechanisms — DBpedia's public SPARQL endpoint,
link-following, and sitemaps. No search API, no paid discovery service.
If a future version wants a more directed paid discovery source, that's
a separate, explicit decision — never enabled by default, and never
without asking first.

**Not yet verified against the live DBpedia endpoint** — this was built
and tested in a sandboxed environment with no general outbound internet
access (same limitation as the crawler itself), so `dbpedia.ts` is
covered by unit tests against mocked responses, not a real run. Run
`npm run discover` yourself to confirm it actually pulls real companies.

Everything downstream is unchanged: discovered pages go through the
exact same `analyzePage()`, the exact same section detection, the exact
same store, the exact same search. Discovery only decides *which URL*
gets crawled next — never how.

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
    discovery/                Automatic URL discovery: DBpedia company
                               directory, blocklist, URL dedup, sitemap
                               fetch, queue store (JSON + Postgres)
scripts/
  seed-sites.ts                Curated real URLs to crawl
  crawl.ts                      Crawls exactly that fixed list
  discover-and-crawl.ts          Grows the index itself — see "Automatic
                                 website discovery" below
  migrate.ts                    Applies db/migrations/*.sql
  smoke-test-crawler.ts         Dev-only: proves the crawler pipeline works,
                                 against local fixtures, never against the real index
db/migrations/                   0001 core schema, 0002-0004 navigation/
                                 versioning fields, 0005 discovery queue,
                                 0006 adds the "directory" discovery method
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
requirement. The results UI's "Why this matched" panel renders these five
values directly (as bars) — never separate, invented numbers.

**Children are matched by best-fit, not by array position.** Comparing
`a.children[i]` against `b.children[i]` breaks as soon as a candidate is
missing one sibling the wireframe has, or has its children in a different
order: the wireframe's card-row would get compared against whatever the
candidate happens to have at that same index, instead of the candidate's
actual card-row — scoring a genuinely close, tightly-scoped match *worse*
than a loose, coincidentally-index-aligned one. `src/services/matcher/pairing.ts`
instead scores every possible pair and greedily keeps the best-scoring
ones (cheap at the small child counts a section actually has); an
unmatched child on the longer side still counts as zero, so missing
structure still costs something.

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
npm run db:migrate             # applies db/migrations/*.sql in order
npm run crawl                  # now writes to Postgres instead of the JSON file
```

Schema (`db/migrations/0001_init.sql`, `0002_anchor_fields.sql`):
`websites`, `sections` (structure_json + a `vector(32)` embedding + an
ivfflat index + navigation-only `anchor_snippet`/`page_y_ratio` — see
"Opening the exact matched section" below), and an unused-for-now
`wireframes` table kept for a future "save my sketch" feature. Nothing
stores full page HTML/CSS or full-page screenshots — only structural
JSON, a small vector, and a reference to a compressed section-crop
thumbnail.

## Opening the exact matched section

A search result is never just "the domain" — it's a specific, screenshotted
sub-region of a specific page, and every result carries all four of:
which website, which page URL, the exact detected section (as scored
`LayoutNode` data), and a screenshot cropped from that exact same box.

"Open Matching Section" tries to actually scroll there: it builds a
browser [text-fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment/Text_fragments)
deep link (`#:~:text=...`) from a short snippet of that section's own
visible text, captured only for this purpose — it's never fed into
structural matching (see `RawDomNode.snippetText` in
`src/services/crawler/extract.ts`, and `src/lib/section-anchor.ts`).
Chrome and Edge scroll straight to it; other browsers just open the page
normally. When no usable snippet was captured (an image-only section, for
instance), the button is honest about it: it opens the page normally and
shows "≈N% down the page" instead of implying precision it doesn't have.

## Internet UI-image search (optional, additive)

A second, independent search mode alongside live-website section matching
above — it never reads from or writes to the crawled-section index, and
live-website matching keeps working exactly the same with or without it.

```
Wireframe geometry (LayoutNode tree — never a rendered image)
        │
        ▼
understandWireframe()            src/services/imagesearch/gemini.ts
        │  Gemini reads ONLY position/size/kind data and returns:
        │  { detectedPattern, structure, layout, searchQuery }
        ▼
searchImages(searchQuery)        src/services/imagesearch/serpapi.ts
        │  SerpApi's Google Images engine — a real, whole-web text search
        ▼
Real images + their source pages, shown with a link to open each source
```

The wireframe's *drawing* is never sent anywhere as an image — only Gemini's
short text description of its shape becomes the search query, and that
query is the only thing sent to SerpApi. Requires **both**
`GEMINI_API_KEY` and `SERPAPI_API_KEY` (see `.env.example`); the "Search
the Internet" button stays present but shows a plain-English "not set up
yet" message — never an error — if either is missing.

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
of them set. `GEMINI_API_KEY` and `SERPAPI_API_KEY` together enable the
"Internet UI-image search" feature above — see that section for what each
one is used for and where to get a free key.
