import { describe, it, expect } from "vitest";
import { describeAnalyticsConfig } from "./analyticsServiceStatus";

describe("describeAnalyticsConfig", () => {
  it("meldet nicht konfiguriert bei leerer/fehlender URL", () => {
    expect(describeAnalyticsConfig(undefined).configured).toBe(false);
    expect(describeAnalyticsConfig("").configured).toBe(false);
    expect(describeAnalyticsConfig("   ").configured).toBe(false);
  });

  it("extrahiert den Host, ohne Pfad/Query preiszugeben", () => {
    const r = describeAnalyticsConfig("https://ml.example.com:8443/predict?token=secret");
    expect(r.configured).toBe(true);
    expect(r.host).toBe("ml.example.com:8443");
    expect(r.hint).not.toContain("secret");
  });

  it("meldet nicht konfiguriert bei ungültiger URL", () => {
    expect(describeAnalyticsConfig("nicht-eine-url").configured).toBe(false);
  });
});
