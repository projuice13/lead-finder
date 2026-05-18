import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 50;
    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where: { projectId: params.id },
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.lead.count({ where: { projectId: params.id } }),
    ]);

    return NextResponse.json({ leads, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { leads } = await req.json();
    if (!Array.isArray(leads)) {
      return NextResponse.json({ error: "leads array required" }, { status: 400 });
    }

    // Upsert leads (ignore duplicates)
    const results = await Promise.allSettled(
      leads.map((lead) =>
        prisma.lead.upsert({
          where: { placeId_projectId: { placeId: lead.placeId, projectId: params.id } },
          create: { ...lead, projectId: params.id },
          update: {},
        })
      )
    );

    const saved = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
