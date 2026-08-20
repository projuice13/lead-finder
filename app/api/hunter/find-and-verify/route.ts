import { NextRequest, NextResponse } from "next/server";
import { hunterDomainSearch, hunterEmailVerify, type HunterEmail } from "@/lib/hunter";
import { scrapeEmailsFromWebsite } from "@/lib/email-scraper";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { domain } = await req.json();
    if (!domain || typeof domain !== "string") {
      return NextResponse.json({ error: "domain required" }, { status: 400 });
    }

    // Run Hunter's index lookup and a direct scrape of the site in parallel.
    const [searchResult, scraped] = await Promise.all([
      hunterDomainSearch(domain),
      scrapeEmailsFromWebsite(domain).catch(() => [] as string[]),
    ]);

    // Merge in scraped emails Hunter didn't already return. These come straight
    // off the business's own site, so they're high-trust — mark the source and
    // let the verifier below assign a real deliverability status.
    const hunterValues = new Set(searchResult.emails.map((e) => e.value.toLowerCase()));
    const scrapedOnly: HunterEmail[] = scraped
      .filter((value) => !hunterValues.has(value.toLowerCase()))
      .map((value) => ({
        value,
        confidence: null,
        type: null,
        first_name: null,
        last_name: null,
        position: "Listed on website",
        verification_status: null,
      }));

    const merged = [...searchResult.emails, ...scrapedOnly];

    // Verify each email that doesn't already have a 'valid' / 'invalid' status.
    // Run sequentially with small delay to respect Hunter rate limits.
    const verifiedEmails = [];
    for (const email of merged) {
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
