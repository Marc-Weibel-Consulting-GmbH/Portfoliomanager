/**
 * Optimierungsengine-Kennzahlen wie Volatilität werden als Dezimalbrüche
 * zurückgegeben (z. B. 0.1636). Die vollständige Vorschau zeigt sie in Prozent.
 */
export function formatFullReoptimizationFraction(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
