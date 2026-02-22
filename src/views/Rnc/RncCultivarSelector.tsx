import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Pagination,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconExternalLink, IconSearch } from '@tabler/icons-react';
import {
  RNC_CULTIVAR_SELECTED_EVENT,
  type RncCultivarFilters,
  type RncCultivarRecord,
  type RncCultivarSelectionMessage,
  type RncCultivarSelectionPayload,
  searchRncCultivars,
} from '../../services/rncCultivarService';

const PAGE_SIZE = 25;
type RncCultivarSelectorMode = 'popup' | 'catalog' | 'picker';

interface RncCultivarSelectorProps {
  mode?: RncCultivarSelectorMode;
  onSelect?: (payload: RncCultivarSelectionPayload) => void;
}

function normalizeMonth(value?: string | null): string {
  const raw = String(value ?? '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})$/);
  if (!iso) return '';
  const year = Number(iso[1]);
  const month = Number(iso[2]);
  if (year < 1900 || month < 1 || month > 12) return '';
  return `${iso[1]}-${iso[2]}`;
}

function monthOrder(value: string): number {
  const normalized = normalizeMonth(value);
  if (!normalized) return Number.NaN;
  const [yearText, monthText] = normalized.split('-');
  return Number(yearText) * 12 + Number(monthText);
}

function defaultMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear().toString().padStart(4, '0')}-${(now.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}`;
}

function formatMonth(value: string): string {
  const normalized = normalizeMonth(value);
  if (!normalized) return '--';
  const [year, month] = normalized.split('-');
  return `${month}/${year}`;
}

function resolveSpeciesLabel(row: RncCultivarRecord | null): string {
  if (!row) return '-';
  return row.especie_nome_comum || row.especie_nome_cientifico || '-';
}

export default function RncCultivarSelector({
  mode = 'popup',
  onSelect,
}: RncCultivarSelectorProps) {
  const popupMode = mode === 'popup';
  const pickerMode = mode === 'picker';
  const initialFilters: RncCultivarFilters = {
    nomeComum: '',
    nomeCientifico: '',
    cultivar: '',
    grupoEspecie: 'Todos',
  };
  const [filters, setFilters] = useState<RncCultivarFilters>({
    ...initialFilters,
  });
  const [appliedFilters, setAppliedFilters] = useState<RncCultivarFilters>({
    ...initialFilters,
  });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RncCultivarRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState<string[]>([]);
  const [source, setSource] = useState('rnc-mapa-cache');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RncCultivarRecord | null>(null);
  const [periodStart, setPeriodStart] = useState(defaultMonth());
  const [periodEnd, setPeriodEnd] = useState(defaultMonth());
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);
  const [linkScope, setLinkScope] = useState<'species' | 'cultivar'>(() =>
    mode === 'popup' ? 'cultivar' : 'species',
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );

  const groupOptions = useMemo(
    () => [
      { value: 'Todos', label: 'Todos os grupos' },
      ...groups.map((group) => ({ value: group, label: group })),
    ],
    [groups],
  );

  const runSearch = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const response = await searchRncCultivars({
          filters: appliedFilters,
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        setRows(response.items);
        setTotal(response.total);
        setGroups(response.groups);
        setSource(response.source);
        setFallbackUsed(Boolean(response.fallback_used));
        setCacheUpdatedAt(response.cache_updated_at ?? null);
        setSelected((current) => {
          if (!current) return current;
          const stillExists = response.items.some(
            (row) =>
              row.cultivar === current.cultivar &&
              row.especie_nome_cientifico === current.especie_nome_cientifico,
          );
          return stillExists ? current : null;
        });
      } catch (error: any) {
        notifications.show({
          title: 'Falha na consulta do RNC',
          message:
            error?.message ??
            'Não foi possível carregar as cultivares do RNC no momento.',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters],
  );

  useEffect(() => {
    void runSearch(page);
  }, [page, runSearch]);

  const submitFilters = () => {
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ ...initialFilters });
    setAppliedFilters({ ...initialFilters });
    setSelected(null);
    setPage(1);
  };

  const openInOfficialRnc = () => {
    if (!selected) return;
    const query = encodeURIComponent(selected.cultivar || selected.especie_nome_comum);
    const url = `https://sistemas.agricultura.gov.br/snpc/cultivarweb/cultivares_registradas.php?acao=pesquisar&postado=1&txt_denominacao=${query}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const confirmSelection = () => {
    if (!popupMode && !pickerMode) return;

    if (!selected) {
      notifications.show({
        title: 'Selecione uma cultivar',
        message: 'Escolha uma linha da tabela antes de confirmar.',
        color: 'yellow',
      });
      return;
    }

    const start = normalizeMonth(periodStart);
    const end = normalizeMonth(periodEnd);
    if (!start || !end) {
      notifications.show({
        title: 'Período obrigatório',
        message: 'Informe mês/ano inicial e final.',
        color: 'yellow',
      });
      return;
    }
    if (monthOrder(start) > monthOrder(end)) {
      notifications.show({
        title: 'Período inválido',
        message: 'O mês/ano final deve ser maior ou igual ao mês/ano inicial.',
        color: 'yellow',
      });
      return;
    }

    const selectedCultivar = String(selected.cultivar ?? '').trim();
    if (linkScope === 'cultivar' && !selectedCultivar) {
      notifications.show({
        title: 'Cultivar indisponível',
        message: 'A entrada selecionada não possui cultivar para refino.',
        color: 'yellow',
      });
      return;
    }

    const payload: RncCultivarSelectionPayload = {
      cultura: resolveSpeciesLabel(selected),
      cultivar: linkScope === 'cultivar' ? selectedCultivar : undefined,
      especieNomeComum: selected.especie_nome_comum,
      especieNomeCientifico: selected.especie_nome_cientifico,
      grupoEspecie: selected.grupo_especie,
      rncDetailUrl: selected.rnc_detail_url,
      dataInicio: start,
      dataFim: end,
      fonte: 'RNC-MAPA',
    };

    if (pickerMode) {
      onSelect?.(payload);
      return;
    }

    const payloadMessage: RncCultivarSelectionMessage = {
      type: RNC_CULTIVAR_SELECTED_EVENT,
      payload,
    };

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payloadMessage, window.location.origin);
      window.close();
      return;
    }

    notifications.show({
      title: 'Janela principal não encontrada',
      message: 'Abra este seletor a partir do cadastro do talhão.',
      color: 'yellow',
    });
  };

  return (
    <Stack p="md" gap="sm">
      <Group justify="space-between" align="center">
        <div>
          <Title order={3}>
            {popupMode || pickerMode
              ? 'Seleção de espécie/cultivar (RNC/MAPA)'
              : 'Consulta oficial de espécies e cultivares (RNC/MAPA)'}
          </Title>
          <Text size="sm" c="dimmed">
            {popupMode || pickerMode
              ? 'Selecione uma entrada oficial do RNC para usar no talhão.'
              : 'Sem cadastro manual. Esta tela consulta e seleciona dados oficiais do RNC.'}
          </Text>
        </div>
        <Group gap="xs">
          {fallbackUsed ? <Badge color="yellow">Sugestões por semelhança</Badge> : null}
          <Badge color={source === 'rnc-mapa-cache' ? 'teal' : 'yellow'}>
            Fonte: {source === 'rnc-mapa-cache' ? 'RNC (cache local)' : 'Amostra local'}
          </Badge>
        </Group>
      </Group>

      <Alert color="blue" variant="light">
        Busca por nome comum, nome científico e cultivar com fallback para erros de digitação.
      </Alert>

      <Card withBorder p="sm">
        <Stack gap="xs">
          <Group grow>
            <TextInput
              label="Nome comum (espécie)"
              value={filters.nomeComum ?? ''}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFilters((prev) => ({ ...prev, nomeComum: value }));
              }}
            />
            <TextInput
              label="Nome científico (espécie)"
              value={filters.nomeCientifico ?? ''}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFilters((prev) => ({ ...prev, nomeCientifico: value }));
              }}
            />
          </Group>

          <Group grow>
            <TextInput
              label="Cultivar"
              placeholder="Com fallback de semelhantes"
              value={filters.cultivar ?? ''}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFilters((prev) => ({ ...prev, cultivar: value }));
              }}
            />
            <Select
              label="Grupo da espécie"
              data={groupOptions}
              value={filters.grupoEspecie ?? 'Todos'}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, grupoEspecie: value ?? 'Todos' }))
              }
            />
          </Group>

          <Group justify="space-between" align="end">
            <Text size="xs" c="dimmed">
              {cacheUpdatedAt
                ? `Cache atualizado em: ${new Date(cacheUpdatedAt).toLocaleString('pt-BR')}`
                : 'Cache: aguardando primeira sincronização'}
            </Text>
            <Group gap="xs">
              <Button variant="light" color="gray" onClick={clearFilters}>
                Limpar
              </Button>
              <Button leftSection={<IconSearch size={16} />} onClick={submitFilters}>
                Buscar
              </Button>
            </Group>
          </Group>
        </Stack>
      </Card>

      <Card withBorder p="sm">
        <Group justify="space-between" mb="xs">
          <Text fw={600}>Resultado ({total.toLocaleString('pt-BR')} registros)</Text>
          {popupMode || pickerMode ? (
            <Group gap="xs">
              {pickerMode ? (
                <SegmentedControl
                  value={linkScope}
                  onChange={(value) => setLinkScope(value as 'species' | 'cultivar')}
                  data={[
                    { label: 'Vincular espécie', value: 'species' },
                    { label: 'Refinar com cultivar', value: 'cultivar' },
                  ]}
                />
              ) : null}
              <TextInput
                type="month"
                label="Mês/ano inicial"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.currentTarget.value)}
              />
              <TextInput
                type="month"
                label="Mês/ano final"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.currentTarget.value)}
              />
            </Group>
          ) : null}
        </Group>
        {pickerMode ? (
          <Text size="xs" c="dimmed" mb="xs">
            Vínculo por espécie aplica regras gerais. Vínculo com cultivar aplica
            prioridade para dados específicos da cultivar.
          </Text>
        ) : null}

        {loading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
          </Group>
        ) : (
          <ScrollArea h={420}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Selecionar</Table.Th>
                  <Table.Th>Espécie (nome comum)</Table.Th>
                  <Table.Th>Nome científico</Table.Th>
                  <Table.Th>Cultivar</Table.Th>
                  <Table.Th>Tipo de registro</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row, index) => {
                  const isSelected =
                    selected?.cultivar === row.cultivar &&
                    selected?.especie_nome_cientifico === row.especie_nome_cientifico;
                  return (
                    <Table.Tr
                      key={`${row.cultivar}-${row.especie_nome_cientifico}-${index}`}
                      onClick={() => setSelected(row)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Table.Td>
                        <Button
                          size="xs"
                          variant={isSelected ? 'filled' : 'light'}
                          onClick={() => setSelected(row)}
                        >
                          {isSelected ? 'Ativa' : 'Selecionar'}
                        </Button>
                      </Table.Td>
                      <Table.Td>{row.especie_nome_comum || '-'}</Table.Td>
                      <Table.Td>{row.especie_nome_cientifico || '-'}</Table.Td>
                      <Table.Td>{row.cultivar || '-'}</Table.Td>
                      <Table.Td>{row.tipo_registro || '-'}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}

        <Group justify="space-between" mt="sm" align="center">
          <Pagination total={totalPages} value={page} onChange={setPage} />
          <Group gap="xs">
            <Button
              variant="light"
              color="gray"
              leftSection={<IconExternalLink size={14} />}
              disabled={!selected}
              onClick={openInOfficialRnc}
            >
              Abrir no RNC
            </Button>
            {popupMode || pickerMode ? (
              <Button disabled={!selected} onClick={confirmSelection}>
                {pickerMode
                  ? `Vincular ${linkScope === 'cultivar' ? 'com cultivar' : 'espécie'} (${formatMonth(periodStart)} - ${formatMonth(periodEnd)})`
                  : `Usar no talhão (${formatMonth(periodStart)} - ${formatMonth(periodEnd)})`}
              </Button>
            ) : null}
          </Group>
        </Group>
      </Card>

      {selected ? (
        <Card withBorder p="sm">
          <Text fw={700} mb={6}>
            Detalhamento da espécie selecionada
          </Text>
          <Stack gap={4}>
            <Text size="sm">
              <b>Espécie (nome comum):</b> {selected.especie_nome_comum || '-'}
            </Text>
            <Text size="sm">
              <b>Nome científico:</b> {selected.especie_nome_cientifico || '-'}
            </Text>
            <Text size="sm">
              <b>Cultivar:</b> {selected.cultivar || '-'}
            </Text>
            <Text size="sm">
              <b>Tipo de registro:</b> {selected.tipo_registro || '-'}
            </Text>
            <Text size="sm">
              <b>Grupo da espécie:</b> {selected.grupo_especie || '-'}
            </Text>
            <Text size="sm">
              <b>Situação:</b> {selected.situacao || '-'}
            </Text>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
