import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getApolloFeed } from "./apolloFeed";

// Minimaler, aber realistischer WordPress-RSS-Ausschnitt (Apollo Academy).
const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>The Daily Spark Archives - Apollo Academy</title>
  <item>
    <title>Understanding the Rise and Recent Fall in Gold Prices</title>
    <link>https://www.apolloacademy.com/gold-prices/</link>
    <pubDate>Wed, 15 Jul 2026 11:00:00 +0000</pubDate>
    <category><![CDATA[The Daily Spark]]></category>
    <category><![CDATA[a-differentiated-way-parent]]></category>
    <description><![CDATA[Gold has risen sharply this year&#8217;s cycle before easing. The post Understanding the Rise appeared first on Apollo Academy.]]></description>
  </item>
  <item>
    <title>Outlook for Public and Private Markets</title>
    <link>https://www.apolloacademy.com/outlook/</link>
    <pubDate>Tue, 14 Jul 2026 09:30:00 +0000</pubDate>
    <category><![CDATA[The Daily Spark]]></category>
    <description><![CDATA[Torsten Slok&#8217;s view on rates and credit.]]></description>
  </item>
</channel></rss>`;

describe("getApolloFeed (RSS-Reader)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      text: async () => FIXTURE,
    })) as any);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("parst Titel, Link, Datum, Kategorien und bereinigt den Exzerpt", async () => {
    const res = await getApolloFeed(true);
    expect(res.items.length).toBeGreaterThanOrEqual(2);

    const gold = res.items.find((i) => i.link === "https://www.apolloacademy.com/gold-prices/");
    expect(gold).toBeTruthy();
    expect(gold!.title).toBe("Understanding the Rise and Recent Fall in Gold Prices");
    expect(gold!.publishedAt).toBe("2026-07-15");
    // Entities dekodiert (kein rohes &#8217;), „The post …" entfernt.
    expect(gold!.excerpt).toContain("Gold has risen sharply this");
    expect(gold!.excerpt).toContain("cycle before easing");
    expect(gold!.excerpt).not.toContain("&#8217;");
    expect(gold!.excerpt).not.toContain("The post");
    // interne WordPress-Slugs (…-parent) ausgefiltert.
    expect(gold!.categories).toContain("The Daily Spark");
    expect(gold!.categories.some((c) => c.endsWith("-parent"))).toBe(false);
  });

  it("dedupliziert nach Link und sortiert neueste zuerst", async () => {
    const res = await getApolloFeed(true);
    const links = res.items.map((i) => i.link);
    expect(new Set(links).size).toBe(links.length);
    expect(res.items[0].publishedAt! >= res.items[1].publishedAt!).toBe(true);
  });

  it("liefert bei Fetch-Fehler ein leeres, aber wohlgeformtes Ergebnis", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, text: async () => "" })) as any);
    const res = await getApolloFeed(true);
    expect(res.items).toEqual([]);
    expect(res.sources.every((s) => s.ok === false)).toBe(true);
    expect(typeof res.fetchedAt).toBe("string");
  });
});
