import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Keeps the Supabase free-tier project from auto-pausing after 7 days of
// inactivity. Triggered by a Vercel Cron job (see vercel.json). Runs one
// trivial query, which counts as database activity and resets the pause timer.
export async function GET(req: NextRequest) {
  // Vercel Cron requests include this header; block anything else if a
  // CRON_SECRET is configured so the endpoint can't be spammed publicly.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const count = await prisma.project.count();
    return NextResponse.json({
      ok: true,
      projects: count,
      pingedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
