export type PersistedProposalAssetType = 'stock' | 'bond' | 'etf';

/**
 * Preserves the instrument type from the proposal. `assetClass: bond` identifies
 * the allocation bucket, but does not turn a bond ETF into an individual bond
 * whose price is quoted as a percentage of nominal value.
 */
export function getProposalPositionAssetType(input: {
  assetType?: string | null;
  assetClass?: string | null;
}): PersistedProposalAssetType {
  if (input.assetType === 'bond') return 'bond';
  if (input.assetType === 'etf') return 'etf';
  if (input.assetClass && input.assetClass !== 'equity') return 'etf';
  return 'stock';
}
