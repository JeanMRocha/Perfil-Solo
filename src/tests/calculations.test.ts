// src/tests/calculations.test.ts
import { describe, it, expect } from 'vitest';
import { CalagemService } from '../services/calculations/CalagemService';
import { GessagemService } from '../services/calculations/GessagemService';
import { AdubacaoService } from '../services/calculations/AdubacaoService';
import { BaseCalculationInput } from '../services/calculations/types';

describe('Motor de Cálculo Agronômico - Golden Cases', () => {

    // --- MOCK DATA ---
    const baseInput: BaseCalculationInput = {
        analysisId: 'test-123',
        normalizedData: {
            // Solo Ácido Típico
            'Ca': { value: 2.0, unit: 'cmolc/dm³' },
            'Mg': { value: 0.8, unit: 'cmolc/dm³' },
            'K': { value: 0.2, unit: 'cmolc/dm³' },
            'H+Al': { value: 4.5, unit: 'cmolc/dm³' },
            'Al': { value: 0.6, unit: 'cmolc/dm³' }, // Alto Alumínio
            'Argila': { value: 40, unit: '%' },
            'P': { value: 8, unit: 'mg/dm³' }, // Baixo Fósforo
            'V%': { value: 40, unit: '%' }, // Baixa Saturação (calculada aproximada: SB=3 / CTC=7.5 = 40%)
            'm%': { value: 16.6, unit: '%' } // Saturação por Al
        },
        params: {
            V2: 70, // Alvo de Saturação
            PRNT: 90, // Qualidade do Calcário
            cultura: 'Café',
            idade_meses: 24,
            idealRanges: {
                'P': [15, 30],
                'K': [0.3, 0.5]
            }
        },
        rulesetVersion: 'v1.0'
    };

    // --- TESTES DE CALAGEM ---
    describe('CalagemService', () => {
        it('Deve calcular NC corretamente para solo ácido', () => {
            const result = CalagemService.calculate(baseInput);

            expect(result.success).toBe(true);

            // Verificação matemática manual
            // SB = 2.0 + 0.8 + 0.2 = 3.0
            // CTC = 3.0 + 4.5 = 7.5
            // V1 = (3.0 / 7.5) * 100 = 40%
            // NC = (70 - 40) * 7.5 / (10 * 90)
            // NC = 30 * 7.5 / 900
            // NC = 225 / 900 = 0.25 t/ha (Ops, fórmula é NC = (V2-V1)*CTC/10 ... mas espera, e o PRNT?)
            // A fórmula implementada no Service é: ((V2 - V1) * CTC) / (10 * PRNT) ??? 
            // Não, a fórmula real é NC = (V2 - V1) * CTC / 100 ??? Depende da unidade.
            // Vamos checar a implementação do Service no código:
            // NC = ((V2 - V1) * CTC) / (10 * PRNT) -> Isso assume que PRNT é %, e resulta em t/ha?
            // Vamos rever a formula clássica: NC (t/ha) = [(V2 - V1) x CTC] / PRNT
            // Se o service divide por 10 * PRNT, ele está considerando PRNT unitário (0-1)? Ou 0-100?
            // O service implementado: NC = ((V2 - V1) * CTC) / (10 * PRNT);

            // Recalculando com a lógica do Service:
            // V2-V1 = 30
            // CTC = 7.5
            // PRNT = 90
            // (30 * 7.5) / (10 * 90) = 225 / 900 = 0.25 t/ha.
            // Isso parece baixo. A fórmula clássica usada em SP (IAC) é NC = (V2 - V1) * CTC / PRNT.
            // Se V2 e V1 são inteiros (70, 40), então (30 * 7.5) / 100 (se PRNT fosse 100%) = 2.25 t/ha.
            // Se PRNT é 90, seria 2.25 / 0.9 = 2.5 t/ha.

            // O código implementado anteriormente estava: ((V2 - V1) * CTC) / (10 * PRNT).
            // Se PRNT=100, (30 * 7.5) / 1000 = 0.225. Muito baixo. Está errado por fator 10?
            // A formula correta de SP é NC = (V2 - V1) * CTC / PRNT.
            // Se PRNT for 90, NC = 30 * 7.5 / 90 = 2.5 t/ha.

            // VOU CORRIGIR O SERVICE E O TESTE NO PROXIMO PASSO SE FALHAR.
            // Vamos assumir que o teste DEVE retornar algo próximo a 2.5 t/ha para esses valores.

            const nc = result.execution.outputs.NC;
            expect(nc).toBeGreaterThan(0);
            expect(nc).toBeCloseTo(2.5, 1);
        });

        it('Deve retornar NC = 0 se V1 >= V2', () => {
            const inputSat: BaseCalculationInput = {
                ...baseInput,
                normalizedData: {
                    ...baseInput.normalizedData,
                    'V%': { value: 80, unit: '%' }
                } as any, // Cast para evitar erro de tipo estrito no teste
                params: { ...baseInput.params, V2: 70 }
            };
            // Override manualmente os cations para dar V% alto no calculo interno
            const satData = inputSat.normalizedData;
            satData['Ca'] = { value: 5, unit: 'cmolc/dm³' };
            satData['Mg'] = { value: 2, unit: 'cmolc/dm³' };
            satData['K'] = { value: 0.5, unit: 'cmolc/dm³' };
            satData['H+Al'] = { value: 1, unit: 'cmolc/dm³' }; // CTC = 8.5. SB = 7.5. V = 88%

            const result = CalagemService.calculate(inputSat);
            expect(result.execution.outputs.NC).toBe(0);
            expect(result.execution.explain_steps).toContain('V1 (88.2%) já é maior ou igual ao alvo V2 (70%). NC = 0.');
        });
    });

    // --- TESTES DE GESSAGEM ---
    describe('GessagemService', () => {
        it('Deve recomendar Gesso se Alumínio tóxico estiver presente', () => {
            // m% = 16.6% (no input base, menor que 20%, mas vamos forçar Al alto ou Ca baixo)
            // O código original verifica: if (m > 20 || Ca < 0.5)

            // Caso 1: m% baixo e Ca alto -> Sem gesso
            const resultNoGesso = GessagemService.calculate(baseInput);
            // m%=16.6 (baixa toxidez sub), Ca=2.0 (bom).
            expect(resultNoGesso.execution.outputs.NG).toBe(0);

            // Caso 2: Ca muito baixo em profundidade
            const inputLowCa = {
                ...baseInput,
                normalizedData: { ...baseInput.normalizedData, 'Ca': { value: 0.3, unit: 'cmolc/dm³' } }
            };
            const resultGesso = GessagemService.calculate(inputLowCa);
            // NG = Argila (40) * Fator (50) / 1000 = 2.0 t/ha
            expect(resultGesso.execution.outputs.NG).toBe(2.0);
        });
    });

    // --- TESTES DE ADUBAÇÃO ---
    describe('AdubacaoService', () => {
        it('Deve recomendar adubação corretiva se nível estiver baixo', () => {
            const result = AdubacaoService.calculate(baseInput);

            // P atual = 8. Ideal = [15, 30].
            // P está baixo. Espera-se recomendação > 0.
            expect(result.execution.outputs.Rec_P).toBeGreaterThan(0);

            // K atual = 0.2. Ideal = [0.3, 0.5].
            // K está baixo.
            expect(result.execution.outputs.Rec_K).toBeGreaterThan(0);
        });

        it('Deve recomendar N baseado na idade', () => {
            // Idade 24 meses -> > 12 -> N = 150
            const result = AdubacaoService.calculate(baseInput);
            expect(result.execution.outputs.Rec_N).toBe(150);
        });
    });

});
