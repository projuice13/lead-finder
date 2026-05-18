import * as cheerio from "cheerio";

export interface EnrichmentResult {
  domain: string | null;
  instagram: string | null;
  facebook: string | null;
}

export function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    // Add protocol if missing
    let normalized = url.trim();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = "https://" + normalized;
    }
    const parsed = new URL(normalized);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function enrichLead(website: string | null): Promise<EnrichmentResult> {
  const domain = extractDomain(website);
  if (!domain) return { domain: null, instagram: null, facebook: null };

  let instagram: string | null = null;
  let facebook: string | null = null;

  try {
    const url = website!.startsWith("http") ? website! : `https://${website}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    clearTimeout(timeout);

    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);

      $("a[href]").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (!instagram && href.includes("instagram.com/")) {
          const match = href.match(/instagram\.com\/([^/?#\s]+)/);
          if (match && match[1] && match[1] !== "p" && match[1] !== "reel") {
            instagram = `https://instagram.com/${match[1]}`;
          }
        }
        if (!facebook && href.includes("facebook.com/")) {
          const match = href.match(/facebook\.com\/([^/?#\s]+)/);
          if (
            match &&
            match[1] &&
            !["sharer", "share", "login", "dialog"].includes(match[1])
          ) {
            facebook = `https://facebook.com/${match[1]}`;
          }
        }
      });
    }
  } catch {
    // Best-effort — if scraping fails, return domain only
  }

  return { domain, instagram, facebook };
}
