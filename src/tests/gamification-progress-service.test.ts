import { describe, expect, it } from 'vitest';
import {
  buildGamificationAreaProgress,
  listGamificationLevelBenefits,
  resolveCurrentLevelBenefit,
} from '@services/gamificationProgressService';

describe('gamification progress service', () => {
  it('resolve o badge Rei das Terras ao passar de 10 propriedades', () => {
    const rows = buildGamificationAreaProgress({
      properties: 11,
      talhoes: 0,
      analises: 0,
    });
    const properties = rows.find((row) => row.area === 'properties');
    expect(properties?.current_tier?.title).toBe('Rei das Terras');
  });

  it('resolve badge Guardiao da Fertilidade em 50 análises', () => {
    const rows = buildGamificationAreaProgress({
      properties: 0,
      talhoes: 0,
      analises: 50,
    });
    const analyses = rows.find((row) => row.area === 'analises');
    expect(analyses?.current_tier?.title).toBe('Guardiao da Fertilidade');
    expect(analyses?.next_tier).toBeNull();
  });

  it('retorna beneficio de nivel mais próximo abaixo ou igual ao nivel atual', () => {
    const benefits = listGamificationLevelBenefits();
    expect(benefits.length).toBeGreaterThan(0);

    const benefit = resolveCurrentLevelBenefit(6);
    expect(benefit.level).toBe(5);
    expect(benefit.title).toBe('Gestor em Evolucao');
  });
});
