import { describe, expect, it } from 'vitest';
import {
  classifySoilByContract,
  normalizeSoilClassificationRequest,
  type SoilClassificationRequest,
} from '@services/soilClassificationContractService';

function buildRequest(
  overrides: Partial<SoilClassificationRequest> = {},
): SoilClassificationRequest {
  return {
    meta: {
      engine_version: '1.0',
      source: 'manual',
      lab_name: 'Lab X',
      lab_method_p: 'mehlich',
      units: {
        cations: 'cmolc_dm3',
        p: 'mg_dm3',
        mo: 'percent',
        texture: 'percent',
      },
      location: {
        country: 'BR',
        state: 'MG',
        municipality: 'Belo Horizonte',
        biome_hint: 'cerrado',
      },
    },
    lab_layers: [
      {
        top_cm: 0,
        bottom_cm: 20,
        texture: { clay_pct: 18, sand_pct: 72, silt_pct: 10 },
        chem: {
          ph_h2o: 5.2,
          ph_kcl: null,
          ca: 1.2,
          mg: 0.5,
          k: 0.18,
          na: 0.05,
          al: 0.4,
          h_al: 4.5,
          p: 6,
          om_pct: 2.1,
          c_org_pct: null,
          ec_dS_m: 0.2,
        },
      },
      {
        top_cm: 20,
        bottom_cm: 60,
        texture: { clay_pct: 38, sand_pct: 52, silt_pct: 10 },
        chem: {
          ph_h2o: 4.9,
          ph_kcl: null,
          ca: 0.6,
          mg: 0.3,
          k: 0.1,
          na: 0.06,
          al: 0.8,
          h_al: 5.2,
          p: 3,
          om_pct: 1.2,
          c_org_pct: null,
          ec_dS_m: 0.2,
        },
      },
    ],
    field: {
      profile_depth_cm: 180,
      contact_rock_cm: 180,
      high_gravel_stoniness: 'no',
      water_saturation: 'sometimes',
      gley_matrix: 'no',
      mottles: 'yes',
      plinthite_or_petroplinthite: 'no',
      petroplinthite_continuous: 'unknown',
      seasonal_cracks: 'no',
      slickensides: 'no',
      eluvial_E_horizon: 'no',
      dense_planic_layer_Bpl: 'no',
      fluvial_stratification: 'no',
      histic_thickness_cm: 0,
      morph_diag: {
        has_Bw: 'no',
        has_Bt: 'yes',
        has_Bi: 'no',
        has_Bn: 'no',
        has_A_chernozemic: 'no',
      },
    },
    ...overrides,
  };
}

describe('soilClassificationContractService', () => {
  it('normaliza unidade de cations e textura', () => {
    const normalized = normalizeSoilClassificationRequest(
      buildRequest({
        meta: {
          ...buildRequest().meta,
          units: {
            cations: 'mmolc_dm3',
            p: 'mg_dm3',
            mo: 'g_kg',
            texture: 'g_kg',
          },
        },
        lab_layers: [
          {
            ...buildRequest().lab_layers[0],
            texture: { clay_pct: 180, sand_pct: 720, silt_pct: 100 },
            chem: { ...buildRequest().lab_layers[0].chem, ca: 12, mg: 5, k: 1.8, h_al: 45, om_pct: 21 },
          },
        ],
      }),
    );

    expect(normalized.meta.units.cations).toBe('cmolc_dm3');
    expect(normalized.meta.units.texture).toBe('percent');
    expect(normalized.lab_layers[0].texture.clay_pct).toBeCloseTo(18, 2);
    expect(normalized.lab_layers[0].chem.ca).toBeCloseTo(1.2, 2);
    expect(normalized.lab_layers[0].chem.om_pct).toBeCloseTo(2.1, 2);
  });

  it('retorna mode deterministic para assinatura forte', () => {
    const { response } = classifySoilByContract(
      buildRequest({
        field: {
          ...buildRequest().field,
          water_saturation: 'permanent',
          histic_thickness_cm: 45,
          morph_diag: {
            has_Bw: 'unknown',
            has_Bt: 'unknown',
            has_Bi: 'unknown',
            has_Bn: 'unknown',
            has_A_chernozemic: 'unknown',
          },
        },
      }),
    );

    expect(response.result.primary.order).toBe('Organossolos');
    expect(response.result.primary.mode).toBe('deterministic');
    expect(response.checklist.question_count).toBeGreaterThanOrEqual(17);
  });

  it('retorna mode probabilistic quando não ha assinatura forte nem morfologia confirmada', () => {
    const { response } = classifySoilByContract(
      buildRequest({
        field: {
          ...buildRequest().field,
          water_saturation: 'never',
          gley_matrix: 'no',
          mottles: 'no',
          morph_diag: {
            has_Bw: 'unknown',
            has_Bt: 'unknown',
            has_Bi: 'unknown',
            has_Bn: 'unknown',
            has_A_chernozemic: 'unknown',
          },
        },
      }),
    );

    expect(response.result.primary.mode).toBe('probabilistic');
  });

  it('inclui bloco de confirmacao por ordem provavel no checklist', () => {
    const { response } = classifySoilByContract(buildRequest());
    expect(response.checklist.order_confirmation_focus.length).toBeGreaterThan(0);
    expect(
      response.checklist.order_confirmation_focus.some((step) => step.what.includes('V%')),
    ).toBe(true);
  });

  it('valida soma de textura fora da faixa permitida', () => {
    const { validation } = classifySoilByContract(
      buildRequest({
        lab_layers: [
          {
            ...buildRequest().lab_layers[0],
            texture: { clay_pct: 10, sand_pct: 10, silt_pct: 10 },
          },
        ],
      }),
    );
    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toContain('soma de textura');
  });
});
