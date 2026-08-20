// Scrapes email addresses directly off a business's own website — the
// homepage plus common contact/about pages. Complements Hunter.io, which
// relies on its own crawl index and often misses small-business emails
// that are plainly published on the site (usually in a mailto: link).

const CONTACT_PATHS = [
  "",
  "/contact",
  "/contact-us",
  "/contacts",
  "/about",
  "/about-us",
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

  // 1. mailto: links — the most reliable signal. Stop at any character that
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

  // 2. Plain-text / in-markup addresses
  const textMatches = html.matchAll(EMAIL_REGEX);
  for (const m of textMatches) {
    const addr = m[0].trim().toLowerCase().replace(/[.,;:]+$/, "");
    if (STRICT_EMAIL.test(addr)) found.add(addr);
  }

  return [...found];
}

/**
 * Scrape published email addresses from a business website.
 * Returns a de-duplicated list ordered with same-domain (e.g. info@theirsite.co.uk)
 * addresses first, since those are the most likely genuine business contacts.
 */
export async function scrapeEmailsFromWebsite(domain: string): Promise<string[]> {
  const base = `https://${domain}`;
  const pages = await Promise.all(
    CONTACT_PATHS.map((path) => fetchPage(base + path))
  );

  const all = new Set<string>();
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
