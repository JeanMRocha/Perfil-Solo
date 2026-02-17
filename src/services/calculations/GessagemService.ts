// src/services/calculations/GessagemService.ts
import { BaseCalculationInput, CalculationResult } from './types';

/**
 * GessagemService
 * Executa o cálculo de Necessidade de Gesso (NG) para melhoria do perfil do solo em profundidade.
 * Método comum: Baserado no teor de Argila (Cerrado/IAC)
 */
export class GessagemService {
    /**
     * Executa o cálculo de Gessagem
     * Fórmula simplificada para demonstração: NG (t/ha) = 50 * Argila (%) [Para solos em SP] ou 60 * Argila [Cerrados]
     * Neste exemplo, usaremos o fator baseado na textura.
     */
    static calculate(input: BaseCalculationInput): CalculationResult {
        const { normalizedData, params, rulesetVersion } = input;
        const explain_steps: string[] = [];
        const warnings: string[] = [];
        const outputs: Record<string, any> = {};

        try {
            const argila = normalizedData['Argila']?.value || 0;
            const v1 = normalizedData['V%']?.value || 0;
            const m = normalizedData['m%']?.value || 0; // Saturação por Alumínio
            const profundidade = params.profundidade || '0-20';
            const fator = params.fator_argila || 50;

            explain_steps.push(`Parâmetros iniciais: Argila=${argila}%, V%=${v1}%, m%=${m}%`);
            explain_steps.push(`Profundidade alvo: ${profundidade} | Fator aplicado: ${fator}`);

            // 1. Decisão: Precisa de Gesso? (Baseado em m% > 20% ou Ca < 0.5 em profundidade)
            if (m > 20 || (normalizedData['Ca']?.value || 0) < 0.5) {
                explain_steps.push('Critérios de necessidade atendidos (m% > 20 ou Ca < 0.5).');

                // 2. Cálculo
                const NG = (argila * fator) / 1000; // t/ha
                explain_steps.push(`NG Fórmula: (Argila [${argila}] * Fator [${fator}]) / 1000`);
                explain_steps.push(`Resultado: NG = ${NG.toFixed(2)} t/ha`);

                outputs['NG'] = NG;
            } else {
                explain_steps.push('Solo não apresenta necessidade imediata de gessagem pelos critérios m% ou Ca.');
                outputs['NG'] = 0;
            }

            return {
                success: true,
                execution: {
                    module_name: 'gessagem',
                    status: 'completed',
                    inputs_normalized: normalizedData,
                    outputs,
                    explain_steps,
                    ruleset_version: rulesetVersion,
                    references: 'Boletim Técnico 100 (IAC) / Embrapa Cerrados',
                    warnings
                }
            };
        } catch (error: any) {
            return {
                success: false,
                execution: {
                    module_name: 'gessagem',
                    status: 'error',
                    inputs_normalized: normalizedData,
                    outputs: {},
                    explain_steps: ['Erro no cálculo de gessagem.'],
                    ruleset_version: rulesetVersion,
                    references: '',
                    warnings: [error.message]
                },
                errors: [error.message]
            };
        }
    }
}
