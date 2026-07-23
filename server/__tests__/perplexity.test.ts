import { describe, it, expect } from "vitest";

describe("Perplexity API Key", () => {
  it("should be set and valid", async () => {
    const key = process.env.PERPLEXITY_API_KEY;
    expect(key, "PERPLEXITY_API_KEY must be set").toBeTruthy();
    expect(key!.startsWith("pplx-"), "Key should start with pplx-").toBe(true);

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: "Reply with the single word: OK" }],
        max_tokens: 16,
      }),
    });

    const data = await res.json() as any;
    expect(res.status, `API returned ${res.status}: ${JSON.stringify(data?.error)}`).toBe(200);
    expect(data.choices?.[0]?.message?.content).toBeTruthy();
  }, 15000);
});
