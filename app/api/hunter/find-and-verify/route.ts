import { NextRequest, NextResponse } from "next/server";
import { hunterDomainSearch, hunterEmailVerify } from "@/lib/hunter";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { domain } = await req.json();
    if (!domain || typeof domain !== "string") {
      return NextResponse.json({ error: "domain required" }, { status: 400 });
    }

    const searchResult = await hunterDomainSearch(domain);

    // Verify each email that doesn't already have a 'valid' / 'invalid' status.
    // Run sequentially with small delay to respect Hunter rate limits.
    const verifiedEmails = [];
    for (const email of searchResult.emails) {
      const current = email.verification_status;
      // Skip verification if Hunter already returned a definitive status
      if (current === "valid" || current === "invalid" || current === "disposable") {
        verifiedEmails.push(email);
        continue;
      }
      try {
        const v = await hunterEmailVerify(email.value);
        verifiedEmails.push({ ...email, verification_status: v.status });
      } catch (e) {
        // Keep the email but leave status null — user can see it's unverified
        console.error("Verify failed for", email.value, e);
        verifiedEmails.push(email);
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    return NextResponse.json({
      domain: searchResult.domain,
      organization: searchResult.organization,
      emails: verifiedEmails,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
