import { SoilParams } from '../types/soil';

export const soilParamsMock: SoilParams[] = [
  {
    cultura: 'abacate',
    variedade: null,
    estado: null,
    cidade: null,
    extrator: 'mehlich-1',
    estagio: 'producao',
    idade_meses: null,
    ideal: {
      pH: [5.5, 6.5],
      N: [20, 40],
      P: [10, 30],
      K: [0.2, 0.4],
      Ca: [3, 6],
      Mg: [1, 2],
      MO: [3, 5],
    },
    ruleset_version: 'mock-v1',
    fonte: 'Padrao mock para funcionamento offline.',
    observacoes: 'Faixas genericas para validacao inicial.',
  },
  {
    cultura: 'abacate',
    variedade: 'fortuna',
    estado: 'sp',
    cidade: null,
    extrator: 'mehlich-1',
    estagio: 'producao',
    ideal: {
      pH: [5.5, 6.2],
      N: [25, 45],
      P: [12, 25],
      K: [0.25, 0.45],
      Ca: [3.5, 6],
      Mg: [1.2, 2.2],
      MO: [3, 5],
    },
    ruleset_version: 'mock-v1',
    fonte: 'Mock especifico para demo.',
  },
];
