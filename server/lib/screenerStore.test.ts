import { describe, expect, it } from "vitest";
import { waehleAnzeigbarenLauf, type LaufUebersicht } from "./screenerStore";

function lauf(overrides: Partial<LaufUebersicht> = {}): LaufUebersicht {
  return {
    id: 60001,
    gestartetAm: "2026-08-11 14:35:39",
    status: "rechnet",
    universum: 2163,
    fehler: null,
    wartend: 1592,
    berechnet: 331,
    fehlgeschlagen: 25,
    zweitkotierungen: 84,
    vorhanden: 130,
    uebernommen: 0,
    abgelehnt: 1,
    ...overrides,
  };
}

describe("waehleAnzeigbarenLauf", () => {
  it("zeigt nach einem fehlgeschlagenen neuen Lauf weiterhin den letzten Lauf mit berechneten Kandidaten", () => {
    const aktuellerFehler = lauf({
      id: 90002,
      status: "fehler",
      universum: 0,
      berechnet: 0,
      wartend: 527,
      fehler: "Sammeln fehlgeschlagen",
    });
    const letzterGueltiger = lauf();

    expect(waehleAnzeigbarenLauf(aktuellerFehler, letzterGueltiger)).toEqual({
      lauf: letzterGueltiger,
      ausgeblendeterFehlerLauf: aktuellerFehler,
    });
  });

  it("zeigt einen laufenden neuen Lauf unverändert statt auf Historie zurückzufallen", () => {
    const aktuellerLauf = lauf({ id: 90003, berechnet: 12, wartend: 400 });

    expect(waehleAnzeigbarenLauf(aktuellerLauf, lauf())).toEqual({
      lauf: aktuellerLauf,
      ausgeblendeterFehlerLauf: null,
    });
  });
});
