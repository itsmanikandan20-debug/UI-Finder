// `next dev`/`next build` automatically read .env.local — a plain `tsx`
// script does not. Without this, every one-off script (crawl, discover,
// migrate) would silently see none of the variables from .env.local, even
// though the file is sitting right there — the exact confusing gap behind
// "DATABASE_URL is not set" even after filling it in. Tiny and
// dependency-free on purpose, matching migrate.ts's own philosophy.

import { promises as fs } from "node:fs";
import path from "node:path";

/** Exported separately so the parsing logic is testable without touching the filesystem. */
export function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/** Fills in process.env from .env.local for keys not already set (a real shell export always wins). No-op if the file doesn't exist — scripts still work with zero setup, per the README. */
export async function loadEnvLocal(): Promise<void> {
  const envPath = path.join(process.cwd(), ".env.local");
  let contents: string;
  try {
    contents = await fs.readFile(envPath, "utf-8");
  } catch {
    return;
  }
  for (const [key, value] of Object.entries(parseEnvFile(contents))) {
    if (!(key in process.env)) process.env[key] = value;
  }
}
