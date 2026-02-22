import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const RNC_BASE_URL = 'https://sistemas.agricultura.gov.br/snpc/cultivarweb';
const RNC_SEARCH_URL = `${RNC_BASE_URL}/cultivares_registradas.php`;
const RNC_SEARCH_FORM = 'postado=1&acao=pesquisar';
const RNC_CSV_FORM = 'postado=1&acao=pesquisar&exportar=csv';
const RNC_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SYNC_CHUNK_SIZE = 1000;
const SUGGESTION_POOL_LIMIT = 800;

type CsvRow = {
  cultivar: string;
  especie_nome_comum: string;
  especie_nome_cientifico: string;
  grupo_especie: string;
  situacao: string;
  numero_registro: string;
};

type ListingRow = {
  cultivar: string;
  numero_registro: string;
  tipo_registro: string;
  rnc_codsr?: string;
  rnc_codverif?: string;
  rnc_detail_url?: string;
};

type CacheRow = {
  rnc_uid: string;
  especie_nome_comum: string;
  especie_nome_cientifico: string;
  cultivar: string;
  tipo_registro: string;
  grupo_especie: string;
  situacao: string;
  numero_registro: string;
  rnc_codsr?: string;
  rnc_codverif?: string;
  rnc_detail_url?: string;
  sync_batch_id: string;
  synced_at: string;
};

type SearchFilters = {
  nomeComum?: string;
  nomeCientifico?: string;
  cultivar?: string;
  grupoEspecie?: string;
};

let runningSyncPromise: Promise<{ total: number; synced_at: string }> | null = null;

function normalize(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeRegisterNumber(value?: string | null): string {
  const digits = String(value ?? '').replace(/\D+/g, '');
  return digits.replace(/^0+/, '');
}

function normalizeForHash(value?: string | null): string {
  return normalize(value).replace(/\s+/g, ' ').trim();
}

function makeHashToken(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, '0');
}

function makeRncUid(row: CsvRow): string {
  const registration = normalizeRegisterNumber(row.numero_registro);
  if (registration) return `reg:${registration}`;
  const signature = [
    normalizeForHash(row.especie_nome_comum),
    normalizeForHash(row.especie_nome_cientifico),
    normalizeForHash(row.cultivar),
  ].join('|');
  return `fallback:${makeHashToken(signature)}`;
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
  };

  return value.replace(
    /&(#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g,
    (full, token: string): string => {
      if (token.startsWith('#x') || token.startsWith('#X')) {
        const parsed = Number.parseInt(token.slice(2), 16);
        return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : full;
      }
      if (token.startsWith('#')) {
        const parsed = Number.parseInt(token.slice(1), 10);
        return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : full;
      }
      return named[token] ?? full;
    },
  );
}

function cleanHtmlCell(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const nextChar = line[i + 1];
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i += 1;
        continue;
      }
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvRows(csvContent: string): CsvRow[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) return [];
  const headerColumns = parseCsvLine(lines[0]).map((value) => normalize(value));

  const columnIndex = (name: string) => headerColumns.indexOf(normalize(name));

  const idxCultivar = columnIndex('CULTIVAR');
  const idxNomeComum = columnIndex('NOME COMUM');
  const idxNomeCientifico = columnIndex('NOME CIENTIFICO');
  const idxGrupoEspecie = columnIndex('GRUPO DA ESPECIE');
  const idxSituacao = columnIndex('SITUACAO');
  const idxNumeroRegistro = columnIndex('Nº REGISTRO');

  const safe = (columns: string[], index: number): string =>
    index >= 0 && index < columns.length ? columns[index] : '';

  return lines
    .slice(1)
    .map((line) => {
      const columns = parseCsvLine(line);
      return {
        cultivar: safe(columns, idxCultivar).trim(),
        especie_nome_comum: safe(columns, idxNomeComum).trim(),
        especie_nome_cientifico: safe(columns, idxNomeCientifico).trim(),
        grupo_especie: safe(columns, idxGrupoEspecie).trim(),
        situacao: safe(columns, idxSituacao).trim(),
        numero_registro: normalizeRegisterNumber(safe(columns, idxNumeroRegistro)),
      } satisfies CsvRow;
    })
    .filter(
      (row) =>
        row.cultivar.length > 0 ||
        row.especie_nome_comum.length > 0 ||
        row.especie_nome_cientifico.length > 0,
    );
}

function parseListingRows(htmlContent: string): ListingRow[] {
  const rowMatches = htmlContent.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const rows: ListingRow[] = [];

  for (const rowHtml of rowMatches) {
    if (!rowHtml.includes('detalhe_cultivar.php?codsr=')) continue;

    const tdMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
      cleanHtmlCell(match[1]),
    );
    if (tdMatches.length < 4) continue;

    const linkMatch = rowHtml.match(
      /detalhe_cultivar\.php\?codsr=(\d+)&codverif=(\d+)/i,
    );

    const codsr = linkMatch?.[1] ?? '';
    const codverif = linkMatch?.[2] ?? '';
    const detailUrl =
      codsr && codverif
        ? `${RNC_BASE_URL}/detalhe_cultivar.php?codsr=${codsr}&codverif=${codverif}`
        : '';

    const cultivar = tdMatches[0] ?? '';
    const tipoRegistro = (tdMatches[1] ?? '').toUpperCase() || 'CULTIVAR';
    const numeroRegistro = normalizeRegisterNumber(tdMatches[3] ?? '');

    rows.push({
      cultivar,
      numero_registro: numeroRegistro,
      tipo_registro: tipoRegistro,
      rnc_codsr: codsr || undefined,
      rnc_codverif: codverif || undefined,
      rnc_detail_url: detailUrl || undefined,
    });
  }

  return rows;
}

async function fetchRncCsvRows(): Promise<CsvRow[]> {
  const response = await fetch(RNC_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: RNC_CSV_FORM,
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar CSV do RNC (HTTP ${response.status}).`);
  }

  const csvText = await response.text();
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    throw new Error('CSV do RNC retornou vazio.');
  }

  return rows;
}

async function fetchRncListingRows(): Promise<ListingRow[]> {
  const response = await fetch(RNC_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: RNC_SEARCH_FORM,
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar listagem do RNC (HTTP ${response.status}).`);
  }

  const html = await response.text();
  return parseListingRows(html);
}

function mergeCsvWithListing(csvRows: CsvRow[], listingRows: ListingRow[]): CacheRow[] {
  const byRegistration = new Map<string, ListingRow>();
  const byCultivar = new Map<string, ListingRow>();

  for (const listing of listingRows) {
    const normRegistration = normalizeRegisterNumber(listing.numero_registro);
    if (normRegistration && !byRegistration.has(normRegistration)) {
      byRegistration.set(normRegistration, listing);
    }
    const normCultivar = normalize(listing.cultivar);
    if (normCultivar && !byCultivar.has(normCultivar)) {
      byCultivar.set(normCultivar, listing);
    }
  }

  const syncBatchId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const syncedAt = new Date().toISOString();

  return csvRows.map((csv) => {
    const normalizedRegistration = normalizeRegisterNumber(csv.numero_registro);
    const normalizedCultivar = normalize(csv.cultivar);
    const listing =
      (normalizedRegistration && byRegistration.get(normalizedRegistration)) ||
      (normalizedCultivar && byCultivar.get(normalizedCultivar)) ||
      null;

    return {
      rnc_uid: makeRncUid(csv),
      especie_nome_comum: csv.especie_nome_comum,
      especie_nome_cientifico: csv.especie_nome_cientifico,
      cultivar: csv.cultivar,
      tipo_registro: listing?.tipo_registro || (csv.cultivar ? 'CULTIVAR' : 'ESPECIE'),
      grupo_especie: csv.grupo_especie,
      situacao: csv.situacao,
      numero_registro: normalizedRegistration,
      rnc_codsr: listing?.rnc_codsr,
      rnc_codverif: listing?.rnc_codverif,
      rnc_detail_url: listing?.rnc_detail_url,
      sync_batch_id: syncBatchId,
      synced_at: syncedAt,
    };
  });
}

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

function levenshtein(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;

  const prev = new Array(m + 1);
  const curr = new Array(m + 1);
  for (let j = 0; j <= m; j += 1) prev[j] = j;

  for (let i = 1; i <= n; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= m; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= m; j += 1) prev[j] = curr[j];
  }

  return prev[m];
}

function isLikelySuperUser(user: any): boolean {
  const email = normalize(user?.email);
  const ownerSuperEmails = String(Deno.env.get('OWNER_SUPER_EMAILS') ?? '')
    .split(/[,\s;]+/)
    .map((item) => normalize(item))
    .filter((item) => item.length > 0);
  if (email && ownerSuperEmails.includes(email)) return true;

  const checkBag = (bag: Record<string, unknown> | null | undefined): boolean => {
    if (!bag) return false;
    const role = normalize(bag.role);
    const roles = Array.isArray(bag.roles) ? bag.roles.map((item) => normalize(item)) : [];
    return (
      role === 'super' ||
      role === 'super_user' ||
      role === 'admin' ||
      bag.is_super_user === true ||
      bag.super_user === true ||
      roles.includes('super') ||
      roles.includes('admin')
    );
  };

  return checkBag(user?.app_metadata) || checkBag(user?.user_metadata);
}

async function ensureAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Missing auth header' };
  }

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: authHeader } },
    },
  );

  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser();

  if (error || !user) return { user: null, error: 'Unauthorized' };
  return { user, error: null };
}

function getAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

async function getCacheHealth(admin: ReturnType<typeof getAdminClient>) {
  const [
    { count, error: countError },
    { data: latest, error: latestError },
    { count: emptyGroupCount, error: emptyGroupError },
  ] =
    await Promise.all([
      admin.from('rnc_cultivars_cache').select('id', { count: 'exact', head: true }),
      admin
        .from('rnc_cultivars_cache')
        .select('synced_at')
        .order('synced_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('rnc_cultivars_cache')
        .select('id', { count: 'exact', head: true })
        .or('grupo_especie.is.null,grupo_especie.eq.'),
    ]);

  if (countError) throw countError;
  if (latestError) throw latestError;
  if (emptyGroupError) throw emptyGroupError;

  const total = Number(count ?? 0) || 0;
  const lastSyncedAt = latest?.synced_at ? new Date(latest.synced_at).getTime() : 0;
  const missingGroupCount = Number(emptyGroupCount ?? 0) || 0;
  return { total, lastSyncedAt, missingGroupCount };
}

async function runFullSync(admin: ReturnType<typeof getAdminClient>) {
  const [csvRows, listingRows] = await Promise.all([
    fetchRncCsvRows(),
    fetchRncListingRows(),
  ]);
  const mergedRows = mergeCsvWithListing(csvRows, listingRows);
  if (mergedRows.length === 0) {
    throw new Error('Não foi possível montar dataset do RNC.');
  }

  const syncBatchId = mergedRows[0].sync_batch_id;
  for (let start = 0; start < mergedRows.length; start += SYNC_CHUNK_SIZE) {
    const chunk = mergedRows.slice(start, start + SYNC_CHUNK_SIZE);
    const { error } = await admin
      .from('rnc_cultivars_cache')
      .upsert(chunk, { onConflict: 'rnc_uid' });
    if (error) throw error;
  }

  const { error: cleanupError } = await admin
    .from('rnc_cultivars_cache')
    .delete()
    .neq('sync_batch_id', syncBatchId);
  if (cleanupError) throw cleanupError;

  return {
    total: mergedRows.length,
    synced_at: mergedRows[0].synced_at,
  };
}

async function ensureCacheReady(
  admin: ReturnType<typeof getAdminClient>,
  forceSync = false,
) {
  const health = await getCacheHealth(admin);
  const missingGroupRatio =
    health.total > 0 ? health.missingGroupCount / health.total : 0;
  const groupCoverageLow = health.total > 0 && missingGroupRatio > 0.01;
  const stale =
    health.total === 0 ||
    !health.lastSyncedAt ||
    Date.now() - health.lastSyncedAt > RNC_SYNC_INTERVAL_MS ||
    groupCoverageLow;

  if (!forceSync && !stale) return health;

  if (!runningSyncPromise) {
    runningSyncPromise = runFullSync(admin).finally(() => {
      runningSyncPromise = null;
    });
  }

  const synced = await runningSyncPromise;
  return {
    total: synced.total,
    lastSyncedAt: new Date(synced.synced_at).getTime(),
  };
}

async function listGroups(admin: ReturnType<typeof getAdminClient>): Promise<string[]> {
  const { data, error } = await admin
    .from('rnc_cultivars_cache')
    .select('grupo_especie')
    .neq('grupo_especie', '');
  if (error) throw error;

  const groups = Array.from(
    new Set(
      (Array.isArray(data) ? data : [])
        .map((row) => String(row.grupo_especie ?? '').trim())
        .filter((value) => value.length > 0),
    ),
  );

  return groups.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function applyBaseFiltersToQuery(
  query: any,
  filters: SearchFilters,
  includeCultivar = true,
) {
  if (filters.nomeComum) {
    query = query.ilike('especie_nome_comum', `%${filters.nomeComum.trim()}%`);
  }
  if (filters.nomeCientifico) {
    query = query.ilike('especie_nome_cientifico', `%${filters.nomeCientifico.trim()}%`);
  }
  if (
    filters.grupoEspecie &&
    normalize(filters.grupoEspecie) !== 'todos'
  ) {
    query = query.eq('grupo_especie', filters.grupoEspecie.trim());
  }
  if (includeCultivar && filters.cultivar) {
    query = query.ilike('cultivar', `%${filters.cultivar.trim()}%`);
  }
  return query;
}

function isSuggestion(candidate: string, input: string): boolean {
  const normalizedCandidate = normalize(candidate);
  const normalizedInput = normalize(input);
  if (!normalizedCandidate || !normalizedInput) return false;
  if (normalizedCandidate.includes(normalizedInput)) return true;
  const distance = levenshtein(normalizedCandidate, normalizedInput);
  const threshold = clamp(Math.floor(normalizedInput.length * 0.35), 1, 4);
  return distance <= threshold;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    const body = await req.json();
    const action = String(body?.action ?? 'search').trim().toLowerCase();
    const admin = getAdminClient();

    if (action === 'sync') {
      const auth = await ensureAuthenticatedUser(req);
      if (auth.error || !auth.user) {
        return new Response(JSON.stringify({ error: auth.error ?? 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!isLikelySuperUser(auth.user)) {
        return new Response(
          JSON.stringify({ error: 'Apenas super usuário pode forçar sincronização.' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const synced = await ensureCacheReady(admin, true);
      return new Response(
        JSON.stringify({
          ok: true,
          source: 'rnc-mapa-cache',
          total: synced.total,
          synced_at: new Date(synced.lastSyncedAt).toISOString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (action !== 'search') {
      return new Response(
        JSON.stringify({ error: 'Action inválida. Use action=search ou action=sync.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    await ensureCacheReady(admin, false);

    const page = Math.max(1, Number(body?.page ?? 1) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(body?.pageSize ?? 50) || 50));
    const filters = (body?.filters ?? {}) as SearchFilters;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    let query = admin
      .from('rnc_cultivars_cache')
      .select(
        'especie_nome_comum,especie_nome_cientifico,cultivar,tipo_registro,grupo_especie,situacao,rnc_detail_url',
        { count: 'exact' },
      );
    query = applyBaseFiltersToQuery(query, filters, true);
    query = query.order('especie_nome_comum', { ascending: true });
    query = query.order('cultivar', { ascending: true });
    query = query.range(start, end);

    const { data, error, count } = await query;
    if (error) throw error;

    let items = Array.isArray(data) ? data : [];
    let total = Number(count ?? items.length) || 0;
    let fallbackUsed = false;

    if (filters.cultivar && total === 0) {
      let fallbackQuery = admin
        .from('rnc_cultivars_cache')
        .select(
          'especie_nome_comum,especie_nome_cientifico,cultivar,tipo_registro,grupo_especie,situacao,rnc_detail_url',
        )
        .order('especie_nome_comum', { ascending: true })
        .order('cultivar', { ascending: true })
        .limit(SUGGESTION_POOL_LIMIT);
      fallbackQuery = applyBaseFiltersToQuery(fallbackQuery, filters, false);
      const { data: candidateRows, error: candidateError } = await fallbackQuery;
      if (candidateError) throw candidateError;

      const suggestions = (Array.isArray(candidateRows) ? candidateRows : [])
        .filter((row) => isSuggestion(String(row.cultivar ?? ''), String(filters.cultivar)))
        .sort((a, b) => {
          const da = levenshtein(normalize(String(a.cultivar ?? '')), normalize(String(filters.cultivar)));
          const db = levenshtein(normalize(String(b.cultivar ?? '')), normalize(String(filters.cultivar)));
          return da - db;
        });

      const paginated = suggestions.slice(start, end + 1);
      items = paginated;
      total = suggestions.length;
      fallbackUsed = suggestions.length > 0;
    }

    const groups = await listGroups(admin);
    const { data: latestSync } = await admin
      .from('rnc_cultivars_cache')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        source: 'rnc-mapa-cache',
        source_url: RNC_SEARCH_URL,
        page,
        page_size: pageSize,
        total,
        groups,
        fallback_used: fallbackUsed,
        cache_updated_at: latestSync?.synced_at ?? null,
        items,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message ?? 'Falha inesperada ao consultar cultivares do RNC.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
