// SSRF guard + basic sanity checks before the crawler is ever allowed to
// navigate to a URL. Only public, fetchable http(s) pages are in scope —
// per the product spec, this tool never targets internal/private
// networks or non-web schemes.

import { lookup } from "node:dns/promises";

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "[::1]", "::1"]);

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

export interface UrlSafetyResult {
  safe: boolean;
  reason?: string;
  url?: URL;
}

export function checkUrlSafety(rawUrl: string): UrlSafetyResult {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "Not a valid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { safe: false, reason: "Only http/https URLs can be crawled." };
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: "Private/loopback hosts cannot be crawled." };
  }
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { safe: false, reason: "Internal-looking hostnames cannot be crawled." };
  }
  if (isPrivateIPv4(hostname)) {
    return { safe: false, reason: "Private IP ranges cannot be crawled." };
  }
  if (hostname.startsWith("fc") || hostname.startsWith("fd") || hostname === "::1") {
    return { safe: false, reason: "Private IPv6 ranges cannot be crawled." };
  }

  return { safe: true, url };
}

/**
 * Full check including a DNS resolution, to catch a public-looking
 * hostname that actually resolves to a private/internal address
 * ("DNS rebinding"). Always run this immediately before the crawler
 * navigates — checkUrlSafety() alone is only a cheap pre-check for
 * input validation (e.g. in an API route, before any network call).
 */
export async function checkUrlSafetyResolved(rawUrl: string): Promise<UrlSafetyResult> {
  const basic = checkUrlSafety(rawUrl);
  if (!basic.safe || !basic.url) return basic;

  try {
    const { address, family } = await lookup(basic.url.hostname);
    if (family === 4 && isPrivateIPv4(address)) {
      return { safe: false, reason: "Hostname resolves to a private IP address." };
    }
    if (family === 6 && (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80"))) {
      return { safe: false, reason: "Hostname resolves to a private IPv6 address." };
    }
  } catch {
    return { safe: false, reason: "Hostname could not be resolved." };
  }

  return basic;
}
