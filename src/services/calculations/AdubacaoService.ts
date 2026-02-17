// src/services/calculations/AdubacaoService.ts
import { BaseCalculationInput, CalculationResult } from './types';

/**
 * AdubacaoService
 * Executa recomendações de NPK e Micronutrientes com base em:
 * 1. Cultura e Idade (referência técnica)
 * 2. Disponibilidade atual no solo (Análise)
 */
export class AdubacaoService {
    /**
     * Executa a recomendação nutricional.
     * Nota: Este motor consulta as tabelas de referência ideais do Super Admin.
     */
    static calculate(input: BaseCalculationInput): CalculationResult {
        const { normalizedData, params, rulesetVersion } = input;
        const explain_steps: string[] = [];
        const warnings: string[] = [];
        const outputs: Record<string, any> = {};

        try {
            const cultura = params.cultura || 'Desconhecida';
            const idade = params.idade_meses || 0;
            const idealRanges = params.idealRanges || {}; // Vem do cultivar_age_references

            explain_steps.push(`Recomendação para ${cultura} | Idade: ${idade} meses.`);

            // Lógica simplificada de recomendação para P e K
            const nutrientsToProcess: ('P' | 'K')[] = ['P', 'K'];

            nutrientsToProcess.forEach((nut) => {
                const atual = normalizedData[nut]?.value || 0;
                const [min, max] = idealRanges[nut] || [0, 0];

                explain_steps.push(`Análise de ${nut}: Atual=${atual} | Faixa Ideal=[${min}, ${max}]`);

                if (atual < min) {
                    const necessidade = (min - atual) * 2; // Fator fictício p/ demo
                    explain_steps.push(`Status de ${nut}: BAIXO. Necessidade de correção + manutenção.`);
                    outputs[`Rec_${nut}`] = necessidade;
                } else if (atual > max) {
                    explain_steps.push(`Status de ${nut}: ALTO. Apenas manutenção ou redução.`);
                    outputs[`Rec_${nut}`] = 0;
                } else {
                    explain_steps.push(`Status de ${nut}: ADEQUADO. Apenas manutenção.`);
                    outputs[`Rec_${nut}`] = 10; // Valor simbólico
                }
            });

            // Recomendação de Nitrogenio (N) geralmente é por idade/estágio, não análise de solo
            const recN = idade < 12 ? 50 : 150;
            explain_steps.push(`Recomendação de N baseada na idade (${idade}m): ${recN} g/planta ou kg/ha.`);
            outputs['Rec_N'] = recN;

            return {
                success: true,
                execution: {
                    module_name: 'adubacao',
                    status: 'completed',
                    inputs_normalized: normalizedData,
                    outputs,
                    explain_steps,
                    ruleset_version: rulesetVersion,
                    references: 'Tabela de Recomendações (Boletim 100/IAC)',
                    warnings
                }
            };
        } catch (error: any) {
            return {
                success: false,
                execution: {
                    module_name: 'adubacao',
                    status: 'error',
                    inputs_normalized: normalizedData,
                    outputs: {},
                    explain_steps: ['Erro no cálculo nutricional.'],
                    ruleset_version: rulesetVersion,
                    references: '',
                    warnings: [error.message]
                },
                errors: [error.message]
            };
        }
    }
}
