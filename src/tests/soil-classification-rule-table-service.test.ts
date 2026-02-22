import { describe, expect, it } from 'vitest';
import {
  scoreSoilOrderCandidates,
  type SoilRuleInput,
} from '@services/soilClassificationRuleTableService';

function buildInput(overrides: Partial<SoilRuleInput> = {}): SoilRuleInput {
  return {
    lab_layers: [
      {
        top_cm: 0,
        bottom_cm: 20,
        clay_pct: 18,
        sand_pct: 72,
        silt_pct: 10,
        ph_h2o: 5.2,
        ca: 1.2,
        mg: 0.5,
        k: 0.18,
        na: 0.05,
        al: 0.4,
        h_al: 4.5,
        p: 6,
        om_pct: 2.1,
        ec_dS_m: 0.2,
      },
      {
        top_cm: 20,
        bottom_cm: 60,
        clay_pct: 38,
        sand_pct: 52,
        silt_pct: 10,
        ph_h2o: 4.9,
        ca: 0.6,
        mg: 0.3,
        k: 0.1,
        na: 0.06,
        al: 0.8,
        h_al: 5.2,
        p: 3,
        om_pct: 1.2,
        ec_dS_m: 0.2,
      },
    ],
    field: {
      profile_depth_cm: 180,
      contact_rock_cm: 180,
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

describe('soilClassificationRuleTableService', () => {
  it('prioriza Organossolos com assinatura forte e modo deterministico', () => {
    const result = scoreSoilOrderCandidates(
      buildInput({
        field: {
          ...buildInput().field,
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

    expect(result.ranked[0].order).toBe('Organossolos');
    expect(result.ranked[0].mode).toBe('deterministic');
    expect(result.ranked[0].score).toBeGreaterThanOrEqual(70);
  });

  it('escolhe Luvissolos quando Bt tem V% >= 50', () => {
    const result = scoreSoilOrderCandidates(
      buildInput({
        lab_layers: [
          {
            ...buildInput().lab_layers[0],
            ca: 4.2,
            mg: 1.8,
            k: 0.4,
            na: 0.2,
            h_al: 1.8,
            al: 0.1,
          },
          {
            ...buildInput().lab_layers[1],
            ca: 4.8,
            mg: 2.0,
            k: 0.5,
            na: 0.3,
            h_al: 2.0,
            al: 0.1,
          },
        ],
      }),
    );

    expect(result.ranked[0].order).toBe('Luvissolos');
    const argissolo = result.ranked.find((row) => row.order === 'Argissolos');
    const luvissolo = result.ranked.find((row) => row.order === 'Luvissolos');
    expect((luvissolo?.score ?? 0) >= (argissolo?.score ?? 0)).toBe(true);
  });

  it('aplica desempate por especificidade quando score e lacunas empatam', () => {
    const result = scoreSoilOrderCandidates(
      buildInput({
        lab_layers: [
          {
            ...buildInput().lab_layers[0],
            ca: null,
            mg: null,
            k: null,
            h_al: null,
          },
          {
            ...buildInput().lab_layers[1],
            ca: null,
            mg: null,
            k: null,
            h_al: null,
          },
        ],
      }),
    );

    const rankLuv = result.ranked.findIndex((row) => row.order === 'Luvissolos');
    const rankArg = result.ranked.findIndex((row) => row.order === 'Argissolos');
    expect(rankLuv).toBeGreaterThanOrEqual(0);
    expect(rankArg).toBeGreaterThanOrEqual(0);
    expect(rankLuv).toBeLessThan(rankArg);
  });
});
