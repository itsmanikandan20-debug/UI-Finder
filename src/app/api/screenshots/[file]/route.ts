import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

// Serves screenshots captured by the local crawler (data/screenshots/) —
// only relevant for the local JSON store; a production Postgres/Supabase
// deployment stores screenshotRef as a full object-storage URL instead,
// which resolveScreenshotUrl() returns directly without ever hitting
// this route.
export async function GET(_req: NextRequest, { params }: { params: { file: string } }) {
  const safeName = path.basename(params.file); // no path traversal
  const filePath = path.join(process.cwd(), "data", "screenshots", safeName);

  try {
    const buf = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Screenshot not found." }, { status: 404 });
  }
}
