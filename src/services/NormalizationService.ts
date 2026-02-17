// src/services/NormalizationService.ts
import { NutrientKey, SoilNutrient, UnitType, AnalysisContainer, AnalysisAlert } from '../types/soil';

/**
 * NormalizationService
 * Responsável por garantir que os cálculos do motor sempre recebam unidades padronizadas.
 * Padrão do motor:
 * - Cátions (Ca, Mg, K, Al, H+Al, SB, CTC): cmolc/dm³
 * - Fósforo (P): mg/dm³
 * - Matéria Orgânica (MO): % ou g/dm³ (conforme definido no manual)
 */
export class NormalizationService {

    /**
     * Converte um nutriente para a unidade padrão do sistema.
     */
    static normalizeNutrient(key: NutrientKey, nutrient: SoilNutrient): SoilNutrient {
        const { value, unit } = nutrient;
        let normalizedValue = value;
        let targetUnit: UnitType = unit;

        // Lógica de Conversão
        switch (key) {
            case 'K':
                if (unit === 'mg/dm³') {
                    normalizedValue = value / 391; // mg/dm³ -> cmolc/dm³
                    targetUnit = 'cmolc/dm³';
                }
                break;

            case 'Ca':
            case 'Mg':
            case 'Al':
            case 'H+Al':
            case 'SB':
            case 'CTC':
                if (unit === 'mmolc/dm³') {
                    normalizedValue = value / 10; // mmolc -> cmolc
                    targetUnit = 'cmolc/dm³';
                }
                break;

            case 'P':
                // P geralmente já vem em mg/dm³
                targetUnit = 'mg/dm³';
                break;

            case 'V%':
            case 'm%':
                targetUnit = '%';
                break;
        }

        return {
            ...nutrient,
            value: normalizedValue,
            unit: targetUnit,
            original_value: value,
            original_unit: unit
        };
    }

    /**
     * Realiza validações pedológicas (consistência química)
     */
    static validateConsistency(data: Record<string, SoilNutrient>): AnalysisAlert[] {
        const alerts: AnalysisAlert[] = [];

        const pH = data['pH']?.value;
        const Al = data['Al']?.value;
        const V = data['V%']?.value;
        const CTC = data['CTC']?.value;
        const SB = data['SB']?.value;

        // 1. pH x Al (Coerência básica: Al alto com pH alto é suspeito)
        if (pH > 6.0 && Al > 0.5) {
            alerts.push({
                type: 'pedological',
                severity: 'medium',
                message: `Inconsistência detectada: pH alto (${pH}) com Alumínio alto (${Al}). Verifique o laudo.`,
                field: 'pH'
            });
        }

        // 2. SB/CTC/V% (Consistência matemática)
        if (SB && CTC && V) {
            const calculatedV = (SB / CTC) * 100;
            if (Math.abs(calculatedV - V) > 2) {
                alerts.push({
                    type: 'consistency',
                    severity: 'high',
                    message: `Divergência matemática: V% do laudo (${V}%) difere do calculado (${calculatedV.toFixed(1)}%).`,
                    field: 'V%'
                });
            }
        }

        // 3. Valores Extremos (Proteção contra erro de digitação/unidade)
        if (pH < 3 || pH > 9) {
            alerts.push({
                type: 'unit_suspect',
                severity: 'high',
                message: `pH fora da faixa plausível (${pH}).`,
                field: 'pH'
            });
        }

        return alerts;
    }

    /**
     * Processa um container completo de análise
     */
    static processContainer(container: Partial<AnalysisContainer>): Partial<AnalysisContainer> {
        const raw = container.raw || {};
        const normalized: Record<string, SoilNutrient> = {};

        // Normalizar todos os nutrientes presentes
        Object.keys(raw).forEach((key) => {
            normalized[key] = this.normalizeNutrient(key as NutrientKey, raw[key]);
        });

        // Validar consistência nos dados normalizados
        const alerts = this.validateConsistency(normalized);

        return {
            ...container,
            normalized,
            alerts,
            updated_at: new Date().toISOString()
        };
    }
}
