/**
 * Fundamentaldaten, wie sie an einem vergangenen Stichtag bekannt waren.
 *
 * Ein Backtest der Score-Gewichte ist nur so ehrlich wie die Scores, mit denen
 * er rechnet. `stock_scores` hält einen einzigen Wert je Titel und überschreibt
 * ihn bei jedem Lauf — es gibt nur «jetzt». Wer damit einen Kauf im Januar 2024
 * beurteilt, verwendet Geschäftszahlen, die erst 2026 existierten. Ein
 * Unternehmen, das seither stark geworden ist, sieht rückwirkend schon damals
 * stark aus; der Backtest glänzt und die Strategie trägt nie.
 *
 * Dieses Modul schneidet die EODHD-Antwort auf einen Stichtag zurecht. Alle
 * bestehenden Formeln (`berechnePiotroski`, `berechneQualitaet`, …) lassen sich
 * danach unverändert darauf anwenden — die Rechnung bleibt dieselbe, nur die
 * Eingangsdaten sind die von damals.
 *
 * ZWEI FALLEN, DIE HIER GESCHLOSSEN WERDEN
 *
 * 1. **Der Abschluss ist nicht am Bilanzstichtag bekannt.** Der Jahresabschluss
 *    per 31.12.2023 wird im Frühjahr 2024 veröffentlicht. Ihn ab dem 1.1.2024
 *    zu verwenden, wäre bereits Rückschau. EODHD liefert bei vielen Titeln ein
 *    `filing_date`; fehlt es, gilt eine dokumentierte Meldefrist.
 *
 * 2. **`Highlights` und `Valuation` sind IMMER von heute.** PERatio,
 *    MarketCapitalization, OperatingMarginTTM, ReturnOnEquityTTM, EBITDA — jede
 *    dieser Zahlen ist ein Tageswert ohne Datum. Sie durchzureichen wäre der
 *    stillste und schwerste Rückschaufehler von allen: Die Zahlen sehen
 *    plausibel aus und stammen doch aus der Zukunft. Deshalb werden beide
 *    Blöcke vollständig entfernt, statt einzelne Felder auszuwählen.
 */

/**
 * Angenommene Frist zwischen Bilanzstichtag und Veröffentlichung, in Tagen.
 *
 * Nur wirksam, wenn EODHD kein `filing_date` liefert. 90 Tage sind die
 * gängige Frist für Jahresabschlüsse kotierter Gesellschaften; sie ist eher
 * knapp als grosszügig gewählt — im Zweifel gilt ein Abschluss also später als
 * verfügbar, nicht früher. Das ist die Richtung, die den Rückschaufehler
 * vermeidet.
 */
export const MELDEFRIST_TAGE = 90;

/** `YYYY-MM-DD` → Zeitstempel, oder null bei unbrauchbarer Eingabe. */
function alsDatum(wert: unknown): number | null {
  if (typeof wert !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(wert)) return null;
  const t = Date.parse(`${wert.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(t) ? t : null;
}

/**
 * War dieser Abschluss am Stichtag veröffentlicht?
 *
 * `filingDate` hat Vorrang. Fehlt es, gilt Periodenende + `MELDEFRIST_TAGE`.
 * Ist nicht einmal das Periodenende lesbar, lautet die Antwort «nein» — ein
 * undatierter Abschluss darf nicht in eine datierte Rechnung.
 */
export function abschlussVerfuegbarAm(
  periodenEnde: string,
  filingDate: string | null | undefined,
  stichtag: string,
  meldefristTage: number = MELDEFRIST_TAGE,
): boolean {
  const stich = alsDatum(stichtag);
  if (stich === null) return false;

  const gemeldet = alsDatum(filingDate);
  if (gemeldet !== null) return gemeldet <= stich;

  const ende = alsDatum(periodenEnde);
  if (ende === null) return false;
  return ende + meldefristTage * 86_400_000 <= stich;
}

/** Behält aus einer nach Periodenende geschlüsselten Sammlung nur, was am Stichtag bekannt war. */
function beschneideSammlung(
  sammlung: Record<string, any> | undefined | null,
  stichtag: string,
  meldefristTage: number,
): Record<string, any> {
  const aus: Record<string, any> = {};
  for (const [periode, eintrag] of Object.entries(sammlung ?? {})) {
    const filing = (eintrag as any)?.filing_date ?? (eintrag as any)?.filingDate ?? null;
    if (abschlussVerfuegbarAm(periode, filing, stichtag, meldefristTage)) aus[periode] = eintrag;
  }
  return aus;
}

/**
 * EODHD-Antwort auf den Stand eines Stichtags zurückschneiden.
 *
 * Gibt eine neue Struktur zurück; die Eingabe bleibt unberührt (der Aufrufer
 * rechnet meist mehrere Stichtage aus derselben Antwort).
 *
 * `Highlights` und `Valuation` fehlen im Ergebnis vollständig — siehe Falle 2
 * im Kopf dieser Datei. Wer sie braucht, muss die Werte aus den datierten
 * Abschlüssen und dem Kurs von damals selbst bilden.
 */
export function beschneideFundamentals(
  d: any,
  stichtag: string,
  meldefristTage: number = MELDEFRIST_TAGE,
): any {
  const fin = d?.Financials ?? {};
  const schneideAbschluss = (block: any) => ({
    yearly: beschneideSammlung(block?.yearly, stichtag, meldefristTage),
    quarterly: beschneideSammlung(block?.quarterly, stichtag, meldefristTage),
  });

  return {
    // Stammdaten sind zeitlos genug, um sie durchzureichen.
    General: d?.General ?? {},
    Financials: {
      Balance_Sheet: schneideAbschluss(fin.Balance_Sheet),
      Income_Statement: schneideAbschluss(fin.Income_Statement),
      Cash_Flow: schneideAbschluss(fin.Cash_Flow),
    },
    Earnings: {
      // `Earnings.Annual` trägt kein Meldedatum — es gilt dieselbe Frist.
      Annual: beschneideSammlung(d?.Earnings?.Annual, stichtag, meldefristTage),
      // `History` ist nach Berichtsdatum geschlüsselt und trägt `reportDate`.
      History: beschneideQuartalsberichte(d?.Earnings?.History, stichtag),
    },
    // BEWUSST LEER: jede Zahl darin ist ein Tageswert von heute.
    Highlights: {},
    Valuation: {},
    /** Für den Aufrufer nachvollziehbar, worauf zurückgeschnitten wurde. */
    _stichtag: stichtag,
  };
}

/** Quartalsberichte nach ihrem tatsächlichen Berichtsdatum filtern. */
function beschneideQuartalsberichte(
  history: Record<string, any> | undefined | null,
  stichtag: string,
): Record<string, any> {
  const stich = alsDatum(stichtag);
  if (stich === null) return {};
  const aus: Record<string, any> = {};
  for (const [periode, eintrag] of Object.entries(history ?? {})) {
    const berichtet = alsDatum((eintrag as any)?.reportDate);
    // Ohne Berichtsdatum gilt die Meldefrist auf das Periodenende — Quartale
    // erscheinen schneller als Jahresabschlüsse, deshalb 45 statt 90 Tage.
    const stand = berichtet ?? (() => {
      const ende = alsDatum(periode);
      return ende === null ? null : ende + 45 * 86_400_000;
    })();
    if (stand !== null && stand <= stich) aus[periode] = eintrag;
  }
  return aus;
}

/**
 * Monatliche Stichtage zwischen zwei Daten (jeweils Monatsletzter).
 *
 * Monatlich, nicht täglich: Fundamentaldaten ändern sich vierteljährlich. Ein
 * tägliches Raster erzeugte dreissigmal so viele Zeilen mit demselben Inhalt
 * und liesse einen Backtest über Scheinbeobachtungen laufen.
 */
export function monatsStichtage(von: string, bis: string): string[] {
  const start = alsDatum(von);
  const ende = alsDatum(bis);
  if (start === null || ende === null || start > ende) return [];

  const aus: string[] = [];
  const d = new Date(start);
  d.setUTCDate(1);
  for (;;) {
    // Monatsletzter: erster Tag des Folgemonats minus ein Tag.
    const letzter = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    const t = letzter.getTime();
    if (t > ende) break;
    if (t >= start) aus.push(letzter.toISOString().slice(0, 10));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return aus;
}
