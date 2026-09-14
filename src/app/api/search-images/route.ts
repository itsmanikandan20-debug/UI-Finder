import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Wireframe } from "@/lib/layout/types";
import { wireframeSchema } from "@/lib/wireframe-schema";
import { understandWireframe } from "@/services/imagesearch/gemini";
import { searchImages } from "@/services/imagesearch/serpapi";
import type { ImageSearchApiResponse } from "@/lib/api-types";

// Gemini's model-fallback chain plus a live SerpApi search can together
// take longer than a serverless platform's default function timeout —
// raise the ceiling so a slow-but-successful run isn't cut off mid-request.
export const maxDuration = 60;

const bodySchema = z.object({ wireframe: wireframeSchema });

export async function POST(req: NextRequest) {
  let wireframe: Wireframe;
  try {
    const json = await req.json();
    wireframe = bodySchema.parse(json).wireframe as Wireframe;
  } catch {
    return NextResponse.json({ error: "Invalid wireframe payload." }, { status: 400 });
  }

  const missingKeys = [
    !process.env.GEMINI_API_KEY && "GEMINI_API_KEY",
    !process.env.SERPAPI_API_KEY && "SERPAPI_API_KEY",
  ].filter((v): v is string => Boolean(v));

  if (missingKeys.length > 0) {
    const response: ImageSearchApiResponse = {
      configured: false,
      message: `Internet image search is not set up yet — missing ${missingKeys.join(" and ")}. See README for how to add it.`,
      understanding: null,
      images: [],
    };
    return NextResponse.json(response);
  }

  const gemini = await understandWireframe(wireframe);
  if (!gemini.understanding) {
    const response: ImageSearchApiResponse = {
      configured: true,
      message: gemini.diagnostic,
      understanding: null,
      images: [],
    };
    return NextResponse.json(response);
  }

  const serp = await searchImages(gemini.understanding.searchQuery);
  const response: ImageSearchApiResponse = {
    configured: true,
    message: serp.images.length === 0 ? serp.diagnostic : undefined,
    understanding: gemini.understanding,
    images: serp.images,
  };
  return NextResponse.json(response);
}
