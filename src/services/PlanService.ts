import { type BillingPlanId, resolveBillingPlanId } from '../modules/billing';
import { type PlanType, type UserProfile } from '../types/auth';

export interface PlanLimits {
  analysisLimit: number;
  pdfImportLimit: number;
  propertiesLimit: number;
  talhoesLimit: number;
  hasMarketplaceAccess: boolean;
  hasGessagem: boolean;
  hasAdubacao: boolean;
}

const PLAN_CONFIG_BY_BILLING_ID: Record<BillingPlanId, PlanLimits> = {
  free: {
    analysisLimit: 50,
    pdfImportLimit: 5,
    propertiesLimit: 1,
    talhoesLimit: 5,
    hasMarketplaceAccess: true,
    hasGessagem: false,
    hasAdubacao: false,
  },
  premium: {
    analysisLimit: 500,
    pdfImportLimit: 50,
    propertiesLimit: 5,
    talhoesLimit: 50,
    hasMarketplaceAccess: true,
    hasGessagem: true,
    hasAdubacao: true,
  },
};

function toBillingPlanId(plan: PlanType | string | undefined | null): BillingPlanId {
  return resolveBillingPlanId(plan ?? 'free');
}

export class PlanService {
  static getLimits(plan: PlanType): PlanLimits {
    const billingPlan = toBillingPlanId(plan);
    return PLAN_CONFIG_BY_BILLING_ID[billingPlan] ?? PLAN_CONFIG_BY_BILLING_ID.free;
  }

  static canImportPdf(profile: UserProfile): boolean {
    const sourcePlan = profile.plan_id ?? profile.subscription?.plan_id ?? 'free';
    const limits = this.getLimits(sourcePlan);
    return (profile.plan_usage?.pdf_imports_count || 0) < limits.pdfImportLimit;
  }

  static hasModuleAccess(
    plan: PlanType,
    module: 'calagem' | 'gessagem' | 'adubacao',
  ): boolean {
    const limits = this.getLimits(plan);
    if (module === 'calagem') return true;
    if (module === 'gessagem') return limits.hasGessagem;
    if (module === 'adubacao') return limits.hasAdubacao;
    return false;
  }
}
