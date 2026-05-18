import { NextRequest, NextResponse } from "next/server";
import { enrichLead } from "@/lib/enrichment";

export async function POST(req: NextRequest) {
  try {
    const { website } = await req.json();
    const result = await enrichLead(website ?? null);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
