import { describe, expect, it } from "vitest";
import { toEodhdSymbol } from "./eodhdSymbol";

describe("toEodhdSymbol", () => {
  it("maps the internal XETRA suffix to the EODHD fundamentals exchange", () => {
    expect(toEodhdSymbol("1U1.DE")).toBe("1U1.XETRA");
  });

  it("maps the internal London suffix to the EODHD fundamentals exchange", () => {
    expect(toEodhdSymbol("BP-A.L")).toBe("BP-A.LSE");
  });

  it("keeps unrelated internal and explicit EODHD symbols stable", () => {
    expect(toEodhdSymbol("NOVN.SW")).toBe("NOVN.SW");
    expect(toEodhdSymbol("1U1.XETRA")).toBe("1U1.XETRA");
  });
});
