/**
 * Validates that TRADINGVIEW_MCP_URL is set and the Railway MCP server is reachable.
 */
import { describe, it, expect } from "vitest";

const MCP_BASE = process.env.TRADINGVIEW_MCP_URL?.replace(/\/$/, "") ?? "";

describe.skipIf(!process.env.TRADINGVIEW_MCP_URL)("TradingView MCP Server", () => {
  it("TRADINGVIEW_MCP_URL env var is set", () => {
    expect(MCP_BASE).not.toBe("");
    expect(MCP_BASE).toMatch(/^https?:\/\//);
  });

  it("MCP server responds to initialize request", async () => {
    const res = await fetch(`${MCP_BASE}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0" },
        },
      }),
    });

    expect(res.status).toBe(200);
    const sessionId = res.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();
  }, 20_000);
});
