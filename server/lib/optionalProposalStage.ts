export type OptionalProposalStageResult<T> =
  | { status: 'completed'; value: T }
  | { status: 'timed_out'; stage: string };

/**
 * Liefert für eine weitere optionale Stufe nur noch die verbleibende Zeit des
 * gemeinsamen Budgets. Negative Werte werden bewusst auf null begrenzt, damit
 * nach Ablauf keine weitere Providerkaskade gestartet wird.
 */
export function getRemainingOptionalProposalBudgetMs(
  totalBudgetMs: number,
  elapsedMs: number,
): number {
  return Math.max(0, totalBudgetMs - elapsedMs);
}

/**
 * Begrenzt ausschliesslich optionale Verfeinerungsstufen. Der aufrufende
 * Portfoliojob besitzt bereits ein deterministisches Zwischenergebnis und kann
 * bei Ablauf der Frist deshalb kontrolliert ohne KI-Text weiterarbeiten.
 */
export async function runOptionalProposalStage<T>(
  stage: string,
  promise: Promise<T>,
  timeoutMs: number,
): Promise<OptionalProposalStageResult<T>> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then((value) => ({ status: 'completed' as const, value })),
      new Promise<OptionalProposalStageResult<T>>((resolve) => {
        timeoutHandle = setTimeout(() => resolve({ status: 'timed_out', stage }), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
