/**
 * Die Admin-Navigation ordnet eine Gruppe in Zwischenüberschriften, indem sie
 * Pfade auflistet. Das ist bequem zu lesen, hat aber eine stille Falle: Ein
 * Tippfehler im Pfad lässt die Kachel ersatzlos verschwinden — kein Fehler,
 * keine Warnung, sie ist einfach weg.
 *
 * Diese Tests halten fest, dass jede Kachel genau einmal erscheint.
 */

import { describe, it, expect } from "vitest";
import { adminGroups } from "./adminNavigation";

describe("Admin-Navigation", () => {
  const mitUntergruppen = adminGroups.filter((g) => g.untergruppen);

  it("hat mindestens eine Gruppe mit Zwischenüberschriften", () => {
    expect(mitUntergruppen.length).toBeGreaterThan(0);
  });

  it.each(mitUntergruppen.map((g) => [g.title, g] as const))(
    "%s: jede Kachel erscheint in genau einer Untergruppe",
    (_titel, gruppe) => {
      const zugeordnet = gruppe.untergruppen!.flatMap((u) => u.pfade);
      const vorhanden = gruppe.sections.map((s) => s.path);

      // Keine Kachel fällt heraus, keine erscheint doppelt.
      expect([...vorhanden].sort()).toEqual([...zugeordnet].sort());
      expect(new Set(zugeordnet).size).toBe(zugeordnet.length);
    },
  );

  it("verwendet keinen Pfad in zwei Gruppen", () => {
    const alle = adminGroups.flatMap((g) => g.sections.map((s) => s.path));
    expect(new Set(alle).size).toBe(alle.length);
  });
});
