// Scrapes email addresses directly off a business's own website — the
// homepage, any contact/about/team pages it links to, plus a few common
// fallback paths. Complements Hunter.io, which relies on its own crawl index
// and often misses small-business emails that are plainly published on the
// site (in a mailto: link, a Cloudflare-obfuscated link, or lightly disguised
// text like "info [at] shop [dot] co [dot] uk").

import * as cheerio from "cheerio";

// Fallback paths tried even if the homepage doesn't link to them by these names.
const CONTACT_PATHS = [
  "",
  "/contact",
  "/contact-us",
  "/contacts",
  "/about",
  "/about-us",
  "/about-me",
  "/team",
  "/our-team",
  "/meet-the-team",
  "/staff",
  "/people",
  "/get-in-touch",
  "/enquiries",
  "/enquiry",
  "/book",
  "/booking",
  "/bookings",
  "/reservations",
  "/find-us",
];

// Words in a link's href or text that mark it as worth following for an email.
const CONTACT_KEYWORDS = [
  "contact", "about", "team", "staff", "people", "enquir", "enquiry",
  "get-in-touch", "getintouch", "reach", "connect", "book", "reservation",
  "find-us", "findus", "location",
];

// Asset/file extensions that a regex match ending in ".ext" is really a filename
const FILE_EXTENSIONS =
  /\.(png|jpe?g|gif|webp|svg|bmp|tiff?|ico|css|js|json|xml|pdf|mp4|webm|woff2?)$/i;

// Placeholder / third-party / library domains that are never a real contact
const JUNK_DOMAINS = [
  "example.com", "example.org", "example.net", "domain.com", "yourdomain.com",
  "email.com", "test.com", "sentry.io", "wixpress.com", "wix.com",
  "squarespace.com", "godaddy.com", "schema.org", "w3.org", "sentry-next.wixpress.com",
  "googleapis.com", "gstatic.com", "cloudflare.com", "jquery.com", "gravatar.com",
  "cloudfront.net", "shopify.com", "myshopify.com", "wordpress.com", "wp.com",
];

const JUNK_LOCAL_PARTS = ["your", "name", "email", "someone", "user", "info@example"];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// A clean, fully-valid email (used to reject partial/garbled captures)
const STRICT_EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

// Max pages fetched per site (homepage + discovered/fallback), to stay within
// the request time budget.
const MAX_PAGES = 8;

// Markup often carries JSON-escaped unicode (> = ">") or HTML entities
// around emails; decoding them first turns those chars back into delimiters
// so they don't get swallowed into the local part (e.g. "u003einfo@...").
function normalizeMarkup(html: string): string {
  return html
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&amp;/gi, "&")
    .replace(/&#x40;|&commat;/gi, "@");
}

// Lightly-disguised text addresses: "info [at] shop [dot] co [dot] uk".
// Only the bracketed/parenthesised forms are decoded — bare " at "/" dot "
// appear in ordinary prose and would cause false positives.
function deobfuscateText(text: string): string {
  return text
    .replace(/\s*[[({]\s*at\s*[\])}]\s*/gi, "@")
    .replace(/\s*[[({]\s*dot\s*[\])}]\s*/gi, ".");
}

// Cloudflare email obfuscation: the real address is hex-encoded with a leading
// one-byte XOR key, exposed as data-cfemail="..." or in a
// /cdn-cgi/l/email-protection#<hex> link. Decode it back to plaintext.
function decodeCfEmail(encoded: string): string | null {
  try {
    if (encoded.length < 4 || encoded.length % 2 !== 0) return null;
    const key = parseInt(encoded.slice(0, 2), 16);
    let email = "";
    for (let i = 2; i < encoded.length; i += 2) {
      email += String.fromCharCode(parseInt(encoded.slice(i, i + 2), 16) ^ key);
    }
    return email.toLowerCase();
  } catch {
    return null;
  }
}

function isJunk(email: string): boolean {
  if (!STRICT_EMAIL.test(email)) return true;
  if (FILE_EXTENSIONS.test(email)) return true;
  const [local, domain] = email.split("@");
  if (!local || !domain) return true;
  if (JUNK_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) return true;
  if (JUNK_LOCAL_PARTS.includes(local)) return true;
  // Long hex-looking local parts are almost always hashed asset names
  if (/^[0-9a-f]{16,}$/.test(local)) return true;
  return false;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractFromHtml(rawHtml: string): string[] {
  const html = normalizeMarkup(rawHtml);
  const found = new Set<string>();

  // 1. Cloudflare-obfuscated addresses (data-cfemail + email-protection links).
  for (const m of html.matchAll(/data-cfemail="([0-9a-fA-F]+)"/gi)) {
    const addr = decodeCfEmail(m[1]);
    if (addr && STRICT_EMAIL.test(addr)) found.add(addr);
  }
  for (const m of html.matchAll(/\/cdn-cgi\/l\/email-protection#([0-9a-fA-F]+)/gi)) {
    const addr = decodeCfEmail(m[1]);
    if (addr && STRICT_EMAIL.test(addr)) found.add(addr);
  }

  // 2. mailto: links — the most reliable signal. Stop at any character that
  // can't be part of an address (quotes, comma, backslash, query params...).
  const mailtoMatches = html.matchAll(/mailto:([^"'?>\s,\\<)]+)/gi);
  for (const m of mailtoMatches) {
    let addr = m[1].trim().toLowerCase();
    try {
      addr = decodeURIComponent(addr);
    } catch {
      // keep as-is if it isn't valid percent-encoding
    }
    if (STRICT_EMAIL.test(addr)) found.add(addr);
  }

  // 3. Plain-text / in-markup addresses, including lightly-obfuscated ones.
  const text = deobfuscateText(html);
  const textMatches = text.matchAll(EMAIL_REGEX);
  for (const m of textMatches) {
    const addr = m[0].trim().toLowerCase().replace(/[.,;:]+$/, "");
    if (STRICT_EMAIL.test(addr)) found.add(addr);
  }

  return [...found];
}

// Find same-site links on the homepage that look like contact/about/team pages,
// so we follow the site's real navigation instead of only guessing paths.
function discoverContactLinks(homepageHtml: string, origin: string): string[] {
  const links = new Set<string>();
  try {
    const $ = cheerio.load(homepageHtml);
    const host = new URL(origin).hostname.replace(/^www\./, "");
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = ($(el).text() || "").toLowerCase();
      const hay = (href + " " + text).toLowerCase();
      if (!CONTACT_KEYWORDS.some((k) => hay.includes(k))) return;
      try {
        const abs = new URL(href, origin);
        if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
        // Same registrable site only — ignore external/social links.
        if (abs.hostname.replace(/^www\./, "") !== host) return;
        abs.hash = "";
        links.add(abs.toString());
      } catch {
        // skip unparseable hrefs
      }
    });
  } catch {
    // best-effort
  }
  return [...links];
}

/**
 * Scrape published email addresses from a business website.
 * Returns a de-duplicated list ordered with same-domain (e.g. info@theirsite.co.uk)
 * addresses first, since those are the most likely genuine business contacts.
 */
export async function scrapeEmailsFromWebsite(domain: string): Promise<string[]> {
  const base = `https://${domain}`;
  const all = new Set<string>();

  // 1. Homepage first — it also tells us which contact pages the site links to.
  const homepage = await fetchPage(base);
  if (homepage) {
    for (const email of extractFromHtml(homepage)) {
      if (!isJunk(email)) all.add(email);
    }
  }

  // 2. Build the page list: links discovered on the homepage, then the fixed
  // fallback paths — de-duplicated and capped.
  const discovered = homepage ? discoverContactLinks(homepage, base) : [];
  const fallback = CONTACT_PATHS.filter((p) => p !== "").map((p) => base + p);
  const toVisit: string[] = [];
  for (const url of [...discovered, ...fallback]) {
    const normalized = url.replace(/\/$/, "");
    if (normalized === base || normalized === base + "/") continue;
    if (!toVisit.includes(normalized)) toVisit.push(normalized);
    if (toVisit.length >= MAX_PAGES - 1) break;
  }

  // 3. Fetch the rest in parallel and harvest emails.
  const pages = await Promise.all(toVisit.map((url) => fetchPage(url)));
  for (const html of pages) {
    if (!html) continue;
    for (const email of extractFromHtml(html)) {
      if (!isJunk(email)) all.add(email);
    }
  }

  const list = [...all];
  const bare = domain.replace(/^www\./, "");
  // Same-domain business emails first, then everything else (gmail, outlook, etc.)
  list.sort((a, b) => {
    const aOwn = a.endsWith("@" + bare) ? 0 : 1;
    const bOwn = b.endsWith("@" + bare) ? 0 : 1;
    return aOwn - bOwn;
  });

  return list.slice(0, 10);
}
