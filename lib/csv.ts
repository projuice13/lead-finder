export interface LeadForCsv {
  name: string;
  address: string;
  domain: string;
  email: string | null;
  emails: string | null; // JSON string from Hunter
  instagram: string | null;
  facebook: string | null;
  category: string;
  subarea: string;
  city: string;
}

interface HunterEmailEntry {
  value?: unknown;
  verification_status?: unknown;
}

function emailVerificationStatus(lead: LeadForCsv): string {
  if (!lead.email || !lead.emails) return "";
  try {
    const arr = JSON.parse(lead.emails);
    if (!Array.isArray(arr)) return "";
    const match = (arr as HunterEmailEntry[]).find(
      (e) => typeof e.value === "string" && e.value === lead.email
    );
    if (match && typeof match.verification_status === "string") {
      return match.verification_status;
    }
    return "";
  } catch {
    return "";
  }
}

function escapeCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export function generateCsv(leads: LeadForCsv[]): string {
  const headers = [
    "Business Name",
    "Address",
    "Website",
    "Email",
    "Email Status",
    "Instagram",
    "Facebook",
    "Category",
    "Area",
    "City",
  ];

  const rows = leads.map((lead) => [
    escapeCell(lead.name),
    escapeCell(lead.address),
    escapeCell(lead.domain),
    escapeCell(lead.email),
    escapeCell(emailVerificationStatus(lead)),
    escapeCell(lead.instagram),
    escapeCell(lead.facebook),
    escapeCell(lead.category),
    escapeCell(lead.subarea),
    escapeCell(lead.city),
  ]);

  return [headers.map((h) => `"${h}"`).join(","), ...rows.map((r) => r.join(","))].join(
    "\r\n"
  );
}

/**
 * Klaviyo-optimised export:
 * - Only includes leads with a Hunter-verified (valid) email
 * - Columns: Email, Business Name, Website, Area, City
 * - "Email" must be the first column for Klaviyo's importer
 */
export function generateKlaviyoCsv(leads: LeadForCsv[]): { csv: string; count: number } {
  const verified = leads.filter((lead) => {
    if (!lead.email) return false;
    const status = emailVerificationStatus(lead);
    // Allow manually-entered emails (no Hunter data) + verified ones
    return status === "valid" || status === "";
  });

  const headers = ["Email", "Business Name", "Website", "Area", "City"];

  const rows = verified.map((lead) => [
    escapeCell(lead.email),
    escapeCell(lead.name),
    escapeCell(lead.domain),
    escapeCell(lead.subarea),
    escapeCell(lead.city),
  ]);

  const csv = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\r\n");

  return { csv, count: verified.length };
}
