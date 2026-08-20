import { describe, it, expect } from "vitest";
import { titelDatenstatus, KURS_MINDESTTAGE } from "./titelDatenstatus";

const heute = new Date("2026-08-20T12:00:00Z");
const frisch = {
  kursTage: 400,
  letzterKursTag: "2026-08-19",
  letzteKennzahlen: new Date("2026-08-19T07:00:00Z"),
  hatQualitaet: true,
  hatTiming: true,
  heute,
};

describe("titelDatenstatus", () => {
  it("vollständig: genug Historie, frisch, beide Scores da", () => {
    expect(titelDatenstatus(frisch)).toEqual({ status: "vollstaendig", gruende: [] });
  });

  it("lückenhaft: ohne Kursreihe — mit Grund", () => {
    const r = titelDatenstatus({ ...frisch, kursTage: 0, letzterKursTag: null });
    expect(r.status).toBe("lueckenhaft");
    expect(r.gruende).toContain("keine Kursreihe");
  });

  it("lückenhaft: zu kurze Historie nennt die Mindestlänge", () => {
    const r = titelDatenstatus({ ...frisch, kursTage: 120 });
    expect(r.status).toBe("lueckenhaft");
    expect(r.gruende.join(" ")).toContain(`~${KURS_MINDESTTAGE}`);
  });

  it("lückenhaft: fehlende Scores werden einzeln benannt", () => {
    const r = titelDatenstatus({ ...frisch, hatQualitaet: false, hatTiming: false });
    expect(r.status).toBe("lueckenhaft");
    expect(r.gruende).toContain("kein Qualitäts-Score berechnet");
    expect(r.gruende).toContain("kein Timing-Score berechnet");
  });

  it("veraltet: alter Kurs bei sonst vollständiger Basis", () => {
    const r = titelDatenstatus({ ...frisch, letzterKursTag: "2026-07-20" });
    expect(r.status).toBe("veraltet");
    expect(r.gruende.join(" ")).toContain("letzter Kurs vor");
  });

  it("veraltet: alte Kennzahlen", () => {
    const r = titelDatenstatus({ ...frisch, letzteKennzahlen: "2026-06-01" });
    expect(r.status).toBe("veraltet");
    expect(r.gruende.join(" ")).toContain("Kennzahlen vor");
  });

  it("Lücke schlägt veraltet — Status lückenhaft, beide Gründe sichtbar", () => {
    const r = titelDatenstatus({ ...frisch, hatTiming: false, letzterKursTag: "2026-07-01" });
    expect(r.status).toBe("lueckenhaft");
    expect(r.gruende.join(" ")).toContain("Timing");
    expect(r.gruende.join(" ")).toContain("letzter Kurs vor");
  });

  it("Kennzahlen nie aktualisiert = Lücke, nicht Frische", () => {
    const r = titelDatenstatus({ ...frisch, letzteKennzahlen: null });
    expect(r.status).toBe("lueckenhaft");
    expect(r.gruende).toContain("Kennzahlen nie aktualisiert");
  });
});
