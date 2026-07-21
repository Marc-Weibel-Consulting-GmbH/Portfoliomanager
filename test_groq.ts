import { invokeProposalAgent } from './server/lib/proposalModels';

async function main() {
  const tickerReasonItem = { type: 'object', properties: { ticker: { type: 'string' }, reason: { type: 'string' } }, required: ['ticker', 'reason'], additionalProperties: false };
  const adjustmentItem = { type: 'object', properties: { ticker: { type: 'string' }, action: { type: 'string', enum: ['keep', 'reduce', 'increase', 'replace'] }, reason: { type: 'string' }, replacementTicker: { type: 'string' } }, required: ['ticker', 'action', 'reason'], additionalProperties: false };
  const posReasonsSchema = { type: 'array', items: { type: 'object', properties: { ticker: { type: 'string' }, text: { type: 'string' } }, required: ['ticker', 'text'], additionalProperties: false } };

  // Simulate mergeText=true (groq analysis + text combined)
  const analysisProps: Record<string, any> = {
    critique: { type: 'string' },
    rejected: { type: 'array', items: tickerReasonItem },
    alternatives: { type: 'array', items: tickerReasonItem },
    verdict: { type: 'string' },
    adjustments: { type: 'array', items: adjustmentItem },
    overallConfidence: { type: 'string', enum: ['hoch', 'mittel', 'niedrig'] },
    positionReasons: posReasonsSchema,
  };
  const analysisRequired = ['critique', 'rejected', 'alternatives', 'verdict', 'adjustments', 'overallConfidence', 'positionReasons'];
  const schema = { name: 'portfolio_review', strict: true, schema: { type: 'object', properties: analysisProps, required: analysisRequired, additionalProperties: false } };

  const positions = [
    { ticker: 'AAPL', companyName: 'Apple Inc.', sector: 'Technology', weightPct: 8.5, signal: 'BUY', score: 78 },
    { ticker: 'NESN.SW', companyName: 'Nestlé SA', sector: 'Consumer Staples', weightPct: 7.2, signal: 'HOLD', score: 62 }
  ];

  console.log("Testing groq with combined analysis+positionReasons schema...");
  try {
    const { result, providerUsed } = await invokeProposalAgent('groq', {
      system: 'Du bist ein kritischer Portfolio-Analyst und Portfolio-Manager. Antworte immer auf Deutsch.',
      user: `Prüfe diesen Portfolio-Vorschlag kritisch.\n\nPositionen:\n${JSON.stringify(positions, null, 2)}\n\nLiefere critique, rejected, alternatives, verdict, adjustments, overallConfidence und positionReasons (2-3 Sätze je Titel).`,
      schema,
      maxTokens: 2048,
    });
    console.log("providerUsed:", providerUsed);
    console.log("positionReasons:", JSON.stringify(result?.positionReasons, null, 2));
    console.log("positionReasons count:", result?.positionReasons?.length);
    console.log("verdict:", result?.verdict?.substring(0, 100));
  } catch(e: any) {
    console.error("Error:", e.message);
  }
}

main().catch(console.error);
