/**
 * Die Admin-Navigation ordnet die Kacheln nach dem Vier-Schichten-Zielbild
 * (design/KONSOLIDIERUNG_RECHENWERKE.md, K8). Die Zuordnung läuft über Pfade —
 * ein Tippfehler liesse eine Kachel stumm verschwinden. Diese Tests halten
 * fest, dass jede Kachel genau einmal erscheint und die Schichten-Ordnung
 * steht.
 */

import { describe, it, expect } from "vitest";
import { adminGroups } from "./adminNavigation";

describe("Admin-Navigation", () => {
  it("verwendet keinen Pfad in zwei Gruppen", () => {
    const alle = adminGroups.flatMap((g) => g.sections.map((s) => s.path));
    expect(new Set(alle).size).toBe(alle.length);
  });

  it("keine Gruppe ist leer", () => {
    for (const g of adminGroups) expect(g.sections.length).toBeGreaterThan(0);
  });

  it("folgt der Schichten-Ordnung: Labor ist ausgewiesen, Rückbau gesammelt", () => {
    const titel = adminGroups.map((g) => g.title);
    expect(titel.some((t) => t.includes("Labor"))).toBe(true);
    expect(titel.some((t) => t.includes("Rückbau"))).toBe(true);
    // Die vier Labor-Werkzeuge stehen in der Labor-Gruppe — nirgendwo sonst.
    const labor = adminGroups.find((g) => g.title.includes("Labor"))!;
    const laborPfade = labor.sections.map((s) => s.path);
    for (const p of ["/admin/signal-performance", "/admin/ml-trainer", "/admin/optimizer", "/admin/algo-backtest"]) {
      expect(laborPfade).toContain(p);
    }
    // Die per K2/K6 wirkungslosen Konfigurations-Seiten stehen unter Rückbau.
    const rueckbau = adminGroups.find((g) => g.title.includes("Rückbau"))!;
    const rueckbauPfade = rueckbau.sections.map((s) => s.path);
    for (const p of ["/admin/alert-config", "/admin/score-config", "/admin/signal-config", "/admin/gap-filling"]) {
      expect(rueckbauPfade).toContain(p);
    }
  });

  it("Untergruppen (falls gesetzt) decken ihre Gruppe exakt ab", () => {
    for (const gruppe of adminGroups.filter((g) => g.untergruppen)) {
      const zugeordnet = gruppe.untergruppen!.flatMap((u) => u.pfade);
      const vorhanden = gruppe.sections.map((s) => s.path);
      expect([...vorhanden].sort()).toEqual([...zugeordnet].sort());
      expect(new Set(zugeordnet).size).toBe(zugeordnet.length);
    }
  });
});
