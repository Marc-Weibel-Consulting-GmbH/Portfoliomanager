import { describe, it, expect } from "vitest";

describe("Kimi K3 API Key Validation", () => {
  it("should successfully call api.moonshot.ai with KIMI_API_KEY", async () => {
    const key = process.env.KIMI_API_KEY;
    expect(key, "KIMI_API_KEY must be set").toBeTruthy();

    const response = await fetch("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "kimi-k3",
        messages: [{ role: "user", content: "Reply with the single word: OK" }],
        max_tokens: 20,
      }),
    });

    expect(response.status, `Expected 200 but got ${response.status}`).toBe(200);

    const data = await response.json() as any;
    expect(data.choices).toBeDefined();
    expect(data.choices.length).toBeGreaterThan(0);
    expect(data.model).toBe("kimi-k3");
    console.log("[Kimi Test] Response:", data.choices[0].message.content || data.choices[0].message.reasoning_content);
  }, 30000);
});
