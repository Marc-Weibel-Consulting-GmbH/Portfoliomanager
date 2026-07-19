/**
 * Apollo Academy Research-Feed (Torsten Slok).
 *
 * Apollo bietet keine offene API, aber die öffentliche Research-Seite ist eine
 * WordPress-Site mit sauberen RSS-Feeds (robots.txt erlaubt alles). Wir lesen
 * daher die RSS-Feeds — maschinenlesbar gedacht, stabil und ohne HTML-Scraping.
 *
 * Wir speichern und zeigen NUR Metadaten: Titel, Link, Datum, Kategorie und den
 * vom Feed gelieferten Kurz-Exzerpt — mit Rückverweis auf die Originalquelle
 * (wie ein RSS-Reader / News-Aggregator). Keine Vollinhalte, keine Grafiken.
 *
 * Ergebnis wird 30 Min im Speicher gecacht (der Feed ändert sich ~täglich).
 */

const FEEDS: Array<{ key: string; label: string; url: string }> = [
  {
    key: "daily-spark",
    label: "The Daily Spark",
    url: "https://www.apolloacademy.com/category/the-daily-spark/feed/",
  },
  {
    key: "apollo",
    label: "Outlooks & The View from Apollo",
    url: "https://www.apolloacademy.com/feed/",
  },
];

export interface ApolloFeedItem {
  title: string;
  link: string;
  publishedAt: string | null; // ISO-Datum (YYYY-MM-DD) oder null
  categories: string[];
  excerpt: string;
  feed: string; // "daily-spark" | "apollo"
}

export interface ApolloFeedResult {
  items: ApolloFeedItem[];
  fetchedAt: string;
  sources: Array<{ key: string; label: string; url: string; ok: boolean }>;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
let cache: { at: number; data: ApolloFeedResult } | null = null;

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#8217;|&#039;|&#39;|&apos;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&#8230;/g, "…")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"');
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : null;
}

function parseItems(xml: string, feedKey: string): ApolloFeedItem[] {
  const items: ApolloFeedItem[] = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? [];
  for (const raw of blocks) {
    const block = raw.replace(/^<item>/i, "").replace(/<\/item>$/i, "");
    const title = stripTags(decodeEntities(tag(block, "title") ?? "")).trim();
    const link = stripTags(decodeEntities(tag(block, "link") ?? "")).trim();
    if (!title || !link) continue;

    const pub = tag(block, "pubDate");
    let publishedAt: string | null = null;
    if (pub) {
      const d = new Date(pub.trim());
      if (!isNaN(d.getTime())) publishedAt = d.toISOString().slice(0, 10);
    }

    const categories = Array.from(block.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi))
      .map((m) => stripTags(decodeEntities(m[1])).trim())
      .filter(Boolean)
      // interne WordPress-Slugs (…-parent) ausblenden
      .filter((c) => !/-parent$/.test(c) && !/Archives$/i.test(c))
      .slice(0, 4);

    let excerpt = stripTags(decodeEntities(tag(block, "description") ?? "")).trim();
    // WordPress hängt „The post … appeared first on …" an — entfernen.
    excerpt = excerpt.replace(/The post .*$/s, "").trim();
    if (excerpt.length > 240) excerpt = excerpt.slice(0, 237).trimEnd() + "…";

    items.push({ title, link, publishedAt, categories, excerpt, feed: feedKey });
  }
  return items;
}

async function fetchFeed(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PortfoliomanagerResearchBot/1.0 (+https://www.portfolio.mw)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function getApolloFeed(force = false): Promise<ApolloFeedResult> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const sources: ApolloFeedResult["sources"] = [];
  const all: ApolloFeedItem[] = [];
  for (const feed of FEEDS) {
    const xml = await fetchFeed(feed.url);
    const ok = xml != null;
    sources.push({ key: feed.key, label: feed.label, url: feed.url, ok });
    if (xml) all.push(...parseItems(xml, feed.key));
  }

  // Dedupe nach Link, neueste zuerst, cap 24.
  const seen = new Set<string>();
  const items = all
    .filter((it) => (seen.has(it.link) ? false : (seen.add(it.link), true)))
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 24);

  const data: ApolloFeedResult = { items, fetchedAt: new Date().toISOString(), sources };
  cache = { at: Date.now(), data };
  return data;
}
