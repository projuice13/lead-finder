export type HunterVerificationStatus =
  | "valid"
  | "invalid"
  | "accept_all"
  | "webmail"
  | "disposable"
  | "unknown"
  | "pending"
  | null;

export interface HunterEmail {
  value: string;
  confidence: number | null;
  type: string | null; // "generic" | "personal"
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  verification_status: HunterVerificationStatus;
  // Where the address came from: Hunter's index, or scraped off the site itself.
  source: "hunter" | "website" | null;
}

export interface HunterDomainResult {
  domain: string;
  emails: HunterEmail[];
  organization: string | null;
}

export async function hunterDomainSearch(domain: string): Promise<HunterDomainResult> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) throw new Error("HUNTER_API_KEY not set");

  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("limit", "10");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hunter ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const data = json?.data || {};
  const emails: HunterEmail[] = Array.isArray(data.emails)
    ? data.emails.map((e: Record<string, unknown>) => {
        const v = e.verification as Record<string, unknown> | undefined;
        const status = v && typeof v.status === "string" ? v.status : null;
        return {
          value: String(e.value || ""),
          confidence: typeof e.confidence === "number" ? e.confidence : null,
          type: typeof e.type === "string" ? e.type : null,
          first_name: typeof e.first_name === "string" ? e.first_name : null,
          last_name: typeof e.last_name === "string" ? e.last_name : null,
          position: typeof e.position === "string" ? e.position : null,
          verification_status: status as HunterVerificationStatus,
          source: "hunter",
        };
      })
    : [];

  return {
    domain: String(data.domain || domain),
    emails,
    organization: typeof data.organization === "string" ? data.organization : null,
  };
}

export interface HunterVerifyResult {
  email: string;
  status: HunterVerificationStatus;
  score: number | null;
}

/** Verify a single email via Hunter's Email Verifier endpoint. */
export async function hunterEmailVerify(email: string): Promise<HunterVerifyResult> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) throw new Error("HUNTER_API_KEY not set");

  const url = new URL("https://api.hunter.io/v2/email-verifier");
  url.searchParams.set("email", email);
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hunter verifier ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const data = json?.data || {};
  return {
    email,
    status: (typeof data.status === "string" ? data.status : null) as HunterVerificationStatus,
    score: typeof data.score === "number" ? data.score : null,
  };
}

/**
 * Pick the primary email, in order of trust:
 *   1. A Hunter SMTP-`valid` address (highest confidence first).
 *   2. Failing that, an address scraped off the business's own website on its
 *      own domain. The business published it themselves, so we trust it even
 *      when Hunter can't confirm deliverability (small-business catch-all
 *      servers return `accept_all`, never `valid`). This saves manually
 *      promoting emails that are plainly listed on the site.
 * Returns null if neither exists.
 *
 * `domain` is the business domain, used to tell a same-domain address
 * (info@theirshop.co.uk) from an off-domain one (a gmail/outlook address).
 */
export function pickPrimaryEmail(
  emails: HunterEmail[],
  domain?: string | null
): string | null {
  const verified = emails.filter((e) => e.verification_status === "valid");
  if (verified.length > 0) {
    verified.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    return verified[0]?.value || null;
  }

  if (domain) {
    const bare = domain.replace(/^www\./, "").toLowerCase();
    const sameDomainScraped = emails.find(
      (e) =>
        e.source === "website" &&
        e.value.toLowerCase().endsWith("@" + bare) &&
        e.verification_status !== "invalid" &&
        e.verification_status !== "disposable"
    );
    if (sameDomainScraped) return sameDomainScraped.value;
  }

  return null;
}
