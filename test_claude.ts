import { invokeProposalAgent } from './server/lib/proposalModels';

async function main() {
  const posReasonsSchema = { type: 'array', items: { type: 'object', properties: { ticker: { type: 'string' }, text: { type: 'string' } }, required: ['ticker', 'text'], additionalProperties: false } };
  const schema = { name: 'position_reasons', strict: true, schema: { type: 'object', properties: { positionReasons: posReasonsSchema }, required: ['positionReasons'], additionalProperties: false } };

  const positions = [
    { ticker: 'AAPL', companyName: 'Apple Inc.', sector: 'Technology', weightPct: 8.5, signal: 'BUY', score: 78 },
    { ticker: 'NESN.SW', companyName: 'Nestlé SA', sector: 'Consumer Staples', weightPct: 7.2, signal: 'HOLD', score: 62 }
  ];

  console.log("Testing claude with positionReasons schema...");
  try {
    const { result, providerUsed } = await invokeProposalAgent('claude', {
      system: 'Du bist ein erfahrener Schweizer Anlageberater. Antworte immer auf Deutsch.',
      user: `Formuliere für JEDE dieser Positionen 2-3 Sätze mit konkreten Anlagegründen.\n\nPositionen:\n${JSON.stringify(positions, null, 2)}`,
      schema,
      maxTokens: 1024,
    });
    console.log("providerUsed:", providerUsed);
    console.log("result:", JSON.stringify(result, null, 2));
    console.log("positionReasons count:", result?.positionReasons?.length);
  } catch(e: any) {
    console.error("Error:", e.message);
  }
}

main().catch(console.error);
