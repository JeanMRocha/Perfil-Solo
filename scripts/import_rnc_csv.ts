import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function generateLocalSample() {
  const csvPath = path.resolve(
    __dirname,
    '../docs/rnc/2026_01_06_PLAN_CultivaresEspeciesRegistradas.csv',
  );

  if (!fs.existsSync(csvPath)) {
    console.error('Arquivo CSV não encontrado!');
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');

  const groupsSeen = new Set<string>();
  const sampledRecords: any[] = [];

  // Scan all lines to find unique groups
  for (let i = 1; i < lines.length && sampledRecords.length < 10; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = splitCsvLine(line);
    if (fields.length < 4) continue;

    const cultivar = fields[0];
    const especie = fields[1];
    const cientifico = fields[2];
    const grupo = fields[3];
    const situacao = fields[4];

    if (
      grupo &&
      grupo !== 'GRUPO DA ESPÉCIE' &&
      !groupsSeen.has(grupo) &&
      cultivar
    ) {
      groupsSeen.add(grupo);
      sampledRecords.push({
        especie_nome_comum: especie,
        especie_nome_cientifico: cientifico,
        cultivar: cultivar,
        tipo_registro: 'CULTIVAR',
        grupo_especie: grupo,
        situacao: situacao,
      });
    }
  }

  console.log(`\n--- AMOSTRA SELECIONADA (1 por grupo, máx 10) ---`);
  console.table(
    sampledRecords.map((r) => ({
      Grupo: r.grupo_especie,
      Espécie: r.especie_nome_comum,
      Cultivar: r.cultivar,
    })),
  );

  const outputPath = path.resolve(
    __dirname,
    '../src/data/rnc_seed_sample.json',
  );
  fs.writeFileSync(outputPath, JSON.stringify(sampledRecords, null, 2));
}

generateLocalSample().catch((err) => {
  console.error('Erro crítico no script:', err);
  process.exit(1);
});
