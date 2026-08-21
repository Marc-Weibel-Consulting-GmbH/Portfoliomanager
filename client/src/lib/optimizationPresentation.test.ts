import { describe, expect, it } from 'vitest';
import {
  getAssetClassTargetsForScope,
  getVisibleDiversificationRules,
  type PresentationRule,
} from './optimizationPresentation';

const profileTargets = {
  targets: { Aktien: 55, Obligationen: 25, Gold: 7, Rohstoffe: 4, Immobilien: 6, Krypto: 3 },
  tolerancePct: 3,
  isDefaultProfile: false,
};

const rules: PresentationRule[] = [
  { id: 'min_titles', passed: true },
  { id: 'max_weight', passed: false },
  { id: 'min_chf', passed: false },
  { id: 'asset_class_Aktien', passed: true },
  { id: 'asset_class_Obligationen', passed: false },
];

describe('Optimization presentation scope', () => {
  it('unterdrückt Profil-Anlageklassenregeln bei einer bewussten Aktienstrategie', () => {
    expect(getAssetClassTargetsForScope(profileTargets, 'stocks_only')).toBeUndefined();
  });

  it('behält Profil-Anlageklassenregeln für eine Multi-Asset-Strategie bei', () => {
    expect(getAssetClassTargetsForScope(profileTargets, 'profile_mix')).toEqual(profileTargets);
  });

  it('zeigt standardmässig nur echten Handlungsbedarf und nicht jede erfüllte Detailregel', () => {
    expect(getVisibleDiversificationRules(rules, false)).toEqual([
      { id: 'max_weight', passed: false },
      { id: 'min_chf', passed: false },
      { id: 'asset_class_Obligationen', passed: false },
    ]);
  });

  it('zeigt im expliziten Detailmodus alle Regeln', () => {
    expect(getVisibleDiversificationRules(rules, true)).toHaveLength(5);
  });
});
