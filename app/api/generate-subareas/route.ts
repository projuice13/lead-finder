import { NextRequest, NextResponse } from "next/server";
import { getSubareas } from "@/lib/subareas";

export async function POST(req: NextRequest) {
  try {
    const { city } = await req.json();
    if (!city) {
      return NextResponse.json({ error: "city is required" }, { status: 400 });
    }
    const subareas = await getSubareas(city);
    return NextResponse.json({ subareas });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
