// Applies db/migrations/*.sql, in order, against DATABASE_URL. Tiny and
// dependency-free on purpose — this is a one-shot setup script, not a
// migration framework.

import { promises as fs } from "node:fs";
import path from "node:path";
import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set — nothing to migrate. See .env.example.");
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });
  const dir = path.join(process.cwd(), "db", "migrations");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    console.log(`Applying ${file}...`);
    const contents = await fs.readFile(path.join(dir, file), "utf-8");
    await sql.unsafe(contents);
  }

  console.log(`Applied ${files.length} migration(s).`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
