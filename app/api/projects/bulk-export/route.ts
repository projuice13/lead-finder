import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateCsv, generateKlaviyoCsv } from "@/lib/csv";

export async function POST(req: NextRequest) {
  try {
    const { ids, klaviyo } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }

    const leads = await prisma.lead.findMany({
      where: { projectId: { in: ids } },
      orderBy: [{ projectId: "asc" }, { name: "asc" }],
    });

    if (leads.length === 0) {
      return NextResponse.json({ error: "No leads found in selected projects" }, { status: 400 });
    }

    // Map to LeadForCsv shape
    const leadsForCsv = leads.map((l) => ({
      name: l.name,
      address: l.address,
      domain: l.domain,
      email: l.email,
      emails: l.emails,
      leadStatus: l.leadStatus,
      instagram: l.instagram,
      facebook: l.facebook,
      category: l.category,
      subarea: l.subarea,
      city: l.city,
    }));

    const filename = `export_${ids.length}_projects`;

    if (klaviyo) {
      const { csv, count } = generateKlaviyoCsv(leadsForCsv);
      if (count === 0) {
        return NextResponse.json(
          { error: "No verified emails found across selected projects" },
          { status: 400 }
        );
      }
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}_klaviyo.csv"`,
        },
      });
    }

    const csv = generateCsv(leadsForCsv);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}_leads.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
