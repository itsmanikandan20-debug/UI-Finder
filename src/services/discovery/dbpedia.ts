// A genuinely independent discovery source, unlike link-following
// (src/services/crawler/extract.ts): rather than depending on what pages
// already in the index happen to link to, this asks a free, public,
// no-signup company directory for a batch of real companies' official
// websites.
//
// DBpedia extracts structured facts from Wikipedia infoboxes and exposes
// them via a public SPARQL endpoint. One HTTP GET, no API key, no paid
// service. The "official website" field is inconsistently mapped across
// article templates — some use the DBpedia-ontology property
// (dbo:homepage), many use the older FOAF property (foaf:homepage) —
// so the query checks both.

const SPARQL_ENDPOINT = "https://dbpedia.org/sparql";
const FETCH_TIMEOUT_MS = 8000;
// DBpedia has many thousands of dbo:Company entries with a homepage set.
// Picking a random OFFSET within this pool gives run-to-run variety
// without needing `ORDER BY RAND()`, which is slow (and often rejected
// outright) on a large, shared public endpoint.
const OFFSET_POOL_SIZE = 3000;

function buildQuery(limit: number, offset: number): string {
  return `
    SELECT DISTINCT ?homepage WHERE {
      ?company a <http://dbpedia.org/ontology/Company> .
      { ?company <http://dbpedia.org/ontology/homepage> ?homepage }
      UNION
      { ?company <http://xmlns.com/foaf/0.1/homepage> ?homepage }
    }
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}

interface SparqlJsonResponse {
  results?: {
    bindings?: { homepage?: { value?: string } }[];
  };
}

export interface DiscoveryDirectoryResult {
  homepages: string[];
  /** Always populated, human-readable — printed by the caller so a real run tells us WHY nothing came back, not just that nothing did. */
  diagnostic: string;
}

/** Fetches up to `limit` random real companies' official homepage URLs. Fails open (empty array + a diagnostic) on any error — this is one optional discovery source among several, never something the rest of the run should break over. */
export async function fetchCompanyDirectoryBatch(limit = 15): Promise<DiscoveryDirectoryResult> {
  const offset = Math.floor(Math.random() * OFFSET_POOL_SIZE);
  const query = buildQuery(limit, offset);
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=${encodeURIComponent(
    "application/sparql-results+json"
  )}`;

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": "UI-Finder-Bot (automatic discovery; see README)",
        },
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { homepages: [], diagnostic: `network error reaching DBpedia: ${message}` };
  }

  if (!res.ok) {
    return { homepages: [], diagnostic: `DBpedia responded with HTTP ${res.status}` };
  }

  let data: SparqlJsonResponse;
  try {
    data = (await res.json()) as SparqlJsonResponse;
  } catch {
    return { homepages: [], diagnostic: "DBpedia response was not valid JSON" };
  }

  const bindings = data.results?.bindings ?? [];
  const homepages = bindings
    .map((b) => b.homepage?.value)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (homepages.length === 0) {
    return { homepages: [], diagnostic: `query succeeded but matched 0 companies at offset ${offset}` };
  }
  return { homepages, diagnostic: `ok — ${homepages.length} result(s)` };
}
