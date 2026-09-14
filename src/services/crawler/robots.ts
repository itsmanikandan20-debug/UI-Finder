// Minimal robots.txt respect: fetch it, find the most specific matching
// User-agent block (or the wildcard block), and check the path against
// its Disallow/Allow rules. Deliberately simple — this is a courtesy
// check, not a full spec implementation.

const USER_AGENT = "UI-Finder-Bot";

interface RobotsRule {
  path: string;
  allow: boolean;
}

function parseRobots(body: string): RobotsRule[] {
  const lines = body.split("\n").map((l) => l.trim());
  let currentAgents: string[] = [];
  let matchesUs = false;
  let matchesWildcard = false;
  const rulesForUs: RobotsRule[] = [];
  const rulesForWildcard: RobotsRule[] = [];

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      if (currentAgents.length === 0 || matchesUs || matchesWildcard) {
        // starting a new block
      }
      currentAgents.push(value.toLowerCase());
      matchesUs = currentAgents.includes(USER_AGENT.toLowerCase());
      matchesWildcard = currentAgents.includes("*");
      continue;
    }
    if (key === "disallow" || key === "allow") {
      currentAgents = currentAgents; // block continues until next non-UA-only group in practice
      if (matchesUs) rulesForUs.push({ path: value, allow: key === "allow" });
      else if (matchesWildcard) rulesForWildcard.push({ path: value, allow: key === "allow" });
      continue;
    }
    // Any other directive (crawl-delay, sitemap...) ends implicit grouping context for simplicity.
    currentAgents = [];
    matchesUs = false;
    matchesWildcard = false;
  }

  return rulesForUs.length > 0 ? rulesForUs : rulesForWildcard;
}

function pathAllowed(rules: RobotsRule[], path: string): boolean {
  // Longest matching rule wins, per the de-facto standard.
  let best: RobotsRule | null = null;
  for (const rule of rules) {
    if (!rule.path) continue; // an empty Disallow means "allow everything"
    if (path.startsWith(rule.path)) {
      if (!best || rule.path.length > best.path.length) best = rule;
    }
  }
  return best ? best.allow : true;
}

export async function isAllowedByRobots(pageUrl: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const url = new URL(pageUrl);
    const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(robotsUrl, { signal: controller.signal, headers: { "User-Agent": USER_AGENT } });
    clearTimeout(timer);
    if (!res.ok) return true; // no robots.txt (or unreachable) → default allow
    const body = await res.text();
    const rules = parseRobots(body);
    return pathAllowed(rules, url.pathname || "/");
  } catch {
    return true; // fail open on robots.txt fetch errors — it's a courtesy check
  }
}
