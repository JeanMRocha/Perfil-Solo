import { describe, expect, it } from 'vitest';
import {
  MONETIZATION_RULES,
  convertCreditsToMoneyCents,
  convertMoneyCentsToCredits,
  resolveBillingPlanId,
} from '../modules/billing';
import {
  calculateBillingQuote,
  type BillingUsageSnapshot,
} from '../services/billingPlanService';

function usage(overrides?: Partial<BillingUsageSnapshot>): BillingUsageSnapshot {
  return {
    properties: 0,
    talhoes: 0,
    analises: 0,
    captured_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('billing plan module', () => {
  it('resolveBillingPlanId mapeia planos legados para premium', () => {
    expect(resolveBillingPlanId('free')).toBe('free');
    expect(resolveBillingPlanId('premium')).toBe('premium');
    expect(resolveBillingPlanId('pro')).toBe('premium');
    expect(resolveBillingPlanId('enterprise')).toBe('premium');
    expect(resolveBillingPlanId('unknown')).toBe('free');
  });

  it('converte dinheiro para créditos na proporcao 1 para 2', () => {
    expect(convertMoneyCentsToCredits(100)).toBe(2);
    expect(convertMoneyCentsToCredits(2990)).toBe(60);
    expect(convertMoneyCentsToCredits(0)).toBe(0);
  });

  it('bloqueia conversão de créditos para dinheiro', () => {
    expect(MONETIZATION_RULES.allow_money_to_credits).toBe(true);
    expect(MONETIZATION_RULES.allow_credits_to_money).toBe(false);
    expect(() => convertCreditsToMoneyCents(100)).toThrow(
      'Conversão de créditos para dinheiro esta bloqueada por regra de negocio.',
    );
  });

  it('calcula excedentes corretamente no plano free', () => {
    const quote = calculateBillingQuote(
      'free',
      usage({ properties: 3, talhoes: 8, analises: 70 }),
    );

    expect(quote.base_price_cents).toBe(0);
    expect(quote.total_extra_cents).toBe(3600);
    expect(quote.total_monthly_cents).toBe(3600);
  });

  it('calcula mensalidade premium com e sem excedente', () => {
    const withinLimits = calculateBillingQuote(
      'premium',
      usage({ properties: 5, talhoes: 50, analises: 500 }),
    );
    expect(withinLimits.total_extra_cents).toBe(0);
    expect(withinLimits.total_monthly_cents).toBe(2990);

    const aboveLimits = calculateBillingQuote(
      'premium',
      usage({ properties: 6, talhoes: 55, analises: 520 }),
    );
    expect(aboveLimits.total_extra_cents).toBe(3000);
    expect(aboveLimits.total_monthly_cents).toBe(5990);
  });
});
