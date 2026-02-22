import { describe, expect, it } from 'vitest';
import {
  buildOrderConfirmationChecklist,
  listSoilChecklistQuestions,
} from '@services/soilFieldChecklistService';

describe('soilFieldChecklistService', () => {
  it('expoe as 17 perguntas base do checklist SiBCS', () => {
    const questions = listSoilChecklistQuestions();
    expect(questions.length).toBeGreaterThanOrEqual(17);
    expect(questions.some((item) => item.id === 'q1_histic_thickness')).toBe(true);
    expect(questions.some((item) => item.id === 'q17_has_a_chernozemic')).toBe(true);
  });

  it('retorna passo de confirmacao para Espodossolos', () => {
    const steps = buildOrderConfirmationChecklist('Espodossolos');
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].what.toLowerCase()).toContain('bh/bs/bhs');
  });

  it('retorna passo de confirmacao de V% para Argissolos/Luvissolos', () => {
    const arg = buildOrderConfirmationChecklist('Argissolos');
    const luv = buildOrderConfirmationChecklist('Luvissolos');
    expect(arg[0].what).toContain('V%');
    expect(luv[0].what).toContain('V%');
  });
});
