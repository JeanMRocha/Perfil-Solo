// src/services/PlanService.ts
import { PlanType, UserProfile } from '../types/auth';

export interface PlanLimits {
    analysisLimit: number;
    pdfImportLimit: number;
    hasMarketplaceAccess: boolean;
    hasGessagem: boolean;
    hasAdubacao: boolean;
}

const PLAN_CONFIG: Record<PlanType, PlanLimits> = {
    free: {
        analysisLimit: 5,
        pdfImportLimit: 2,
        hasMarketplaceAccess: true,
        hasGessagem: false,
        hasAdubacao: false,
    },
    pro: {
        analysisLimit: 50,
        pdfImportLimit: 20,
        hasMarketplaceAccess: true,
        hasGessagem: true,
        hasAdubacao: true,
    },
    enterprise: {
        analysisLimit: Infinity,
        pdfImportLimit: Infinity,
        hasMarketplaceAccess: true,
        hasGessagem: true,
        hasAdubacao: true,
    }
};

/**
 * PlanService
 * Responsável por verificar se um usuário tem permissão para realizar uma ação
 * baseada em seu plano e uso atual.
 */
export class PlanService {

    static getLimits(plan: PlanType): PlanLimits {
        return PLAN_CONFIG[plan] || PLAN_CONFIG.free;
    }

    static canImportPdf(profile: UserProfile): boolean {
        const limits = this.getLimits(profile.plan_id as any || profile.subscription?.plan_id);
        return (profile.plan_usage?.pdf_imports_count || 0) < limits.pdfImportLimit;
    }

    static hasModuleAccess(plan: PlanType, module: 'calagem' | 'gessagem' | 'adubacao'): boolean {
        const limits = this.getLimits(plan);
        if (module === 'calagem') return true; // Calagem sempre livre
        if (module === 'gessagem') return limits.hasGessagem;
        if (module === 'adubacao') return limits.hasAdubacao;
        return false;
    }
}
