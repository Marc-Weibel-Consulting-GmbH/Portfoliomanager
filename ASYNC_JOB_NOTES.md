# Async Job Pattern for buildProposal

## Problem
HTTP 524 timeout: `autoPortfolio.buildProposal` takes 60-120s due to:
1. `getFundamentalsFactsBatch` (5 US tickers × 8s = up to 40s)
2. `solveExactWeights` exactOptimizer (15s timeout)
3. Kimi K3 Challenger call (20-40s, max_tokens=16384)
4. Kimi K3 Synthesizer call (20-40s, max_tokens=16384)
Total: 60-120s >> 30s proxy timeout

## Solution: In-memory async job with polling

### Server: autoPortfolioRouter.ts changes
1. Add module-level state:
   ```ts
   type ProposalJob = {
     status: 'running' | 'done' | 'error';
     progress: string[];
     result: any | null;
     error: string | null;
     userId: number;
     startedAt: number;
   };
   const proposalJobs = new Map<string, ProposalJob>();
   ```

2. New `startProposal` mutation:
   - Returns immediately with `{ jobId: string }`
   - Launches background IIFE with progress messages
   - Stores result in `proposalJobs` map

3. New `getProposalStatus` query:
   - Input: `{ jobId: string }`
   - Returns: `{ status, progress, result, error }`
   - Guards: only owner can access their job

4. Keep `buildProposal` as legacy (or deprecate)

### Progress messages (for frontend progress bar):
- "Anlageprofil geladen..."
- "Kandidaten-Universum analysiert (N Titel)..."
- "Scoring und Ranking..."
- "Portfolio-Optimierung läuft..."
- "Positionen aufgebaut..."
- "KI-Analyse: Challenger prüft Vorschlag..."
- "KI-Analyse: Synthesizer erstellt Empfehlung..."
- "✅ Vorschlag fertig!"

### Frontend: PortfolioBuilderWizard.tsx changes
1. Add `proposalJobId` state
2. Add `pollingEnabled` state
3. Replace `buildProposal.useMutation` with `startProposal.useMutation`
4. Add `getProposalStatus.useQuery` with `refetchInterval: pollingEnabled ? 3000 : false`
5. `useEffect` to stop polling when `status.status === 'done'` and call `setAutoProposal(status.result)`
6. Replace loading button text with progress bar + current step label

### Key return payload (must be preserved in job result):
- positions, methodLabel, weighting, metrics, allocation, notes
- profile, stats, proposalLogId, finalAdjustments, synthesizerVerdict
- overallConfidence, adjustedPositions, marktHubBadge

## Optimization also needed in llm.ts:
- Add AbortController with 45s timeout to invokeKimi
- Reduce max_tokens from 16384 to 4096 for Challenger/Synthesizer (JSON output, short)

## Optimization in exactOptimizer.ts:
- Reduce EXACT_TIMEOUT_MS from 15000 to 8000 (if service is not configured, returns null immediately)

## Optimization in financialDatasets.ts:
- Reduce maxTickers from 5 to 3 in getFundamentalsFactsBatch call in buildProposal
- Reduce timeoutMs from 8000 to 5000
