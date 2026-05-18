import { NextRequest, NextResponse } from "next/server";
import { generateCsv, generateKlaviyoCsv } from "@/lib/csv";

export async function POST(req: NextRequest) {
  try {
    const { leads, projectName, klaviyo } = await req.json();
    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json({ error: "leads array is required" }, { status: 400 });
    }

    const safeName = (projectName || "leads").replace(/[^a-z0-9]/gi, "_");

    if (klaviyo) {
      const { csv, count } = generateKlaviyoCsv(leads);
      if (count === 0) {
        return NextResponse.json(
          { error: "No verified emails to export" },
          { status: 400 }
        );
      }
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeName}_klaviyo.csv"`,
        },
      });
    }

    const csv = generateCsv(leads);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}_leads.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
