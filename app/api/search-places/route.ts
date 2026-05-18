import { NextRequest, NextResponse } from "next/server";
import { searchPlaces } from "@/lib/google-places";

export async function POST(req: NextRequest) {
  try {
    const { subarea, city, category } = await req.json();
    if (!subarea || !city || !category) {
      return NextResponse.json(
        { error: "subarea, city, and category are required" },
        { status: 400 }
      );
    }

    const results = await searchPlaces(category, subarea, city);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
