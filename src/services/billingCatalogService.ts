import {
  BILLING_FEATURES,
  BILLING_FREE_FEATURES,
  BILLING_PLANS,
  type BillingFeatureDefinition,
  type BillingFeatureId,
  type BillingPlanId,
} from '../modules/billing';
import { storageReadJson, storageWriteJson } from './safeLocalStorage';

const BILLING_CATALOG_KEY = 'perfilsolo_billing_catalog_v1';
export const BILLING_CATALOG_UPDATED_EVENT = 'perfilsolo-billing-catalog-updated';

export interface BillingCatalogPlanConfig {
  base_price_cents: number;
}

export interface BillingCatalogFeatureConfig {
  included_by_plan: Record<BillingPlanId, number>;
  extra_unit_price_cents: number;
}

export interface BillingCatalogConfig {
  plans: Record<BillingPlanId, BillingCatalogPlanConfig>;
  features: Record<BillingFeatureId, BillingCatalogFeatureConfig>;
  free_features: string[];
  updated_at: string;
  updated_by?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseNumber(input: unknown): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}

function normalizeMoneyCents(input: unknown): number {
  return Math.max(0, Math.round(parseNumber(input)));
}

function normalizeUnits(input: unknown): number {
  return Math.max(0, Math.round(parseNumber(input)));
}

function defaultCatalog(): BillingCatalogConfig {
  return {
    plans: {
      free: {
        base_price_cents: BILLING_PLANS.free.base_price_cents,
      },
      premium: {
        base_price_cents: BILLING_PLANS.premium.base_price_cents,
      },
    },
    features: BILLING_FEATURES.reduce<
      Record<BillingFeatureId, BillingCatalogFeatureConfig>
    >((acc, row) => {
      acc[row.id] = {
        included_by_plan: {
          free: row.included_by_plan.free,
          premium: row.included_by_plan.premium,
        },
        extra_unit_price_cents: row.extra_unit_price_cents,
      };
      return acc;
    }, {} as Record<BillingFeatureId, BillingCatalogFeatureConfig>),
    free_features: [...BILLING_FREE_FEATURES],
    updated_at: nowIso(),
  };
}

function normalizeCatalog(input?: Partial<BillingCatalogConfig>): BillingCatalogConfig {
  const base = defaultCatalog();
  return {
    plans: {
      free: {
        base_price_cents: normalizeMoneyCents(
          input?.plans?.free?.base_price_cents ?? base.plans.free.base_price_cents,
        ),
      },
      premium: {
        base_price_cents: normalizeMoneyCents(
          input?.plans?.premium?.base_price_cents ?? base.plans.premium.base_price_cents,
        ),
      },
    },
    features: {
      properties: {
        included_by_plan: {
          free: normalizeUnits(
            input?.features?.properties?.included_by_plan?.free ??
              base.features.properties.included_by_plan.free,
          ),
          premium: normalizeUnits(
            input?.features?.properties?.included_by_plan?.premium ??
              base.features.properties.included_by_plan.premium,
          ),
        },
        extra_unit_price_cents: normalizeMoneyCents(
          input?.features?.properties?.extra_unit_price_cents ??
            base.features.properties.extra_unit_price_cents,
        ),
      },
      talhoes: {
        included_by_plan: {
          free: normalizeUnits(
            input?.features?.talhoes?.included_by_plan?.free ??
              base.features.talhoes.included_by_plan.free,
          ),
          premium: normalizeUnits(
            input?.features?.talhoes?.included_by_plan?.premium ??
              base.features.talhoes.included_by_plan.premium,
          ),
        },
        extra_unit_price_cents: normalizeMoneyCents(
          input?.features?.talhoes?.extra_unit_price_cents ??
            base.features.talhoes.extra_unit_price_cents,
        ),
      },
      analises: {
        included_by_plan: {
          free: normalizeUnits(
            input?.features?.analises?.included_by_plan?.free ??
              base.features.analises.included_by_plan.free,
          ),
          premium: normalizeUnits(
            input?.features?.analises?.included_by_plan?.premium ??
              base.features.analises.included_by_plan.premium,
          ),
        },
        extra_unit_price_cents: normalizeMoneyCents(
          input?.features?.analises?.extra_unit_price_cents ??
            base.features.analises.extra_unit_price_cents,
        ),
      },
    },
    free_features:
      Array.isArray(input?.free_features) && input?.free_features.length > 0
        ? input.free_features
            .map((row) => String(row ?? '').trim())
            .filter(Boolean)
        : [...base.free_features],
    updated_at: String(input?.updated_at ?? nowIso()),
    updated_by: input?.updated_by ? String(input.updated_by) : undefined,
  };
}

function dispatchCatalogUpdated(config: BillingCatalogConfig): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<BillingCatalogConfig>(BILLING_CATALOG_UPDATED_EVENT, {
      detail: config,
    }),
  );
}

function writeCatalog(config: BillingCatalogConfig): BillingCatalogConfig {
  const saved = storageWriteJson(BILLING_CATALOG_KEY, config);
  if (!saved) {
    throw new Error('Falha ao persistir configuracao de monetizacao.');
  }
  dispatchCatalogUpdated(config);
  return config;
}

export function getBillingCatalogConfig(): BillingCatalogConfig {
  const parsed = storageReadJson<Partial<BillingCatalogConfig>>(BILLING_CATALOG_KEY, {});
  return normalizeCatalog(parsed);
}

export function updateBillingCatalogConfig(
  input: Partial<BillingCatalogConfig>,
  updatedBy?: string,
): BillingCatalogConfig {
  const current = getBillingCatalogConfig();
  const next = normalizeCatalog({
    ...current,
    ...input,
    plans: {
      ...current.plans,
      ...(input.plans ?? {}),
    },
    features: {
      ...current.features,
      ...(input.features ?? {}),
    },
    updated_at: nowIso(),
    updated_by: updatedBy || input.updated_by,
  });
  return writeCatalog(next);
}

export function resetBillingCatalogConfig(updatedBy?: string): BillingCatalogConfig {
  const next = normalizeCatalog({
    ...defaultCatalog(),
    updated_at: nowIso(),
    updated_by: updatedBy,
  });
  return writeCatalog(next);
}

export function getBillingPlansWithCatalog() {
  const config = getBillingCatalogConfig();
  return [
    {
      ...BILLING_PLANS.free,
      base_price_cents: config.plans.free.base_price_cents,
    },
    {
      ...BILLING_PLANS.premium,
      base_price_cents: config.plans.premium.base_price_cents,
    },
  ];
}

export function getBillingFeaturesWithCatalog(): BillingFeatureDefinition[] {
  const config = getBillingCatalogConfig();
  return BILLING_FEATURES.map((row) => ({
    ...row,
    included_by_plan: {
      free: config.features[row.id].included_by_plan.free,
      premium: config.features[row.id].included_by_plan.premium,
    },
    extra_unit_price_cents: config.features[row.id].extra_unit_price_cents,
  }));
}

export function getBillingFreeFeaturesFromCatalog(): string[] {
  return [...getBillingCatalogConfig().free_features];
}

export function subscribeBillingCatalog(
  listener: (config: BillingCatalogConfig) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const onUpdated = (event: Event) => {
    const custom = event as CustomEvent<BillingCatalogConfig>;
    if (custom.detail) {
      listener(custom.detail);
      return;
    }
    listener(getBillingCatalogConfig());
  };

  const onStorage = (event: Event) => {
    const storageEvent = event as StorageEvent;
    if (storageEvent.key && storageEvent.key !== BILLING_CATALOG_KEY) return;
    listener(getBillingCatalogConfig());
  };

  window.addEventListener(BILLING_CATALOG_UPDATED_EVENT, onUpdated);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(BILLING_CATALOG_UPDATED_EVENT, onUpdated);
    window.removeEventListener('storage', onStorage);
  };
}
