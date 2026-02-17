// src/services/calculations/types.ts
import { ModuleExecution } from '../../types/soil';

/**
 * Contrato base para todo motor de cálculo.
 * Garante que cada recomendação tenha rastreabilidade e transparência.
 */
export interface CalculationResult {
    success: boolean;
    execution: ModuleExecution;
    errors?: string[];
}

export interface BaseCalculationInput {
    analysisId: string;
    normalizedData: Record<string, any>;
    params: Record<string, any>; // Regras do Super Admin (curvas, faixas, etc.)
    rulesetVersion: string;
}
