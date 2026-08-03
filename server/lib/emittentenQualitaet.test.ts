/**
 * Bonitätsnäherung für Obligationen über den Emittenten.
 *
 * Die Namen stammen aus der Produktionsdatenbank (03.08.2026) — dieselben, an
 * denen die Anlageklassen-Erkennung geprüft wird. Sie sind unregelmässig
 * geschrieben, teilweise abgeschnitten und enthalten Finanzierungstöchter
 * statt der Mutter. Genau daran muss die Zuordnung sich bewähren.
 */

import { describe, it, expect } from "vitest";
import { emittentAusWertschrift, findeEmittent, type AktieFuerZuordnung } from "./emittentenQualitaet";

describe("emittentAusWertschrift", () => {
  it.each([
    ["0.35% NTS Lonza Swiss Finanz AGGuaranteed", "lonza swiss finanz"],
    ["3/8% EMTN Holcim Helvetia Finance AGGuarante", "holcim helvetia finance"],
    ["5/8% NTS Axpo Holding AG", "axpo"],
    ["0.1525% NTS Cembra Money Bank AG Reg S", "cembra money bank"],
    ["1.5% NTS Helvetia Schw Vers AG 2020-", "helvetia schw vers"],
  ])("%s → %s", (name, erwartet) => {
    expect(emittentAusWertschrift(name)).toBe(erwartet);
  });

  it("gibt leer zurück, wenn nichts Verwertbares übrig bleibt", () => {
    expect(emittentAusWertschrift("")).toBe("");
    expect(emittentAusWertschrift(null)).toBe("");
    expect(emittentAusWertschrift("0.5% NTS")).toBe("");
  });
});

describe("findeEmittent", () => {
  const universum: AktieFuerZuordnung[] = [
    { ticker: "LONN.SW", name: "Lonza Group AG", qualitaet: 78 },
    { ticker: "HOLN.SW", name: "Holcim Ltd", qualitaet: 64 },
    { ticker: "HELN.SW", name: "Helvetia Holding AG", qualitaet: 59 },
    { ticker: "CMBN.SW", name: "Cembra Money Bank AG", qualitaet: 55 },
    { ticker: "ABBN.SW", name: "ABB Ltd", qualitaet: 70 },
  ];

  it("findet die Mutter hinter einer Finanzierungstochter", () => {
    const t = findeEmittent("0.35% NTS Lonza Swiss Finanz AGGuaranteed", universum);
    expect(t?.ticker).toBe("LONN.SW");
    expect(t?.qualitaet).toBe(78);
  });

  it("ordnet die Holcim-Anleihe NICHT Helvetia zu", () => {
    // «Holcim Helvetia Finance» enthält beide Namen. Ohne die Bedingung, dass
    // der Aktienname am Anfang stehen muss, wäre das ein Fehlgriff mit
    // vollkommen falscher Bonität.
    const t = findeEmittent("3/8% EMTN Holcim Helvetia Finance AGGuarante", universum);
    expect(t?.ticker).toBe("HOLN.SW");
  });

  it("findet den Emittenten auch bei exakter Namensgleichheit", () => {
    const t = findeEmittent("0.1525% NTS Cembra Money Bank AG Reg S", universum);
    expect(t?.ticker).toBe("CMBN.SW");
  });

  it("ordnet nichts zu, wenn der Emittent nicht im Universum ist", () => {
    // Axpo ist nicht börsenkotiert. Lieber keine Bonität als eine geratene.
    expect(findeEmittent("5/8% NTS Axpo Holding AG", universum)).toBeNull();
    expect(findeEmittent("1/4% NTS Pfandbriefzentr der CHKantonalbanken", universum)).toBeNull();
  });

  it("überspringt Aktien ohne eigenen Qualitäts-Score", () => {
    const ohneScore: AktieFuerZuordnung[] = [{ ticker: "LONN.SW", name: "Lonza Group AG", qualitaet: null }];
    expect(findeEmittent("0.35% NTS Lonza Swiss Finanz AG", ohneScore)).toBeNull();
  });

  it("ordnet bei Mehrdeutigkeit nichts zu", () => {
    const doppelt: AktieFuerZuordnung[] = [
      { ticker: "A.SW", name: "Helvetia AG", qualitaet: 60 },
      { ticker: "B.SW", name: "Helvetia Group", qualitaet: 40 },
    ];
    expect(findeEmittent("1.5% NTS Helvetia Schw Vers AG", doppelt)).toBeNull();
  });

  it("bevorzugt die spezifischere Übereinstimmung", () => {
    const gemischt: AktieFuerZuordnung[] = [
      { ticker: "KURZ.SW", name: "Cembra AG", qualitaet: 30 },
      { ticker: "LANG.SW", name: "Cembra Money Bank AG", qualitaet: 55 },
    ];
    expect(findeEmittent("0.1525% NTS Cembra Money Bank AG Reg S", gemischt)?.ticker).toBe("LANG.SW");
  });
});

describe("Bonität im Anleihen-Score", () => {
  const anleihe = {
    peRatio: 0, pegRatio: 0, dividendYield: 0,
    volatility: 4, ytdPerformance: 1,
  };

  it("nimmt die Emittentenqualität als eigenen Faktor auf", async () => {
    const { calculateStockScore } = await import("../scoring");
    const r = calculateStockScore(
      "CH0564642061", { ...anleihe, emittentenQualitaet: 78 },
      undefined, "Wachstumsaktien", "0.35% NTS Lonza Swiss Finanz AGGuaranteed",
    );
    const bonitaet = r.subScores.find((s) => s.metric === "Bonität (Emittent)");
    expect(bonitaet).toBeDefined();
    expect(bonitaet!.value).toBe(78);
    expect(bonitaet!.weight).toBeCloseTo(0.30, 6);
    // Der Kupon bleibt der grösste Faktor.
    expect(r.subScores.find((s) => s.metric === "Rendite (Coupon)")!.weight).toBeCloseTo(0.40, 6);
  });

  it("lässt die bisherigen Gewichte unangetastet, wenn der Emittent unbekannt ist", async () => {
    const { calculateStockScore } = await import("../scoring");
    const r = calculateStockScore(
      "CH1160188343", { ...anleihe, emittentenQualitaet: null },
      undefined, "Wachstumsaktien", "5/8% NTS Axpo Holding AG",
    );
    expect(r.subScores.find((s) => s.metric === "Bonität (Emittent)")).toBeUndefined();
    expect(r.subScores.find((s) => s.metric === "Rendite (Coupon)")!.weight).toBeCloseTo(0.50, 6);
    // Und der Titel bleibt beurteilbar — der neue Faktor darf die Abdeckung
    // nicht dauerhaft verwässern.
    expect(r.totalScore).not.toBeNull();
  });

  it("ein schwacher Emittent senkt die Note gegenüber einem starken", async () => {
    const { calculateStockScore } = await import("../scoring");
    const stark = calculateStockScore("A", { ...anleihe, dividendYield: 2, emittentenQualitaet: 85 },
      undefined, "Obligationen", "2% NTS Gut AG");
    const schwach = calculateStockScore("B", { ...anleihe, dividendYield: 2, emittentenQualitaet: 30 },
      undefined, "Obligationen", "2% NTS Schwach AG");
    expect(stark.totalScore!).toBeGreaterThan(schwach.totalScore!);
  });
});
