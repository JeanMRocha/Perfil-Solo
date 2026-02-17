// src/services/calculations/CalagemService.ts
import { BaseCalculationInput, CalculationResult } from './types';

/**
 * CalagemService
 * Executa o cálculo de Necessidade de Calagem (NC) usando o método da Saturação por Bases.
 */
export class CalagemService {
    /**
     * Executa o cálculo de Calagem
     * Fórmula: NC (t/ha) = ((V2 - V1) * CTC) / (10 * PRNT)
     */
    static calculate(input: BaseCalculationInput): CalculationResult {
        const { normalizedData, params, rulesetVersion } = input;
        const explain_steps: string[] = [];
        const warnings: string[] = [];
        const outputs: Record<string, any> = {};

        try {
            // 1. Extração de Entradas
            const Ca = normalizedData['Ca']?.value || 0;
            const Mg = normalizedData['Mg']?.value || 0;
            const K = normalizedData['K']?.value || 0;
            const HAl = normalizedData['H+Al']?.value || 0;
            const V2 = params.V2 || 70; // Alvo da cultura (padrão 70%)
            const PRNT = params.PRNT || 100; // Calagem padrão (padrão 100%)

            explain_steps.push(`Parâmetros iniciais: Ca=${Ca}, Mg=${Mg}, K=${K}, H+Al=${HAl}`);
            explain_steps.push(`Alvo de Saturação (V2): ${V2}% | PRNT do corretivo: ${PRNT}%`);

            // 2. Cálculos Intermediários
            const SB = Ca + Mg + K;
            const CTC = SB + HAl;
            const V1 = CTC > 0 ? (SB / CTC) * 100 : 0;

            explain_steps.push(`SB (Soma de Bases): ${Ca} + ${Mg} + ${K} = ${SB.toFixed(2)} cmolc/dm³`);
            explain_steps.push(`CTC (Capacidade de Troca Catiônica): ${SB.toFixed(2)} + ${HAl} = ${CTC.toFixed(2)} cmolc/dm³`);
            explain_steps.push(`V1 (Saturação Atual): (${SB.toFixed(2)} / ${CTC.toFixed(2)}) * 100 = ${V1.toFixed(1)}%`);

            // 3. Necessidade de Calagem (NC)
            let NC = 0;
            if (V2 > V1) {
                // Fórmula Corrigida IAC: NC (t/ha) = (V2 - V1) * CTC / PRNT
                NC = ((V2 - V1) * CTC) / PRNT;
                explain_steps.push(`NC Fórmula: ((${V2} - ${V1.toFixed(1)}) * ${CTC.toFixed(2)}) / ${PRNT}`);
                explain_steps.push(`Resultado: NC = ${NC.toFixed(2)} t/ha`);
            } else {
                NC = 0;
                explain_steps.push(`V1 (${V1.toFixed(1)}%) já é maior ou igual ao alvo V2 (${V2}%). NC = 0.`);
            }

            // 4. Verificações de Segurança
            if (NC > 5) {
                warnings.push('NC acima de 5 t/ha. Considere parcelamento da aplicação para evitar supercalagem.');
            }

            outputs['NC'] = NC;
            outputs['SB'] = SB;
            outputs['CTC'] = CTC;
            outputs['V1'] = V1;

            return {
                success: true,
                execution: {
                    module_name: 'calagem',
                    status: 'completed',
                    inputs_normalized: normalizedData,
                    outputs,
                    explain_steps,
                    ruleset_version: rulesetVersion,
                    references: 'Manual de Adubação e Calagem para o Estado de São Paulo (IAC)',
                    warnings
                }
            };
        } catch (error: any) {
            return {
                success: false,
                execution: {
                    module_name: 'calagem',
                    status: 'error',
                    inputs_normalized: normalizedData,
                    outputs: {},
                    explain_steps: ['Erro durante o cálculo de calagem.'],
                    ruleset_version: rulesetVersion,
                    references: '',
                    warnings: [error.message]
                },
                errors: [error.message]
            };
        }
    }
}
