export type BillingPlanId = 'free' | 'premium';

export type BillingFeatureId = 'properties' | 'talhoes' | 'analises';

export interface BillingPlanDefinition {
  id: BillingPlanId;
  label: string;
  description: string;
  base_price_cents: number;
  legacy_plan_ids: string[];
}

export interface BillingFeatureDefinition {
  id: BillingFeatureId;
  label: string;
  unit_label: string;
  included_by_plan: Record<BillingPlanId, number>;
  extra_unit_price_cents: number;
}

export interface CreditMoneyConversionConfig {
  brl_to_credits_ratio: number;
}

export interface MonetizationRulesConfig {
  functional_currency: 'money_brl';
  cosmetic_currency: 'credits';
  allow_money_to_credits: boolean;
  allow_credits_to_money: boolean;
}

export const CREDIT_MONEY_CONVERSION: CreditMoneyConversionConfig = {
  brl_to_credits_ratio: 2,
};

export const MONETIZATION_RULES: MonetizationRulesConfig = {
  functional_currency: 'money_brl',
  cosmetic_currency: 'credits',
  allow_money_to_credits: true,
  allow_credits_to_money: false,
};

export const BILLING_PLANS: Record<BillingPlanId, BillingPlanDefinition> = {
  free: {
    id: 'free',
    label: 'Free',
    description: 'Plano de entrada com limites menores e sem mensalidade.',
    base_price_cents: 0,
    legacy_plan_ids: ['free'],
  },
  premium: {
    id: 'premium',
    label: 'Premium',
    description: 'Plano principal com franquias altas e adicionais sob demanda.',
    base_price_cents: 2990,
    legacy_plan_ids: ['premium', 'pro', 'enterprise'],
  },
};

export const BILLING_FEATURES: BillingFeatureDefinition[] = [
  {
    id: 'properties',
    label: 'Propriedades',
    unit_label: 'propriedade',
    included_by_plan: {
      free: 1,
      premium: 5,
    },
    extra_unit_price_cents: 1000,
  },
  {
    id: 'talhoes',
    label: 'Talhões',
    unit_label: 'talhao',
    included_by_plan: {
      free: 5,
      premium: 50,
    },
    extra_unit_price_cents: 200,
  },
  {
    id: 'analises',
    label: 'Análises de Solo',
    unit_label: 'analise',
    included_by_plan: {
      free: 50,
      premium: 500,
    },
    extra_unit_price_cents: 50,
  },
];

export const BILLING_FREE_FEATURES: string[] = [
  'Culturas',
  'Fornecedores',
  'Cadastros gerais',
  'Jornada gamificada',
];

function parseNumber(input: unknown): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}

export function resolveBillingPlanId(input: unknown): BillingPlanId {
  const raw = String(input ?? '').trim().toLowerCase();
  if (!raw) return 'free';

  const entry = Object.values(BILLING_PLANS).find((plan) =>
    plan.legacy_plan_ids.includes(raw),
  );
  return entry?.id ?? 'free';
}

export function listBillingPlans(): BillingPlanDefinition[] {
  return [BILLING_PLANS.free, BILLING_PLANS.premium];
}

export function listBillingFeatures(): BillingFeatureDefinition[] {
  return [...BILLING_FEATURES];
}

export function convertMoneyCentsToCredits(cents: number): number {
  const normalized = Math.max(0, Math.round(parseNumber(cents)));
  if (normalized <= 0) return 0;
  const reais = normalized / 100;
  return Math.max(
    0,
    Math.round(reais * Math.max(0, CREDIT_MONEY_CONVERSION.brl_to_credits_ratio)),
  );
}

export function convertCreditsToMoneyCents(_credits: number): never {
  throw new Error(
    'Conversão de créditos para dinheiro esta bloqueada por regra de negocio.',
  );
}
