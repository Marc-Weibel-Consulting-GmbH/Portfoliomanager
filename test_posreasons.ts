import { invokeLLM } from './server/_core/llm';

async function main() {
  const schema = {
    name: 'position_reasons',
    strict: true,
    schema: {
      type: 'object' as const,
      properties: {
        positionReasons: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              ticker: { type: 'string' as const },
              text: { type: 'string' as const }
            },
            required: ['ticker', 'text'],
            additionalProperties: false
          }
        }
      },
      required: ['positionReasons'],
      additionalProperties: false
    }
  };

  const positions = [
    { ticker: 'AAPL', companyName: 'Apple Inc.', sector: 'Technology', weightPct: 8.5, signal: 'BUY', score: 78 },
    { ticker: 'NESN.SW', companyName: 'Nestlé SA', sector: 'Consumer Staples', weightPct: 7.2, signal: 'HOLD', score: 62 }
  ];

  const systemPrompt = `Du bist ein erfahrener Schweizer Anlageberater und Aktienanalyst. Antworte immer auf Deutsch.`;
  const userPrompt = `Formuliere für JEDE dieser Positionen 2-3 Sätze mit konkreten Anlagegründen.\n\nPositionen:\n${JSON.stringify(positions, null, 2)}`;

  console.log("Testing invokeLLM with json_schema response_format...");
  try {
    const res = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1024,
      response_format: { type: 'json_schema', json_schema: schema }
    });

    const content = res.choices?.[0]?.message?.content as string;
    console.log("Raw content:", content?.substring(0, 600));
    try {
      const parsed = JSON.parse(content);
      console.log("positionReasons count:", parsed.positionReasons?.length);
      console.log("First reason:", JSON.stringify(parsed.positionReasons?.[0], null, 2));
    } catch(e: any) {
      console.error("Parse error:", e.message);
    }
  } catch(e: any) {
    console.error("invokeLLM error:", e.message);
  }
}

main();
