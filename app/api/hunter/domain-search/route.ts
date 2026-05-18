import { NextRequest, NextResponse } from "next/server";
import { hunterDomainSearch } from "@/lib/hunter";

export async function POST(req: NextRequest) {
  try {
    const { domain } = await req.json();
    if (!domain || typeof domain !== "string") {
      return NextResponse.json({ error: "domain required" }, { status: 400 });
    }
    const result = await hunterDomainSearch(domain);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
