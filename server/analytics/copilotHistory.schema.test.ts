import { describe, expect, it } from "vitest";
import { copilotHistory } from "../../drizzle/schema";

describe("copilotHistory Gewichtsserialisierung", () => {
  it("speichert präzise Prozentwerte aus Empfehlungsvorschlägen ohne Datenbanküberlauf", () => {
    const serializedWeight = "29.23076923076923";
    const currentWeight = copilotHistory.currentWeight as unknown as { length?: number };

    expect(currentWeight.length).toBeGreaterThanOrEqual(serializedWeight.length);
  });
});
