// src/data/labTemplates.ts
import { NutrientKey, UnitType } from '../types/soil';

export interface LabTemplate {
    name: string;
    id: string;
    mappings: {
        key: NutrientKey;
        synonyms: string[];
        expectedUnit: UnitType;
        regex?: string; // Regex opcional para extrair valor caso falte mapeamento simples
    }[];
    validationRules?: {
        field: NutrientKey;
        min: number;
        max: number;
    }[];
}

export const labTemplates: LabTemplate[] = [
    {
        name: 'Genérico / Padrão',
        id: 'generic',
        mappings: [
            { key: 'pH', synonyms: ['pH em CaCl2', 'pH CaCl2', 'pH Água', 'pH'], expectedUnit: 'dm³' }, // pH não tem unidade real mas usaremos dm3 como placeholder
            { key: 'P', synonyms: ['P-Mehlich', 'Fósforo', 'P'], expectedUnit: 'mg/dm³' },
            { key: 'K', synonyms: ['K', 'Potássio'], expectedUnit: 'mg/dm³' },
            { key: 'Ca', synonyms: ['Ca', 'Cálcio'], expectedUnit: 'cmolc/dm³' },
            { key: 'Mg', synonyms: ['Mg', 'Magnésio'], expectedUnit: 'cmolc/dm³' },
            { key: 'Al', synonyms: ['Al', 'Alumínio'], expectedUnit: 'cmolc/dm³' },
            { key: 'H+Al', synonyms: ['Acidez Potencial', 'H+Al', 'H + Al'], expectedUnit: 'cmolc/dm³' },
            { key: 'MO', synonyms: ['M.O.', 'Matéria Orgânica', 'MO', 'C Orgânico'], expectedUnit: '%' },
            { key: 'Argila', synonyms: ['Argila'], expectedUnit: '%' },
            { key: 'V%', synonyms: ['V%', 'Sat. Bases'], expectedUnit: '%' },
            { key: 'SB', synonyms: ['Soma Bases', 'SB'], expectedUnit: 'cmolc/dm³' },
            { key: 'CTC', synonyms: ['CTC Total', 'CTC pH7', 'T'], expectedUnit: 'cmolc/dm³' },
        ]
    },
    {
        name: 'Exemplo Lab Agronômico SP',
        id: 'lab_sp_example',
        mappings: [
            { key: 'pH', synonyms: ['pH (CaCl2)'], expectedUnit: 'dm³' },
            { key: 'Argila', synonyms: ['Argila (g/kg)'], expectedUnit: 'g/kg' },
            { key: 'K', synonyms: ['Potássio (mmolc/dm3)'], expectedUnit: 'mmolc/dm³' },
        ]
    }
];
