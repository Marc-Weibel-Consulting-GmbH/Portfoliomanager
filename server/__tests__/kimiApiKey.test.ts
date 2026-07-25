import { describe, it, expect } from 'vitest';

describe('Kimi API Key', () => {
  // Wird im CI übersprungen — dort ist das Secret bewusst nicht hinterlegt.
  it.skipIf(!process.env.KIMI_API_KEY)('KIMI_API_KEY environment variable is set', () => {
    const key = process.env.KIMI_API_KEY;
    expect(key).toBeTruthy();
    expect(key!.length).toBeGreaterThan(10);
  });

  it('invokeKimi function is exported from llm.ts', async () => {
    const llmModule = await import('../_core/llm');
    expect(typeof llmModule.invokeKimi).toBe('function');
    expect(typeof llmModule.invokeLLM).toBe('function');
  });
});
