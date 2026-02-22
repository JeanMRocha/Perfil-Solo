import { describe, expect, it } from 'vitest';
import {
  calculateLayerChemistryIndicators,
  classifySoilProfile,
  detectAbruptTexturalChange,
  type SoilClassificationInput,
} from '@services/soilClassificationEngine';

function buildBaseInput(
  overrides: Partial<SoilClassificationInput> = {},
): SoilClassificationInput {
  return {
    camadas: [
      { de: 0, ate: 20, argila: 18, areia: 72, ph: 5.2, ca: 1.2, mg: 0.5, k: 0.18, al: 0.4, hal: 4.5, mo: 2.1 },
      { de: 20, ate: 60, argila: 38, areia: 52, ph: 4.9, ca: 0.6, mg: 0.3, k: 0.1, al: 0.8, hal: 5.2, mo: 1.2 },
    ],
    campo: {
      profundidade_rocha_cm: 180,
      saturacao: 'as_vezes',
      cor_glei: false,
      mosqueado: false,
      plintita: false,
      fendas_seca: false,
      slickensides: false,
      horizonte_E: false,
      b_planco_adensado: false,
      espessura_organica_cm: 0,
      tem_bt: false,
      tem_bw: false,
      tem_bi: false,
      tem_bn: false,
      tem_A_chernozemico: false,
      estratificacao_fluvial: false,
    },
    ...overrides,
  };
}

describe('soilClassificationEngine', () => {
  it('classifica Organossolos por espessura organica', () => {
    const result = classifySoilProfile(
      buildBaseInput({
        campo: {
          ...buildBaseInput().campo,
          saturacao: 'permanente',
          espessura_organica_cm: 45,
        },
      }),
    );

    expect(result.ordem_provavel).toBe('Organossolos');
    expect(result.confianca).toBeGreaterThanOrEqual(95);
  });

  it('detecta mudanca textural abrupta automaticamente', () => {
    const input = buildBaseInput({
      campo: {
        ...buildBaseInput().campo,
        b_planco_adensado: true,
      },
    });

    expect(detectAbruptTexturalChange(input)).toBe(true);

    const result = classifySoilProfile(input);
    expect(result.ordem_provavel).toBe('Planossolos');
  });

  it('separa Argissolos de Luvissolos via V% do Bt', () => {
    const luvissolo = classifySoilProfile(
      buildBaseInput({
        camadas: [
          { de: 0, ate: 20, argila: 20, ph: 6.4, ca: 4.5, mg: 2.1, k: 0.4, na: 0.2, al: 0.0, hal: 2.0 },
          { de: 20, ate: 60, argila: 42, ph: 6.2, ca: 5.0, mg: 2.2, k: 0.5, na: 0.2, al: 0.0, hal: 2.1 },
        ],
        campo: {
          ...buildBaseInput().campo,
          tem_bt: true,
        },
      }),
    );
    expect(luvissolo.ordem_provavel).toBe('Luvissolos');

    const argissolo = classifySoilProfile(
      buildBaseInput({
        camadas: [
          { de: 0, ate: 20, argila: 16, ph: 5.2, ca: 1.2, mg: 0.4, k: 0.12, al: 1.1, hal: 6.0 },
          { de: 20, ate: 60, argila: 35, ph: 4.8, ca: 0.8, mg: 0.3, k: 0.1, al: 1.3, hal: 6.2 },
        ],
        campo: {
          ...buildBaseInput().campo,
          tem_bt: true,
        },
      }),
    );
    expect(argissolo.ordem_provavel).toBe('Argissolos');
  });

  it('retorna pendencia quando Bt não tem dados quimicos para V%', () => {
    const result = classifySoilProfile(
      buildBaseInput({
        camadas: [
          { de: 0, ate: 20, argila: 18, ph: 5.3 },
          { de: 20, ate: 60, argila: 36, ph: 5.0 },
        ],
        campo: {
          ...buildBaseInput().campo,
          tem_bt: true,
        },
      }),
    );

    expect(result.dados_faltantes_para_confirmar.join(' ')).toContain('V%');
    expect(['Argissolos', 'Luvissolos']).toContain(result.ordem_provavel ?? '');
  });

  it('calcula SB, T, V% e m% da camada', () => {
    const chemistry = calculateLayerChemistryIndicators({
      ca: 2,
      mg: 1,
      k: 0.2,
      na: 0.1,
      al: 0.3,
      hal: 3,
    });

    expect(chemistry.sb).toBeCloseTo(3.3, 2);
    expect(chemistry.t).toBeCloseTo(6.3, 2);
    expect(chemistry.v_percentual).toBeCloseTo(52.38, 2);
    expect(chemistry.m_percentual).toBeCloseTo(8.33, 2);
  });
});
