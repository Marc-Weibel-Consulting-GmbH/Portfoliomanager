import { describe, expect, it } from "vitest";
import { formatTransactionMessage } from "./whatsapp";

describe("formatTransactionMessage", () => {
  it("erzeugt eine nachvollziehbare Kauf-/Positionsnachricht mit Titel und Gewichtung", () => {
    const message = formatTransactionMessage("add", "NOVN.SW", "Novartis", { newWeight: "5.2" });

    expect(message).toContain("Portfolio BIG Alert");
    expect(message).toContain("Novartis (NOVN.SW) hinzugefügt");
    expect(message).toContain("5.2%");
  });

  it("kennzeichnet eine Positionsreduktion ohne fehlende Textbausteine", () => {
    const message = formatTransactionMessage("update_weight", "MSFT", "Microsoft", {
      oldWeight: "8",
      newWeight: "6",
    });

    expect(message).toContain("Position reduziert");
    expect(message).toContain("8% → 6%");
  });
});
