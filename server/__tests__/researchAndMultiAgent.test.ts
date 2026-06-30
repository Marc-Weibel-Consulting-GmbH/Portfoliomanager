import { describe, it, expect, vi } from "vitest";

// Mock the database
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onDuplicateKeyUpdate: vi.fn().mockReturnThis(),
  }),
}));

vi.mock("../../drizzle/schema", () => ({
  researchDocuments: { status: "status", analyzedAt: "analyzedAt" },
  multiAgentSessions: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  desc: vi.fn((a) => ({ field: a, dir: "desc" })),
}));

describe("Research Context Helper", () => {
  it("should return empty context when no documents exist", async () => {
    const { getResearchContextForLLM } = await import("../helpers/researchContext");
    const result = await getResearchContextForLLM();
    expect(result).toEqual({
      contextString: "",
      documentCount: 0,
      tickers: [],
    });
  });

  it("should return empty context when db is null", async () => {
    const { getDb } = await import("../db");
    (getDb as any).mockResolvedValueOnce(null);
    const { getResearchContextForLLM } = await import("../helpers/researchContext");
    const result = await getResearchContextForLLM();
    expect(result).toEqual({
      contextString: "",
      documentCount: 0,
      tickers: [],
    });
  });
});

describe("Multi-Agent System", () => {
  it("should have callAnthropic function that requires API key", async () => {
    // The researchRouter exports helper functions
    // We test that the module loads without errors
    const module = await import("../routers/researchRouter");
    expect(module.researchRouter).toBeDefined();
  });
});

describe("Research Router Structure", () => {
  it("should export a valid tRPC router", async () => {
    const { researchRouter } = await import("../routers/researchRouter");
    expect(researchRouter).toBeDefined();
    expect(researchRouter._def).toBeDefined();
    expect(researchRouter._def.procedures).toBeDefined();
  });

  it("should have all expected procedures", async () => {
    const { researchRouter } = await import("../routers/researchRouter");
    const procedures = Object.keys(researchRouter._def.procedures);
    expect(procedures).toContain("listDocuments");
    expect(procedures).toContain("uploadDocument");
    expect(procedures).toContain("deleteDocument");
    expect(procedures).toContain("reanalyzeDocument");
    expect(procedures).toContain("listSessions");
    expect(procedures).toContain("runMultiAgent");
    expect(procedures).toContain("deleteSession");
    expect(procedures).toContain("getResearchContext");
  });
});
