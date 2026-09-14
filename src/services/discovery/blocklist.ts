// A small, curated blocklist — not an allowlist. The discovery worker
// follows links it finds organically (see link-extraction in
// src/services/crawler/extract.ts); this just skips domains that are
// either not useful for layout discovery (social feeds, login-walled
// apps, ad/tracking infrastructure) or are heavily bot-protected enough
// that crawling them would mostly just burn a crawl slot on a challenge
// page. It is intentionally short — the point of link-following
// discovery is to grow organically, not to hand-curate what's allowed.

const BLOCKED_DOMAINS = new Set([
  "facebook.com",
  "www.facebook.com",
  "instagram.com",
  "www.instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "www.linkedin.com",
  "youtube.com",
  "www.youtube.com",
  "tiktok.com",
  "www.tiktok.com",
  "pinterest.com",
  "www.pinterest.com",
  "reddit.com",
  "www.reddit.com",
  "google.com",
  "www.google.com",
  "accounts.google.com",
  "amazon.com",
  "www.amazon.com",
  "apps.apple.com",
  "play.google.com",
  "wa.me",
  "t.me",
  "discord.com",
  "discord.gg",
]);

const BLOCKED_SUFFIXES = [".googleusercontent.com", ".doubleclick.net", ".googleadservices.com"];

export function isBlockedDomain(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_DOMAINS.has(host)) return true;
  return BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
