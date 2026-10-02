import { NextRequest, NextResponse } from "next/server";
import { searchPlaces, type PlaceResult } from "@/lib/google-places";
import { CATEGORY_SEARCH } from "@/lib/constants";

export const maxDuration = 60;

// Lowercase + strip accents so "Açaí" matches "acai".
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const { subarea, city, category } = await req.json();
    if (!subarea || !city || !category) {
      return NextResponse.json(
        { error: "subarea, city, and category are required" },
        { status: 400 }
      );
    }

    const cfg = CATEGORY_SEARCH[category] || {};
    const queries = cfg.queries?.length ? cfg.queries : [category];

    // Run each query and merge, de-duplicating by place id.
    const settled = await Promise.allSettled(
      queries.map((q) => searchPlaces(q, subarea, city))
    );
    const fulfilled = settled.filter(
      (r): r is PromiseFulfilledResult<PlaceResult[]> => r.status === "fulfilled"
    );
    // If every query failed, surface the first error rather than silently returning nothing.
    if (fulfilled.length === 0) {
      const firstError = settled.find((r) => r.status === "rejected") as
        | PromiseRejectedResult
        | undefined;
      throw firstError?.reason instanceof Error
        ? firstError.reason
        : new Error("Places search failed");
    }

    const byId = new Map<string, PlaceResult>();
    for (const r of fulfilled) {
      for (const place of r.value) {
        if (!byId.has(place.placeId)) byId.set(place.placeId, place);
      }
    }
    let results = [...byId.values()];

    // Strict filter: for tuned categories, keep a place only if its name or one
    // of its Google place-types actually matches. This drops the generic cafes
    // that fuzzy text search would otherwise return.
    const nameMatch = cfg.nameMatch?.map(normalize) ?? [];
    const typeMatch = cfg.typeMatch ?? [];
    if (nameMatch.length > 0 || typeMatch.length > 0) {
      results = results.filter((p) => {
        const name = normalize(p.name);
        const byName = nameMatch.some((k) => name.includes(k));
        const byType = typeMatch.some((t) => p.types.includes(t));
        return byName || byType;
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
