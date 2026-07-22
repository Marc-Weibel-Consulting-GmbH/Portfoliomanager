/**
 * Multi-Bank Depotauszug-Parser (Registry)
 * =========================================
 * Macht den PDF-Positionsimport banken-flexibel:
 *
 *   1. Bank-Erkennung ueber Identifier im extrahierten PDF-Text
 *      (detectBank — Confidence-Scoring statt hartem Swissquote-Hard-Fail).
 *   2. Swissquote -> bewaehrter deterministischer Parser
 *      (server/lib/swissquoteParser.ts, unveraendert).
 *   3. Alle anderen Banken (LUKB, UBS, ZKB, PostFinance, Raiffeisen,
 *      Credit Suisse, Privatbank Reichmuth & Co, Saxo, DEGIRO, finpension,
 *      IBKR, unbekannt) -> generische KI-Extraktion via invokeLLM + json_schema.
 *      Ergebnis wird serverseitig validiert (ISIN-Format, Plausibilitaet,
 *      Duplikate) und mit parserUsed="llm" + Warnhinweis markiert, damit
 *      der Review-Dialog den Nutzer zur Kontrolle auffordern kann.
 *
 * Das Import-Contract (pdfImportRouter.importPositions) ist bereits
 * bankneutral — es musste nicht angepasst werden.
 */

import {
  parseSwissquoteDepotauszug,
  type DepotauszugPosition,
} from "../swissquoteParser";

// ─── Typen ──────────────────────────────────────────────────────────────────

export type BankId =
  | "swissquote"
  | "reichmuth"
  | "lukb"
  | "ubs"
  | "credit_suisse"
  | "zkb"
  | "postfinance"
  | "raiffeisen"
  | "saxo"
  | "degiro"
  | "finpension"
  | "ibkr"
  | "unknown";

export interface BankDetection {
  bankId: BankId;
  bankName: string;
  /** 0..1 — wie sicher die Erkennung ist (Signaturen im Kopf zaehlen mehr). */
  confidence: number;
}

export type ParserUsed = "deterministic" | "llm";

export interface AutoDepotauszugResult {
  positions: DepotauszugPosition[];
  parseErrors: string[];
  pageCount: number;
  reportDate: string | null;
  accountHolder: string | null;
  totalValueCHF: number | null;
  bankId: BankId;
  bankName: string;
  parserUsed: ParserUsed;
}

/** Signatur des injizierbaren LLM-Aufrufs (Production: invokeLLM). */
export type LlmInvokeFn = (params: {
  messages: Array<{ role: string; content: string }>;
  outputSchema?: {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
  maxTokens?: number;
}) => Promise<{
  choices: Array<{ message: { content: string | unknown } }>;
}>;

// ─── Bank-Erkennung ─────────────────────────────────────────────────────────

const BANK_SIGNATURES: Array<{
  id: BankId;
  name: string;
  patterns: RegExp[];
}> = [
  { id: "swissquote", name: "Swissquote", patterns: [/swissquote/i] },
  {
    // Reichmuth & Co (Luzerner Privatbank) nutzt die LUKB als Depotbank —
    // beide Namen stehen im Auszug. Reichmuth ist der Aussteller und wird
    // deshalb VOR der LUKB geprueft; drei Muster geben zudem mehr Score.
    id: "reichmuth",
    name: "Privatbank Reichmuth & Co",
    patterns: [
      /reichmuth\s*&\s*co/i,
      /privatbank\s+reichmuth/i,
      /\breichmuth\b/i,
    ],
  },
  {
    id: "lukb",
    name: "Luzerner Kantonalbank",
    patterns: [/luzerner\s+kantonalbank/i, /\bLUKB\b/],
  },
  {
    id: "ubs",
    name: "UBS",
    patterns: [/\bUBS\b/, /ubs\s+(switzerland|ag)/i],
  },
  {
    id: "credit_suisse",
    name: "Credit Suisse",
    patterns: [/credit\s+suisse/i],
  },
  {
    id: "zkb",
    name: "Zürcher Kantonalbank",
    patterns: [/zürcher\s+kantonalbank/i, /\bZKB\b/],
  },
  { id: "postfinance", name: "PostFinance", patterns: [/postfinance/i] },
  { id: "raiffeisen", name: "Raiffeisen", patterns: [/raiffeisen/i] },
  {
    id: "saxo",
    name: "Saxo Bank",
    patterns: [/saxo\s*bank/i, /saxotrader/i],
  },
  {
    id: "degiro",
    name: "DEGIRO",
    patterns: [/\bdegiro\b/i, /flatex\s*degiro/i],
  },
  { id: "finpension", name: "finpension", patterns: [/finpension/i] },
  {
    id: "ibkr",
    name: "Interactive Brokers",
    patterns: [/interactive\s+brokers/i, /\bIBKR\b/],
  },
];

/** Kopfbereich, in dem Bank-Logos/Absender typischerweise stehen. */
const HEADER_SCAN_CHARS = 6000;

export function detectBank(rawText: string): BankDetection {
  const header = rawText.slice(0, HEADER_SCAN_CHARS);
  let best: BankDetection = {
    bankId: "unknown",
    bankName: "Unbekannte Bank",
    confidence: 0,
  };
  for (const sig of BANK_SIGNATURES) {
    let score = 0;
    for (const pattern of sig.patterns) {
      if (pattern.test(header)) score += 0.7;
      else if (pattern.test(rawText)) score += 0.4;
    }
    if (score > best.confidence) {
      best = {
        bankId: sig.id,
        bankName: sig.name,
        confidence: Math.min(score, 1),
      };
    }
  }
  return best;
}

// ─── PDF-Textextraktion ─────────────────────────────────────────────────────

async function extractPdfText(
  buffer: Buffer
): Promise<{ text: string; pageCount: number }> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer, { max: 0 });
  return { text: data.text || "", pageCount: data.numpages || 0 };
}

// ─── KI-Extraktion (generisch fuer alle Banken) ─────────────────────────────

/** Obergrenze fuer den an das LLM gesendeten Text (Kopf + Ende behalten). */
const LLM_MAX_CHARS = 60_000;
const LLM_HEAD_CHARS = 45_000;

const EXTRACTION_SCHEMA = {
  name: "depotauszug_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      reportDate: {
        type: ["string", "null"],
        description:
          "Stichtag des Depotauszugs im Format YYYY-MM-DD (z. B. aus 'per 23.04.2025'), sonst null",
      },
      accountHolder: {
        type: ["string", "null"],
        description: "Name des Kontoinhabers, falls erkennbar, sonst null",
      },
      totalValueCHF: {
        type: ["number", "null"],
        description:
          "Gesamtwert des Depots in CHF, falls im Dokument ausgewiesen, sonst null",
      },
      positions: {
        type: "array",
        description:
          "Wertpapier-Positionen (Aktien, ETFs, Fonds, Anleihen, Krypto). KEINE Cash-/Konto-Salden.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Bezeichnung des Titels" },
            isin: {
              type: ["string", "null"],
              description: "ISIN (12 Zeichen), falls vorhanden, sonst null",
            },
            currency: {
              type: "string",
              description: "Handelswaehrung (ISO-Code, z. B. CHF, USD)",
            },
            quantity: { type: "number", description: "Stueckzahl (> 0)" },
            avgPurchasePrice: {
              type: ["number", "null"],
              description:
                "Durchschnittlicher Einstandspreis in 'currency', falls ausgewiesen, sonst null",
            },
            marketPrice: {
              type: ["number", "null"],
              description: "Aktueller Kurs in 'currency', sonst null",
            },
            marketValueCHF: {
              type: ["number", "null"],
              description:
                "Positionswert in CHF, falls ausgewiesen, sonst null",
            },
            assetType: {
              type: "string",
              enum: ["stock", "bond", "commodity", "crypto", "cash"],
              description: "'bond' fuer Obligationen/Anleihen, 'commodity' fuer Gold-/Rohwaren-ETFs und physische Rohstoffe, 'crypto' fuer Kryptowaehrungen und Krypto-Zertifikate/-ETPs, 'cash' fuer Geldmarkt/Konto, sonst 'stock'",
            },
          },
          required: [
            "name",
            "isin",
            "currency",
            "quantity",
            "avgPurchasePrice",
            "marketPrice",
            "marketValueCHF",
            "assetType",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["reportDate", "accountHolder", "totalValueCHF", "positions"],
    additionalProperties: false,
  },
} as const;

function buildExtractionPrompt(rawText: string, detection: BankDetection) {
  const truncated =
    rawText.length > LLM_MAX_CHARS
      ? rawText.slice(0, LLM_HEAD_CHARS) +
        "\n\n[... Mittelteil gekuerzt ...]\n\n" +
        rawText.slice(-(LLM_MAX_CHARS - LLM_HEAD_CHARS))
      : rawText;

  return [
    {
      role: "system",
      content:
        "Du bist ein praeziser Extraktor fuer Bank-Depotauszuege (Schweizer und " +
        "internationale Banken). Du lieferst ausschliesslich strukturierte Daten " +
        "gemäss Schema. Regeln:\n" +
        "- Extrahiere NUR Wertpapier-Positionen (Aktien, ETFs, Fonds, Anleihen, " +
        "Krypto). Cash-Konten, Zinsen, Gebuehren und Totalzeilen sind KEINE Positionen.\n" +
        "- Schweizer Zahlenformat: 1'234.56 bedeutet 1234.56. Apostrophe entfernen.\n" +
        "- Datumsformate DD.MM.YYYY nach YYYY-MM-DD umwandeln.\n" +
        "- Fehlende Werte als null angeben, NICHT schaetzen.\n" +
        "- Jede Position nur einmal (keine Subtotal-/Gruppenzeilen als Positionen).\n" +
        "- assetType-Klassifikation (WICHTIG):\n" +
        "  'bond': Obligationen, Anleihen, Bonds, Schuldverschreibungen (erkennbar an Kupon %, Faelligkeit, ISIN-Prefix CH/XS/US/DE mit Laufzeit).\n" +
        "  'commodity': Gold-ETFs, Silber-ETFs, Rohwaren-ETFs, physisches Gold/Silber (Swisscanto Gold ETF, iShares Gold, ETFS Physical Gold etc.).\n" +
        "  'crypto': Kryptowaehrungen (BTC, ETH etc.), Krypto-Zertifikate (Vontobel BTC, 21Shares etc.), Krypto-ETPs/ETNs.\n" +
        "  'cash': Geldmarktfonds, Liquiditaet, Kontosalden.\n" +
        "  'stock': Alles andere (Aktien, Aktien-ETFs, Aktienfonds, REITs).",
    },
    {
      role: "user",
      content:
        `Extrahiere alle Wertpapier-Positionen aus diesem Depotauszug` +
        (detection.bankId !== "unknown"
          ? ` (erkannte Bank: ${detection.bankName})`
          : "") +
        `:\n\n${truncated}`,
    },
  ];
}

const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

export interface LlmExtractionOutcome {
  positions: DepotauszugPosition[];
  reportDate: string | null;
  accountHolder: string | null;
  totalValueCHF: number | null;
  warnings: string[];
}

/**
 * Fuehrt die KI-Extraktion aus und validiert das Ergebnis serverseitig.
 * `llmFn` ist injizierbar (Tests); Standard ist invokeLLM aus _core/llm.
 */
export async function extractPositionsViaLlm(
  rawText: string,
  detection: BankDetection,
  llmFn?: LlmInvokeFn
): Promise<LlmExtractionOutcome> {
  const invoke =
    llmFn ??
    (async params => {
      const { invokeLLM } = await import("../../_core/llm");
      return invokeLLM(params as never) as never;
    });

  const warnings: string[] = [
    detection.bankId !== "unknown"
      ? `Bank erkannt: ${detection.bankName} — Positionen via KI-Extraktion gelesen, bitte im nächsten Schritt prüfen.`
      : `Bank nicht eindeutig erkannt — Positionen via KI-Extraktion gelesen, bitte im nächsten Schritt prüfen.`,
  ];

  const response = await invoke({
    messages: buildExtractionPrompt(rawText, detection),
    outputSchema: EXTRACTION_SCHEMA,
    maxTokens: 8192,
  });

  const rawContent = response?.choices?.[0]?.message?.content;
  const text =
    typeof rawContent === "string"
      ? rawContent
      : JSON.stringify(rawContent ?? "");
  if (!text.trim()) {
    throw new Error("KI-Extraktion lieferte eine leere Antwort.");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("KI-Extraktion lieferte kein valides JSON.");
  }

  const rawPositions: any[] = Array.isArray(parsed?.positions)
    ? parsed.positions
    : [];

  const seen = new Set<string>();
  const positions: DepotauszugPosition[] = [];

  for (const p of rawPositions) {
    const name = String(p?.name ?? "").trim();
    const quantity = Number(p?.quantity);
    if (name.length < 2) {
      warnings.push(`Position mit unleserlichem Namen verworfen: "${name}"`);
      continue;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      warnings.push(`Position "${name}" verworfen: ungueltige Stueckzahl.`);
      continue;
    }

    let isin: string | null =
      typeof p?.isin === "string" ? p.isin.trim().toUpperCase() : null;
    if (isin && !ISIN_REGEX.test(isin)) {
      warnings.push(`"${name}": ungueltige ISIN "${isin}" entfernt.`);
      isin = null;
    }

    const currency = String(p?.currency ?? "CHF")
      .trim()
      .toUpperCase()
      .slice(0, 3);

    const rawAssetType = String(p?.assetType ?? "stock");
    const assetType: DepotauszugPosition["assetType"] =
      rawAssetType === "bond" ? "bond" :
      rawAssetType === "commodity" ? "commodity" :
      rawAssetType === "crypto" ? "crypto" :
      rawAssetType === "cash" ? "cash" :
      "stock";

    const dedupeKey = `${isin ?? name.toLowerCase()}|${quantity}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    positions.push({
      name,
      isin,
      currency: currency || "CHF",
      quantity,
      avgPurchasePrice: toNullableNumber(p?.avgPurchasePrice),
      marketPrice: toNullableNumber(p?.marketPrice),
      marketValueCHF: toNullableNumber(p?.marketValueCHF),
      assetType,
    });
  }

  return {
    positions,
    reportDate: parseReportDate(parsed?.reportDate),
    accountHolder:
      typeof parsed?.accountHolder === "string" && parsed.accountHolder.trim()
        ? parsed.accountHolder.trim()
        : null,
    totalValueCHF: toNullableNumber(parsed?.totalValueCHF),
    warnings,
  };
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseReportDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? value : null;
}

// ─── Registry-Einstieg ──────────────────────────────────────────────────────

/**
 * Parst einen Depotauszug beliebiger Bank:
 * Swissquote deterministisch, alle anderen Banken via KI-Extraktion.
 * Findet der deterministische Parser nichts, greift die KI als Fallback.
 */
export async function parseDepotauszugAuto(
  buffer: Buffer,
  opts?: { llmFn?: LlmInvokeFn }
): Promise<AutoDepotauszugResult> {
  const { text, pageCount } = await extractPdfText(buffer);
  const detection = detectBank(text);

  if (detection.bankId === "swissquote") {
    const result = await parseSwissquoteDepotauszug(buffer);
    if (result.positions.length > 0 || result.parseErrors.length === 0) {
      return {
        positions: result.positions,
        parseErrors: result.parseErrors,
        pageCount: result.pageCount || pageCount,
        reportDate: result.reportDate,
        accountHolder: result.accountHolder,
        totalValueCHF: result.totalValueCHF,
        bankId: detection.bankId,
        bankName: detection.bankName,
        parserUsed: "deterministic",
      };
    }
    // Deterministischer Parser fand nichts -> KI-Fallback statt Sackgasse.
  }

  try {
    const llm = await extractPositionsViaLlm(text, detection, opts?.llmFn);
    return {
      positions: llm.positions,
      parseErrors: llm.warnings,
      pageCount,
      reportDate: llm.reportDate,
      accountHolder: llm.accountHolder,
      totalValueCHF: llm.totalValueCHF,
      bankId: detection.bankId,
      bankName: detection.bankName,
      parserUsed: "llm",
    };
  } catch (err: any) {
    return {
      positions: [],
      parseErrors: [
        detection.bankId === "unknown"
          ? "Die Bank des Depotauszugs konnte nicht erkannt werden, und die KI-Extraktion ist fehlgeschlagen. Bitte prüfen Sie, ob das PDF lesbaren Text enthält (kein Scan)."
          : `Depotauszug der ${detection.bankName} konnte nicht gelesen werden: ${err.message}`,
      ],
      pageCount,
      reportDate: null,
      accountHolder: null,
      totalValueCHF: null,
      bankId: detection.bankId,
      bankName: detection.bankName,
      parserUsed: "llm",
    };
  }
}
