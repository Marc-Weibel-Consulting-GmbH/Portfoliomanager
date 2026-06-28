/**
 * Market Analysis Cron Job
 *
 * Täglich um 08:00 Uhr (Europe/Zurich) wird ein KI-Marktbericht generiert.
 * Montags zusätzlich ein Wochenbericht (period="week").
 *
 * Datenquellen:
 *   - EODHD: Indizes, Sektor-ETFs
 *   - invokeLLM: Headline, Body, 3 Szenarien, detaillierte Sektor-Analyse
 */

import cron from 'node-cron';

let isRunning = false;

// ----------------------------------------------------------------
// Hilfsfunktionen
// ----------------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

async function fetchIndexData(): Promise<{ label: string; price: number | null; change: number | null }[]> {
  const { fetchEODHDRealTime } = await import('../_core/eodhdApi');
  const defs = [
    { label: 'SMI',     ticker: 'SSMI.INDX' },
    { label: 'S&P 500', ticker: 'GSPC.INDX' },
    { label: 'Nasdaq',  ticker: 'IXIC.INDX' },
    { label: 'SOX',     ticker: 'SOX.INDX' },
    { label: 'Gold',    ticker: 'GLD.US' },
    { label: 'BTC',     ticker: 'BTC-USD.CC' },
  ];
  const results = await Promise.allSettled(defs.map(async (d) => {
    const rt = await fetchEODHDRealTime(d.ticker);
    return { label: d.label, price: rt.close ?? null, change: rt.changePercent };
  }));
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { label: defs[i].label, price: null, change: null }
  );
}

async function fetchSectorData(): Promise<{ key: string; label: string; change: number | null }[]> {
  const { fetchEODHDRealTime } = await import('../_core/eodhdApi');
  const defs = [
    { key: 'XLK',  label: 'Technologie' },
    { key: 'XLF',  label: 'Finanzen' },
    { key: 'XLV',  label: 'Gesundheit' },
    { key: 'XLE',  label: 'Energie' },
    { key: 'XLI',  label: 'Industrie' },
    { key: 'XLY',  label: 'Konsum zyklisch' },
    { key: 'XLP',  label: 'Konsum defensiv' },
    { key: 'XLU',  label: 'Versorger' },
    { key: 'XLRE', label: 'Immobilien' },
    { key: 'XLB',  label: 'Materialien' },
    { key: 'XLC',  label: 'Kommunikation' },
    { key: 'SMH',  label: 'Halbleiter' },
  ];
  const results = await Promise.allSettled(defs.map(async (d) => {
    const rt = await fetchEODHDRealTime(`${d.key}.US`);
    return { key: d.key, label: d.label, change: rt.changePercent };
  }));
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { ...defs[i], change: null }
  );
}

// ----------------------------------------------------------------
// Haupt-Analyse-Funktion
// ----------------------------------------------------------------

export async function runMarketAnalysis(period: 'day' | 'week' = 'day'): Promise<void> {
  console.log(`[marketAnalysisCron] Starte KI-Marktanalyse (period=${period})...`);

  const { invokeLLM } = await import('../_core/llm');
  const { getDb } = await import('../db');
  const { marketAnalysis } = await import('../../drizzle/schema');

  const [indices, sectors] = await Promise.all([fetchIndexData(), fetchSectorData()]);

  const indexSummary = indices
    .map(i => `${i.label}: ${i.price !== null ? i.price.toFixed(0) : '?'} (${i.change !== null ? (i.change >= 0 ? '+' : '') + i.change.toFixed(2) + '%' : 'n/v'})`)
    .join(', ');

  const sectorSummary = sectors
    .map(s => `${s.label} (${s.key}): ${s.change !== null ? (s.change >= 0 ? '+' : '') + s.change.toFixed(2) + '%' : 'n/v'}`)
    .join(', ');

  const isWeekly = period === 'week';
  const systemPrompt = `Du bist ein erfahrener Schweizer Portfoliomanager und Marktanalyst.
Schreibe einen ${isWeekly ? 'Wochenbericht' : 'Tagesbericht'} für einen Schweizer Privatinvestor.
Antworte ausschliesslich auf Deutsch, prägnant und professionell.
Verwende keine Emojis. Halte den Ton sachlich-analytisch.
Du hast Zugang zu den aktuellen Marktdaten und sollst daraus eine fundierte Analyse erstellen.`;

  const userPrompt = `Aktuelle Marktdaten (${todayStr()}):

Indizes: ${indexSummary}

Sektoren (US-ETFs, Tagesveränderung): ${sectorSummary}

Erstelle einen strukturierten ${isWeekly ? 'Wochenbericht' : 'Tagesbericht'} mit:

1. **Regime**: Ein kurzer Begriff für das aktuelle Marktumfeld (z.B. "Risk-On", "Risk-Off · Korrektur", "Defensive Rotation", max. 5 Wörter)
2. **RegimeTone**: "good" (bullisch), "warn" (neutral/gemischt) oder "bad" (bärisch)
3. **Headline**: Eine prägnante, aussagekräftige Überschrift (max. 80 Zeichen)
4. **Body**: 3-4 Sätze Marktkommentar mit konkreten Zahlen und Strategie-Empfehlung
5. **Szenarien**: Genau 3 Szenarien mit kurzen Labels (z.B. "Rebound-Rally", "Konsolidierung", "Weiterer Selloff"), Wahrscheinlichkeit (Summe = 100%) und Tone
6. **Sektoren**: Wähle die 5-7 WICHTIGSTEN Sektoren basierend auf der aktuellen Marktlage aus (nicht alle!). Für jeden Sektor:
   - Ein spezifischer Name (z.B. "Halbleiter & Memory", "Pharma & Healthcare", "Finanz & Versicherung")
   - Eine Unterkategorie/Strategie (z.B. "Selektiv kaufen", "Defensiv stark", "Neutral")
   - Eine Handlungsempfehlung: "KAUFEN" oder "ABWARTEN"
   - Eine DETAILLIERTE Beschreibung (4-5 Sätze!) mit konkreten Fakten, Bewertungen, Katalysatoren
   - 3 relevante Aktientitel mit Ticker und geschätzter Tagesperformance

Antworte als JSON:
{
  "regime": "...",
  "regimeTone": "good|warn|bad",
  "headline": "...",
  "body": "...",
  "scenarios": [
    {"label": "Rebound-Rally", "prob": 40, "tone": "good", "description": "..."},
    {"label": "Konsolidierung", "prob": 35, "tone": "warn", "description": "..."},
    {"label": "Weiterer Selloff", "prob": 25, "tone": "bad", "description": "..."}
  ],
  "sectorData": [
    {
      "key": "SMH",
      "label": "Halbleiter & Memory",
      "subcategory": "Selektiv kaufen",
      "action": "KAUFEN",
      "change": -5.3,
      "comment": "Detaillierte 4-5 Sätze Analyse des Sektors...",
      "stocks": [
        {"ticker": "MU", "change": -2.1},
        {"ticker": "AMAT", "change": -0.8},
        {"ticker": "NVDA", "change": -1.4}
      ]
    }
  ]
}`;

  let analysisData: any;
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'market_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              regime:     { type: 'string' },
              regimeTone: { type: 'string', enum: ['good', 'warn', 'bad'] },
              headline:   { type: 'string' },
              body:       { type: 'string' },
              scenarios: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label:       { type: 'string' },
                    prob:        { type: 'number' },
                    tone:        { type: 'string', enum: ['good', 'warn', 'bad'] },
                    description: { type: 'string' },
                  },
                  required: ['label', 'prob', 'tone', 'description'],
                  additionalProperties: false,
                },
              },
              sectorData: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    key:         { type: 'string' },
                    label:       { type: 'string' },
                    subcategory: { type: 'string' },
                    action:      { type: 'string', enum: ['KAUFEN', 'ABWARTEN'] },
                    change:      { type: ['number', 'null'] },
                    comment:     { type: 'string' },
                    stocks: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          ticker: { type: 'string' },
                          change: { type: 'number' },
                        },
                        required: ['ticker', 'change'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['key', 'label', 'subcategory', 'action', 'change', 'comment', 'stocks'],
                  additionalProperties: false,
                },
              },
            },
            required: ['regime', 'regimeTone', 'headline', 'body', 'scenarios', 'sectorData'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('Leere LLM-Antwort');
    analysisData = typeof content === 'string' ? JSON.parse(content) : content;
  } catch (err) {
    console.error('[marketAnalysisCron] LLM-Fehler:', err);
    // Fallback: Einfacher Bericht aus Rohdaten
    const bestSector = sectors.filter(s => s.change !== null).sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
    const worstSector = sectors.filter(s => s.change !== null).sort((a, b) => (a.change ?? 0) - (b.change ?? 0))[0];
    const avgChange = indices.filter(i => i.change !== null).reduce((s, i) => s + (i.change ?? 0), 0) / Math.max(1, indices.filter(i => i.change !== null).length);
    analysisData = {
      regime: avgChange > 0.5 ? 'Risk-On' : avgChange < -0.5 ? 'Risk-Off' : 'Konsolidierung',
      regimeTone: avgChange > 0.5 ? 'good' : avgChange < -0.5 ? 'bad' : 'warn',
      headline: `Marktübersicht ${todayStr()}: ${avgChange >= 0 ? 'Positive' : 'Negative'} Tendenz`,
      body: `Die wichtigsten Indizes zeigen heute eine ${avgChange >= 0 ? 'positive' : 'negative'} Tendenz. ${bestSector ? `Stärkster Sektor: ${bestSector.label}.` : ''} ${worstSector ? `Schwächster Sektor: ${worstSector.label}.` : ''}`,
      scenarios: [
        { label: 'Rebound-Rally', prob: 30, tone: 'good', description: 'Technische Erholung nach Überverkauft-Signal.' },
        { label: 'Konsolidierung', prob: 50, tone: 'warn', description: 'Seitwärtsbewegung mit erhöhter Volatilität.' },
        { label: 'Weiterer Selloff', prob: 20, tone: 'bad', description: 'Korrektur bei negativen Makrodaten.' },
      ],
      sectorData: sectors.slice(0, 6).map(s => ({
        key: s.key, label: s.label, subcategory: 'Neutral', action: 'ABWARTEN' as const,
        change: s.change,
        comment: s.change !== null ? (s.change > 0 ? 'Positiver Trend heute.' : 'Unter Druck.') : 'Keine Daten verfügbar.',
        stocks: [],
      })),
    };
  }

  // In DB speichern
  const db = await getDb();
  if (!db) {
    console.error('[marketAnalysisCron] Datenbank nicht verfügbar');
    return;
  }

  await db.insert(marketAnalysis).values({
    period,
    regime: analysisData.regime ?? 'Unbekannt',
    regimeTone: analysisData.regimeTone ?? 'warn',
    headline: analysisData.headline ?? '',
    body: analysisData.body ?? '',
    scenarios: analysisData.scenarios ?? [],
    sectorData: analysisData.sectorData ?? [],
    dataDate: todayStr(),
  });

  console.log(`[marketAnalysisCron] KI-Marktanalyse gespeichert (period=${period}, regime=${analysisData.regime})`);
}

// ----------------------------------------------------------------
// Cron-Initialisierung
// ----------------------------------------------------------------

export function initMarketAnalysisCron(): void {
  console.log('[marketAnalysisCron] Initialisiere Cron (täglich 08:00 CET)...');

  // Täglich um 08:00 Uhr (UTC+1/UTC+2 je nach Sommerzeit → 06:00 UTC im Sommer)
  cron.schedule('0 6 * * *', async () => {
    if (isRunning) {
      console.log('[marketAnalysisCron] Läuft bereits, überspringe...');
      return;
    }
    isRunning = true;
    try {
      const dayOfWeek = new Date().getDay(); // 0=So, 1=Mo
      await runMarketAnalysis('day');
      if (dayOfWeek === 1) {
        // Montags: zusätzlich Wochenbericht
        await runMarketAnalysis('week');
      }
    } catch (err) {
      console.error('[marketAnalysisCron] Fehler:', err);
    } finally {
      isRunning = false;
    }
  });

  console.log('[marketAnalysisCron] Cron initialisiert (täglich 06:00 UTC = 08:00 CEST)');
}
