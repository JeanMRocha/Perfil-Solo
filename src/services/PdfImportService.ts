// src/services/PdfImportService.ts
import * as pdfjsLib from 'pdfjs-dist';
import { NutrientKey, SoilNutrient, UnitType } from '../types/soil';
import { labTemplates, LabTemplate } from '../data/labTemplates';

// Configuração do worker para pdfjs-dist (Vite/Browser context)
if (typeof window !== 'undefined' && 'pdfjsLib' in window) {
    // @ts-ignore
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export interface ExtractedData {
    nutrients: Record<string, SoilNutrient>;
    confidence: number;
    unmappedLines: string[];
}

export class PdfImportService {
    /**
     * Camada 1: Extração de Texto Puro
     */
    static async extractText(file: File): Promise<string[]> {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText: string[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageStrings = textContent.items.map((item: any) => item.str);
            fullText = [...fullText, ...pageStrings];
        }
        return fullText;
    }

    /**
     * Camada 2: Normalização de Texto
     * Limpa ruído, padroniza decimais e remove espaços extras.
     */
    static normalizeText(text: string): string {
        return text
            .replace(/,/g, '.') // Vírgula para ponto
            .replace(/(\r\n|\n|\r)/gm, ' ') // Remove quebras de linha
            .trim();
    }

    /**
     * Camada 3: Mapeamento (Mapper)
     * Usa os templates para encontrar nutrientes e valores.
     */
    static mapToNutrients(lines: string[], template: LabTemplate): ExtractedData {
        const results: Record<string, SoilNutrient> = {};
        const unmapped: string[] = [];
        let mappedCount = 0;

        // Processa linha a linha em busca de chaves/sinônimos
        lines.forEach((line) => {
            const normalizedLine = this.normalizeText(line);
            let foundInLine = false;

            template.mappings.forEach((mapping) => {
                mapping.synonyms.forEach((synonym) => {
                    if (normalizedLine.includes(synonym)) {
                        // Tenta achar um número logo após o sinônimo ou na linha
                        const numberMatch = normalizedLine.match(/(\d+\.?\d*)/);
                        if (numberMatch && !results[mapping.key]) {
                            results[mapping.key] = {
                                value: parseFloat(numberMatch[0]),
                                unit: mapping.expectedUnit
                            };
                            mappedCount++;
                            foundInLine = true;
                        }
                    }
                });
            });

            if (!foundInLine && normalizedLine.length > 2) {
                unmapped.push(normalizedLine);
            }
        });

        const confidence = mappedCount / template.mappings.length;

        return {
            nutrients: results,
            confidence,
            unmappedLines: unmapped
        };
    }

    /**
     * Orquestrador do Pipeline
     */
    static async importSoilAnalysis(file: File, templateId: string = 'generic'): Promise<ExtractedData> {
        const template = labTemplates.find(t => t.id === templateId) || labTemplates[0];
        const rawLines = await this.extractText(file);
        return this.mapToNutrients(rawLines, template);
    }
}
