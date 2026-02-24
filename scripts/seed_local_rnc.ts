/**
 * Script para popular o LocalStorage com a amostra do RNC.
 * Como este script roda em Node, ele não tem acesso ao localStorage do navegador.
 * Este script serve para gerar o comando que o usuário deve colar no console.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const samplePath = path.resolve(__dirname, '../src/data/rnc_seed_sample.json');
const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

console.log(`
===========================================================
IMPORTAÇÃO LOCAL (BROWSER) - AMOSTRA RNC
===========================================================

Para popular seu "banco de dados local" (LocalStorage) com as 8 
culturas de teste, copie o código abaixo e cole no console do 
navegador (F12 > Console) enquanto estiver no site:

-----------------------------------------------------------
(async () => {
  const { bulkImportRncRecords } = await import('./src/services/cultureImportService.ts');
  const records = ${JSON.stringify(sample)};
  
  console.log('Iniciando importação local...');
  const result = await bulkImportRncRecords(records);
  
  console.table({
    'Importados': result.imported,
    'Pulados': result.skipped,
    'Erros': result.errors.length
  });
  
  alert('Importação local concluída! Verifique a aba de Culturas.');
})();
-----------------------------------------------------------
`);
