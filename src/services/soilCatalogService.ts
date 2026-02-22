export interface SoilCatalogEntry {
  id: string;
  nome: string;
  aliases: string[];
  descricao: string;
  source: string;
  sourceUrl: string;
}

const EMBRAPA_SOLOS_BRASIL_URL =
  'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil';
const EMBRAPA_SIBCS_URL =
  'https://www.embrapa.br/solos/sibcs/bases-e-criterios-para-classificacao';

const SOIL_CATALOG: SoilCatalogEntry[] = [
  {
    id: 'argissolos',
    nome: 'Argissolos',
    aliases: ['argissolo'],
    descricao:
      'Solos minerais com horizonte B textural e aumento de argila em profundidade por iluviacao.',
    source: 'Embrapa - Solos do Brasil (SiBCS)',
    sourceUrl: EMBRAPA_SOLOS_BRASIL_URL,
  },
  {
    id: 'cambissolos',
    nome: 'Cambissolos',
    aliases: ['cambissolo'],
    descricao:
      'Solos pouco desenvolvidos, com horizonte B incipiente, sem B textural bem definido.',
    source: 'Embrapa - Solos do Brasil (SiBCS)',
    sourceUrl: EMBRAPA_SOLOS_BRASIL_URL,
  },
  {
    id: 'chernossolos',
    nome: 'Chernossolos',
    aliases: ['chernossolo'],
    descricao:
      'Solos com horizonte A chernozemico, maior fertilidade natural e argila de atividade alta.',
    source: 'Embrapa - Solos do Brasil (SiBCS)',
    sourceUrl: EMBRAPA_SOLOS_BRASIL_URL,
  },
  {
    id: 'espodossolos',
    nome: 'Espodossolos',
    aliases: ['espodossolo'],
    descricao:
      'Solos com horizonte B espodico, com acumulacao de materia organica associada a aluminio e/ou ferro.',
    source: 'Embrapa - Solos do Brasil (SiBCS)',
    sourceUrl: EMBRAPA_SOLOS_BRASIL_URL,
  },
  {
    id: 'gleissolos',
    nome: 'Gleissolos',
    aliases: ['gleissolo'],
    descricao:
      'Solos hidromorficos, saturados por agua por periodos prolongados e com sinais de reducao.',
    source: 'Embrapa - Solos do Brasil (SiBCS)',
    sourceUrl: EMBRAPA_SOLOS_BRASIL_URL,
  },
  {
    id: 'latossolos',
    nome: 'Latossolos',
    aliases: ['latossolo'],
    descricao:
      'Solos muito intemperizados, profundos e bem drenados, com horizonte B latossolico.',
    source: 'Embrapa - Solos do Brasil (SiBCS)',
    sourceUrl: EMBRAPA_SOLOS_BRASIL_URL,
  },
  {
    id: 'luvissolos',
    nome: 'Luvissolos',
    aliases: ['luvissolo'],
    descricao:
      'Solos com horizonte B textural, alta saturacao por bases e argila de atividade alta.',
    source: 'Embrapa - Solos do Brasil (SiBCS)',
    sourceUrl: EMBRAPA_SOLOS_BRASIL_URL,
  },
  {
    id: 'neossolos',
    nome: 'Neossolos',
    aliases: ['neossolo'],
    descricao:
      'Solos jovens e pouco evoluidos, sem horizonte B diagnostico desenvolvido.',
    source: 'Embrapa - Solos do Brasil (SiBCS)',
    sourceUrl: EMBRAPA_SOLOS_BRASIL_URL,
  },
  {
    id: 'nitossolos',
    nome: 'Nitossolos',
    aliases: ['nitossolo'],
    descricao:
      'Solos com horizonte B nitico, estrutura em blocos e boa profundidade efetiva.',
    source: 'Embrapa - Solos do Brasil (SiBCS)',
    sourceUrl: EMBRAPA_SOLOS_BRASIL_URL,
  },
  {
    id: 'organossolos',
    nome: 'Organossolos',
    aliases: ['organossolo'],
    descricao:
      'Solos com predominancia de material organico e altos teores de carbono.',
    source: 'Embrapa - Solos do Brasil (SiBCS)',
    sourceUrl: EMBRAPA_SOLOS_BRASIL_URL,
  },
  {
    id: 'planossolos',
    nome: 'Planossolos',
    aliases: ['planossolo'],
    descricao:
      'Solos com mudanca textural abrupta para horizonte subsuperficial mais argiloso e adensado.',
    source: 'Embrapa - Solos do Brasil (SiBCS)',
    sourceUrl: EMBRAPA_SOLOS_BRASIL_URL,
  },
  {
    id: 'plintossolos',
    nome: 'Plintossolos',
    aliases: ['plintossolo'],
    descricao:
      'Solos com plintita e possibilidade de endurecimento quando secos, com restricao fisica no perfil.',
    source: 'Embrapa - Solos do Brasil (SiBCS)',
    sourceUrl: EMBRAPA_SOLOS_BRASIL_URL,
  },
  {
    id: 'vertissolos',
    nome: 'Vertissolos',
    aliases: ['vertissolo'],
    descricao:
      'Solos com argilas expansivas e retrateis, com formacao de fendas no periodo seco.',
    source: 'Embrapa - Solos do Brasil (SiBCS)',
    sourceUrl: EMBRAPA_SOLOS_BRASIL_URL,
  },
];

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function listSoilCatalog(): SoilCatalogEntry[] {
  return [...SOIL_CATALOG].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function findSoilCatalogEntry(
  value: string | null | undefined,
): SoilCatalogEntry | null {
  const needle = normalize(value ?? '');
  if (!needle) return null;

  return (
    SOIL_CATALOG.find((item) => {
      if (normalize(item.id) === needle) return true;
      if (normalize(item.nome) === needle) return true;
      return item.aliases.some((alias) => normalize(alias) === needle);
    }) ?? null
  );
}

export function searchSoilCatalog(query: string): SoilCatalogEntry[] {
  const needle = normalize(query);
  if (!needle) return listSoilCatalog();

  return listSoilCatalog().filter((item) => {
    if (normalize(item.nome).includes(needle)) return true;
    if (normalize(item.id).includes(needle)) return true;
    return item.aliases.some((alias) => normalize(alias).includes(needle));
  });
}

export function getSoilCatalogSources(): string[] {
  return [EMBRAPA_SOLOS_BRASIL_URL, EMBRAPA_SIBCS_URL];
}
