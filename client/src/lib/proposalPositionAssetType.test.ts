import { describe, expect, it } from 'vitest';
import { getProposalPositionAssetType } from './proposalPositionAssetType';

describe('getProposalPositionAssetType', () => {
  it('keeps a bond sleeve ETF as an ETF rather than treating it as a nominal-value bond', () => {
    expect(getProposalPositionAssetType({ assetType: 'etf', assetClass: 'bond' })).toBe('etf');
  });

  it('keeps an explicitly modelled individual bond in the nominal-value bond path', () => {
    expect(getProposalPositionAssetType({ assetType: 'bond', assetClass: 'bond' })).toBe('bond');
  });

  it('uses ETF handling for the other non-equity sleeve asset classes', () => {
    expect(getProposalPositionAssetType({ assetClass: 'gold' })).toBe('etf');
  });
});
