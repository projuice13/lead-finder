import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.lead.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data: { email?: string | null; emails?: string | null } = {};
    if ("email" in body) {
      const raw = typeof body.email === "string" ? body.email.trim() : "";
      data.email = raw.length > 0 ? raw : null;
    }
    if ("emails" in body) {
      // Accept array (from Hunter) or string (pre-serialized) or null
      if (body.emails === null) {
        data.emails = null;
      } else if (Array.isArray(body.emails)) {
        data.emails = JSON.stringify(body.emails);
      } else if (typeof body.emails === "string") {
        data.emails = body.emails;
      }
    }
    const lead = await prisma.lead.update({ where: { id: params.id }, data });
    return NextResponse.json({ lead });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
