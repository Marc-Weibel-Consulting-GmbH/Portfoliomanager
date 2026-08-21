import { describe, expect, it } from "vitest";
import { screenerDatenqualitaet, screenerDatenqualitaetHinweis } from "./screenerDatenqualitaet";

describe("Screener-Datenqualitätsstatus", () => {
  it("zeigt eine vollständig belegte Kandidatenidentität als geprüft", () => {
    expect(screenerDatenqualitaet({
      isin: "CH0012005267", primaerTicker: "NOVN.SW", kgvTrailing: 25,
      kgvSelbst: 24.8, kgvSelbstHinweis: null,
      dividendenValidierung: "nicht_noetig", dividendenPruefgrund: null,
    })).toEqual({ status: "geprueft", gruende: [] });
  });

  it("priorisiert eine Fundamentaldatenlücke vor allen sonstigen Prüfhinweisen", () => {
    const status = screenerDatenqualitaet({
      isin: null, primaerTicker: null, kgvTrailing: null, kgvSelbst: null,
      kgvSelbstHinweis: null, dividendenValidierung: "zu_pruefen",
      dividendenPruefgrund: "Rendite weicht von der Gegenprobe ab",
    });

    expect(status.status).toBe("luecke");
    expect(status.gruende).toHaveLength(3);
  });

  it("markiert KGV-Konflikte und Dividendenkonflikte als prüfbar statt als Datenlücke", () => {
    const status = screenerDatenqualitaet({
      isin: "FR0000120271", primaerTicker: "TITEL.PA", kgvTrailing: 11,
      kgvSelbst: 23, kgvSelbstHinweis: "Eigenes KGV und Vendor-KGV widersprechen sich (über Faktor 1.5)",
      dividendenValidierung: "zu_pruefen", dividendenPruefgrund: "Quelle widersprochen",
    });

    expect(status.status).toBe("pruefen");
    expect(status.gruende).toHaveLength(2);
  });

  it("macht eine geprüfte Screenerbasis neben unabhängigen Kurslücken sichtbar", () => {
    expect(screenerDatenqualitaetHinweis("geprueft", null)).toEqual([
      "Screener: ISIN/Primärticker und Bewertungsbasis geprüft",
    ]);
  });
});
