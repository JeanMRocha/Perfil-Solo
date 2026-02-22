import { describe, expect, it } from 'vitest';
import { PlanService } from '@services/PlanService';
import type { UserProfile } from '@services/../types/auth';

function buildProfile(
  overrides: Partial<UserProfile> = {},
): UserProfile {
  return {
    id: 'user-1',
    email: 'user@perfilsolo.app',
    role: 'farmer',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('PlanService', () => {
  it('retorna limites corretos por plano', () => {
    const free = PlanService.getLimits('free');
    const pro = PlanService.getLimits('pro');
    const enterprise = PlanService.getLimits('enterprise');

    expect(free.analysisLimit).toBe(50);
    expect(pro.analysisLimit).toBe(500);
    expect(enterprise.analysisLimit).toBe(500);
    expect(free.propertiesLimit).toBe(1);
    expect(pro.propertiesLimit).toBe(5);
  });

  it('faz fallback para plano free quando plano e inválido', () => {
    const limits = PlanService.getLimits('legacy' as any);
    expect(limits.analysisLimit).toBe(50);
    expect(limits.pdfImportLimit).toBe(5);
  });

  it('canImportPdf respeita limite de uso do plano', () => {
    const freeAtLimit = buildProfile({
      plan_id: 'free',
      plan_usage: { pdf_imports_count: 5, analysis_count: 0, credits_remaining: 0 },
    });
    const freeBelowLimit = buildProfile({
      plan_id: 'free',
      plan_usage: { pdf_imports_count: 4, analysis_count: 0, credits_remaining: 0 },
    });
    const proAtLimit = buildProfile({
      plan_id: 'pro',
      plan_usage: { pdf_imports_count: 50, analysis_count: 0, credits_remaining: 0 },
    });

    expect(PlanService.canImportPdf(freeAtLimit)).toBe(false);
    expect(PlanService.canImportPdf(freeBelowLimit)).toBe(true);
    expect(PlanService.canImportPdf(proAtLimit)).toBe(false);
  });

  it('canImportPdf usa plano da subscription quando plan_id principal não existe', () => {
    const profile = buildProfile({
      subscription: {
        plan_id: 'pro',
        status: 'active',
        current_period_end: new Date().toISOString(),
        cancel_at_period_end: false,
      },
      plan_usage: { pdf_imports_count: 49, analysis_count: 0, credits_remaining: 0 },
    });

    expect(PlanService.canImportPdf(profile)).toBe(true);
  });

  it('hasModuleAccess respeita regras de gating por plano', () => {
    expect(PlanService.hasModuleAccess('free', 'calagem')).toBe(true);
    expect(PlanService.hasModuleAccess('free', 'gessagem')).toBe(false);
    expect(PlanService.hasModuleAccess('free', 'adubacao')).toBe(false);
    expect(PlanService.hasModuleAccess('pro', 'gessagem')).toBe(true);
    expect(PlanService.hasModuleAccess('enterprise', 'adubacao')).toBe(true);
  });
});
