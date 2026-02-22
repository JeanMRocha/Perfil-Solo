import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Grid,
  Group,
  Menu,
  Modal,
  NumberInput,
  Progress,
  RangeSlider,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  IconDotsVertical,
  IconMail,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import ContactInfoModal from '../../components/modals/ContactInfoModal';
import {
  exportPropertySnapshotToPdf,
  openPropertyDeleteGuardModal,
} from '../../components/Propriedades/PropertyDeleteGuardModal';
import { analisesMock, AnaliseSolo } from '../../data/analisesMock';
import { getSoilParams, summarizeRanges } from '../../services/soilParamsService';
import { $currUser } from '../../global-state/user';
import {
  type AnalysisRow,
  createPropertyForUser,
  deletePropertyForUser,
  fetchAnalysesByProperty,
  fetchAnalysesByTalhao,
  fetchOrCreateUserProperties,
  fetchTalhoesByProperty,
  saveLinkedAnalysis as persistLinkedAnalysis,
  updatePropertyForUser,
} from '../../services/propertyMapService';
import { NormalizationService } from '../../services/NormalizationService';
import { CalagemService } from '../../services/calculations/CalagemService';
import { GessagemService } from '../../services/calculations/GessagemService';
import { AdubacaoService } from '../../services/calculations/AdubacaoService';
import { dataProviderLabel, isLocalDataMode } from '../../services/dataProvider';
import {
  listLaboratories,
  type LaboratoryRecord,
} from '../../services/laboratoriesService';
import { getSystemBrand } from '../../services/systemConfigService';
import { loadPropertyDeletionSnapshot } from '../../services/propertySnapshotService';
import type { Property, Talhao } from '../../types/property';
import {
  getPrimaryEmail,
  getPrimaryPhone,
  type ContactInfo,
} from '../../types/contact';

type ModuleKey = 'analise' | 'calagem' | 'gessagem' | 'adubacao';
type RowStatus = 'ok' | 'attention' | 'critical' | 'info';
type AnalysisViewMode = 'list' | 'detail';

type SideMenuItem = { id: string; label: string; hint: string };
type PropertyModalMode = 'create' | 'edit';
type InspectRow = {
  id: string;
  label: string;
  value: string;
  status: RowStatus;
  description: string;
  action: string;
  detailSteps?: string[];
  editableKey?: string;
  numericValue?: number;
};

const MODULE_OPTIONS: { value: ModuleKey; label: string }[] = [
  { value: 'analise', label: 'Análise' },
  { value: 'calagem', label: 'Calagem' },
  { value: 'gessagem', label: 'Gessagem' },
  { value: 'adubacao', label: 'Adubacao' },
];

const SIDE_MENU: Record<ModuleKey, SideMenuItem[]> = {
  analise: [
    { id: 'a1', label: 'Visao Geral', hint: 'Indicadores principais' },
    { id: 'a2', label: 'Macronutrientes', hint: 'P, K, Ca, Mg...' },
    { id: 'a3', label: 'Micronutrientes', hint: 'S, Zn, Fe, Cu...' },
  ],
  calagem: [
    { id: 'c1', label: 'Resumo NC', hint: 'Dose e saturacao' },
    { id: 'c2', label: 'Formula', hint: 'Passo a passo' },
    { id: 'c3', label: 'Riscos', hint: 'Avisos de manejo' },
  ],
  gessagem: [
    { id: 'g1', label: 'Resumo NG', hint: 'Diagnostico e dose' },
    { id: 'g2', label: 'Criterios', hint: 'm%, Ca e Argila' },
    { id: 'g3', label: 'Riscos', hint: 'Limites e cuidados' },
  ],
  adubacao: [
    { id: 'd1', label: 'NPK', hint: 'Recomendacao principal' },
    { id: 'd2', label: 'Ajustes', hint: 'Por faixa e idade' },
    { id: 'd3', label: 'Plano', hint: 'Prioridades de execucao' },
  ],
};

const DEFAULT_UNITS: Record<string, string> = {
  pH: 'pH',
  P: 'mg/dm3',
  K: 'mg/dm3',
  Ca: 'cmolc/dm3',
  Mg: 'cmolc/dm3',
  Al: 'cmolc/dm3',
  'M.O.': '%',
  MO: '%',
  'V%': '%',
  'm%': '%',
  'H+Al': 'cmolc/dm3',
  SB: 'cmolc/dm3',
  CTC: 'cmolc/dm3',
  Argila: '%',
  S: 'mg/dm3',
  Zn: 'mg/dm3',
  Cu: 'mg/dm3',
  Fe: 'mg/dm3',
  Mn: 'mg/dm3',
  B: 'mg/dm3',
};

const HISTORY_COMPARE_KEYS = ['pH', 'P', 'K', 'Ca', 'Mg', 'V%', 'm%', 'MO'];

const DETAIL_LIBRARY: Record<
  ModuleKey,
  Record<string, { context: string; why: string; steps: string[] }>
> = {
  analise: {
    a1: {
      context: 'Indicadores de base para leitura rapida da fertilidade atual.',
      why: 'Define risco imediato e priorizacao de correcao antes da adubacao.',
      steps: [
        'Confirmar coerencia de pH, V% e m% com laudo original.',
        'Classificar cada indicador em critico, atencao ou estavel.',
        'Abrir plano de correcao apenas para os itens criticos.',
      ],
    },
    a2: {
      context: 'Macronutrientes estruturam produtividade e resposta economica.',
      why: 'Desequilibrio entre P, K, Ca e Mg derruba eficiencia do manejo.',
      steps: [
        'Comparar teores com a faixa ideal por cultura e estagio.',
        'Definir nutriente limitante principal.',
        'Alinhar recomendacao com custo e janela operacional.',
      ],
    },
    a3: {
      context: 'Micronutrientes influenciam qualidade e estabilidade da safra.',
      why: 'Deficiencias pequenas podem causar perdas silenciosas relevantes.',
      steps: [
        'Validar se o laboratorio reportou todos os micros da rotina.',
        'Mapear deficiencias com maior impacto no talhão.',
        'Programar correcao gradativa e novo monitoramento.',
      ],
    },
  },
  calagem: {
    c1: {
      context: 'Resumo executivo da necessidade de calagem (NC).',
      why: 'Dose correta evita subcorrecao e reduz risco de supercalagem.',
      steps: [
        'Conferir V1 atual e V2 alvo adotado para a cultura.',
        'Validar dose final por PRNT real do corretivo.',
        'Ajustar logistica de aplicacao por talhão.',
      ],
    },
    c2: {
      context: 'Transparencia tecnica do calculo com passo a passo.',
      why: 'Fortalece confianca do cliente e rastreabilidade da recomendacao.',
      steps: [
        'Revisar todos os passos matematicos da execucao.',
        'Documentar premissas tecnicas usadas no laudo.',
        'Salvar versao para comparacoes futuras.',
      ],
    },
    c3: {
      context: 'Painel de risco agronomico da estrategia de calagem.',
      why: 'Antecipar risco reduz retrabalho e perda financeira.',
      steps: [
        'Verificar alertas de dose alta e relacoes de bases.',
        'Avaliar necessidade de parcelamento.',
        'Definir acompanhamento pos-aplicacao.',
      ],
    },
  },
  gessagem: {
    g1: {
      context: 'Diagnostico rapido da necessidade de gessagem (NG).',
      why: 'Gesso corrige limitacoes em profundidade e melhora raiz.',
      steps: [
        'Conferir NG e textura para definir viabilidade.',
        'Cruzar com histórico de chuva e resposta da area.',
        'Programar aplicacao no melhor timing operacional.',
      ],
    },
    g2: {
      context: 'Criterios tecnicos m%, Ca e argila para decisao.',
      why: 'Evita uso indevido de gesso e melhora eficiencia da dose.',
      steps: [
        'Checar m% e Ca trocavel nos horizontes avaliados.',
        'Aplicar fator de ajuste pela classe textural.',
        'Consolidar recomendacao com justificativa tecnica.',
      ],
    },
    g3: {
      context: 'Riscos e limites operacionais da gessagem.',
      why: 'Controle de risco preserva equilibrio de Ca, Mg e K.',
      steps: [
        'Ler alertas do motor para restricoes de dose.',
        'Definir plano de monitoramento apos aplicacao.',
        'Revalidar necessidade no próximo ciclo de análise.',
      ],
    },
  },
  adubacao: {
    d1: {
      context: 'Resumo da recomendacao NPK por talhão.',
      why: 'NPK direciona retorno produtivo e previsibilidade de custo.',
      steps: [
        'Classificar nutriente prioritario para curto prazo.',
        'Definir dose alvo considerando estadio da cultura.',
        'Sincronizar recomendacao com plano de compra.',
      ],
    },
    d2: {
      context: 'Regras e ajustes aplicados no calculo da adubacao.',
      why: 'Mostra racional tecnico e evita recomendacao de caixa-preta.',
      steps: [
        'Auditar ajustes aplicados por faixa ideal.',
        'Comparar com histórico da propriedade.',
        'Registrar excecoes tecnicas no laudo final.',
      ],
    },
    d3: {
      context: 'Plano de execucao com prioridade de nutrientes.',
      why: 'Sequenciamento correto acelera resposta e reduz desperdicio.',
      steps: [
        'Executar primeiro o nutriente mais limitante.',
        'Programar parcelamentos conforme risco de perda.',
        'Definir data de reavaliacao por indicador-chave.',
      ],
    },
  },
};

function mapDepthToEnum(depth: string): '0-10' | '0-20' | '20-40' | 'outra' {
  const normalized = depth.toLowerCase();
  if (normalized.includes('0-10')) return '0-10';
  if (normalized.includes('0-20')) return '0-20';
  if (normalized.includes('20-40')) return '20-40';
  return 'outra';
}

function toAgeInMonths(ageText?: string): number | null {
  if (!ageText) return null;

  const normalized = ageText
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!normalized) return null;

  const yearMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(ano|anos)\b/);
  const monthMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(mes|meses)\b/);

  const years = yearMatch ? Number(yearMatch[1].replace(',', '.')) : 0;
  const months = monthMatch ? Number(monthMatch[1].replace(',', '.')) : 0;

  if (yearMatch || monthMatch) {
    const total = Math.round((Number.isFinite(years) ? years : 0) * 12 + (Number.isFinite(months) ? months : 0));
    return total > 0 ? total : null;
  }

  const firstNumber = normalized.match(/\d+(?:[.,]\d+)?/);
  if (!firstNumber) return null;
  const parsed = Number(firstNumber[0].replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

function asNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatValue(value: number, decimals = 2): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function normalizePropertyName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function statusColor(status: RowStatus): string {
  if (status === 'ok') return 'green';
  if (status === 'critical') return 'red';
  if (status === 'attention') return 'yellow';
  return 'gray';
}

function statusLabel(status: RowStatus): string {
  if (status === 'ok') return 'Estavel';
  if (status === 'critical') return 'Critico';
  if (status === 'attention') return 'Atencao';
  return 'Informativo';
}

function statusProgress(status: RowStatus): number {
  if (status === 'critical') return 25;
  if (status === 'attention') return 50;
  if (status === 'ok') return 90;
  return 65;
}

function asNullableNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getAnalysisDateLike(row: Pick<AnalysisRow, 'data_amostragem' | 'created_at'>): string | null {
  if (typeof row.data_amostragem === 'string' && row.data_amostragem.length > 0) {
    return row.data_amostragem;
  }
  if (typeof row.created_at === 'string' && row.created_at.length > 0) {
    return row.created_at;
  }
  return null;
}

function toTimeValue(dateLike: string | null): number {
  if (!dateLike) return 0;
  const time = new Date(dateLike).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatDateLabel(dateLike: string | null): string {
  if (!dateLike) return '--';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('pt-BR');
}

function formatDateTimeLabel(dateLike: string | null): string {
  if (!dateLike) return '--';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('pt-BR');
}

function formatLaboratorioLabel(value: unknown): string {
  if (typeof value !== 'string') return 'Não informado';
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : 'Não informado';
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function readContainerValue(
  source: Record<string, any> | undefined,
  key: string,
): number | null {
  if (!source) return null;
  const aliases = key === 'MO' ? ['MO', 'M.O.'] : [key];
  for (const alias of aliases) {
    const raw = source[alias];
    if (raw == null) continue;
    if (typeof raw === 'object' && raw !== null && 'value' in raw) {
      const wrapped = asNullableNumber((raw as { value?: unknown }).value);
      if (wrapped != null) return wrapped;
    }
    const direct = asNullableNumber(raw);
    if (direct != null) return direct;
  }
  return null;
}

function readAnalysisNutrient(row: AnalysisRow, key: string): number | null {
  const normalized = (row.normalized ?? {}) as Record<string, any>;
  const raw = (row.raw ?? {}) as Record<string, any>;
  return readContainerValue(normalized, key) ?? readContainerValue(raw, key);
}

export default function CadastroAnaliseSolo() {
  const user = useStore($currUser);
  const currentUserId = user?.id ?? (isLocalDataMode ? 'local-user' : null);

  const [moduleTab, setModuleTab] = useState<ModuleKey>('analise');
  const [selectedSideId, setSelectedSideId] = useState<string>(SIDE_MENU.analise[0].id);
  const [selectedInspectId, setSelectedInspectId] = useState<string | null>(null);

  const [analises] = useState<AnaliseSolo[]>(analisesMock);
  const [analise, setAnalise] = useState<AnaliseSolo>(analisesMock[0]);
  const [values, setValues] = useState<Record<string, number>>(analisesMock[0].nutrientes);
  const [idealRanges, setIdealRanges] = useState<Record<string, [number, number]>>(analisesMock[0].faixaIdeal);

  const [properties, setProperties] = useState<Property[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedTalhaoId, setSelectedTalhaoId] = useState<string | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisRow[]>([]);
  const [historyRange, setHistoryRange] = useState<[number, number]>([0, 0]);
  const [propertyModalMode, setPropertyModalMode] = useState<PropertyModalMode | null>(null);
  const [propertyDraftName, setPropertyDraftName] = useState('');
  const [savingProperty, setSavingProperty] = useState(false);
  const [propertyContactModalOpened, setPropertyContactModalOpened] = useState(false);
  const [savingPropertyContact, setSavingPropertyContact] = useState(false);
  const [analysisViewMode, setAnalysisViewMode] = useState<AnalysisViewMode>('list');
  const [analysisListRows, setAnalysisListRows] = useState<AnalysisRow[]>([]);
  const [loadingAnalysisList, setLoadingAnalysisList] = useState(false);
  const [selectedAnalysisRowId, setSelectedAnalysisRowId] = useState<string | null>(null);
  const [analysisListDateRange, setAnalysisListDateRange] = useState<[number, number]>([0, 0]);
  const [analysisListLaboratorio, setAnalysisListLaboratorio] = useState<string | null>(null);
  const [laboratories, setLaboratories] = useState<LaboratoryRecord[]>([]);
  const [selectedOrderLabId, setSelectedOrderLabId] = useState<string | null>(null);
  const [orderServiceIds, setOrderServiceIds] = useState<string[]>([]);
  const [orderSamplesCount, setOrderSamplesCount] = useState<number | ''>(1);

  const amostrasOptions = useMemo(() => analises.map((a) => a.codigo_amostra), [analises]);
  const propertyOptions = useMemo(() => properties.map((property) => ({ value: property.id, label: property.nome })), [properties]);
  const talhaoOptions = useMemo(() => talhoes.map((talhao) => ({ value: talhao.id, label: talhao.nome })), [talhoes]);

  const selectedProperty = useMemo(() => properties.find((item) => item.id === selectedPropertyId) ?? null, [properties, selectedPropertyId]);
  const selectedPropertyContact = useMemo<ContactInfo>(() => {
    if (!selectedProperty) return {};
    if (selectedProperty.contato_detalhes) return selectedProperty.contato_detalhes;
    return {
      email: selectedProperty.contato ?? '',
      phone: '',
      address: '',
    };
  }, [selectedProperty]);
  const selectedTalhao = useMemo(() => talhoes.find((item) => item.id === selectedTalhaoId) ?? null, [talhoes, selectedTalhaoId]);
  const laboratoryOptions = useMemo(
    () =>
      laboratories.map((lab) => ({
        value: lab.id,
        label: lab.nome,
      })),
    [laboratories],
  );
  const selectedOrderLab = useMemo(
    () => laboratories.find((lab) => lab.id === selectedOrderLabId) ?? null,
    [laboratories, selectedOrderLabId],
  );
  const manualLaboratoryName = `${getSystemBrand().name} Manual`;
  const selectedOrderServices = useMemo(() => {
    if (!selectedOrderLab) return [];
    return selectedOrderLab.servicos.filter((service) =>
      orderServiceIds.includes(service.id),
    );
  }, [selectedOrderLab, orderServiceIds]);
  const estimatedOrderTotal = useMemo(() => {
    const samples = Number(orderSamplesCount);
    if (!Number.isFinite(samples) || samples <= 0) return 0;
    const unitTotal = selectedOrderServices.reduce(
      (sum, service) => sum + Number(service.preco || 0),
      0,
    );
    return unitTotal * samples;
  }, [selectedOrderServices, orderSamplesCount]);
  const talhaoNameById = useMemo(() => {
    const map = new Map<string, string>();
    talhoes.forEach((talhao) => map.set(talhao.id, talhao.nome));
    return map;
  }, [talhoes]);
  const analysisRowsAsc = useMemo(
    () =>
      [...analysisListRows].sort(
        (a, b) =>
          toTimeValue(getAnalysisDateLike(a)) - toTimeValue(getAnalysisDateLike(b)),
      ),
    [analysisListRows],
  );
  const analysisListLaboratorioOptions = useMemo(() => {
    const uniq = new Set<string>();
    analysisListRows.forEach((row) => uniq.add(formatLaboratorioLabel(row.laboratorio)));
    return Array.from(uniq)
      .sort((a, b) => a.localeCompare(b))
      .map((label) => ({ value: label, label }));
  }, [analysisListRows]);
  const analysisListMarks = useMemo(() => {
    const len = analysisRowsAsc.length;
    if (!len) return [];
    const interval = Math.max(1, Math.ceil(len / 5));
    return analysisRowsAsc
      .map((row, index) => {
        if (index !== 0 && index !== len - 1 && index % interval !== 0) return null;
        return {
          value: index,
          label: formatDateLabel(getAnalysisDateLike(row)),
        };
      })
      .filter((item): item is { value: number; label: string } => item !== null);
  }, [analysisRowsAsc]);
  const analysisListDateWindow = useMemo(() => {
    if (!analysisRowsAsc.length) return { minTime: 0, maxTime: Number.MAX_SAFE_INTEGER };
    const maxIndex = analysisRowsAsc.length - 1;
    const fromIndex = Math.max(0, Math.min(analysisListDateRange[0], maxIndex));
    const toIndex = Math.max(0, Math.min(analysisListDateRange[1], maxIndex));
    const fromRow = analysisRowsAsc[Math.min(fromIndex, toIndex)] ?? null;
    const toRow = analysisRowsAsc[Math.max(fromIndex, toIndex)] ?? null;
    return {
      minTime: toTimeValue(getAnalysisDateLike(fromRow)),
      maxTime: toTimeValue(getAnalysisDateLike(toRow)),
    };
  }, [analysisRowsAsc, analysisListDateRange]);
  const filteredAnalysisList = useMemo(() => {
    return analysisListRows
      .filter((row) => {
        const rowTime = toTimeValue(getAnalysisDateLike(row));
        if (rowTime < analysisListDateWindow.minTime || rowTime > analysisListDateWindow.maxTime) {
          return false;
        }
        if (!analysisListLaboratorio) return true;
        return formatLaboratorioLabel(row.laboratorio) === analysisListLaboratorio;
      })
      .sort(
        (a, b) =>
          toTimeValue(getAnalysisDateLike(b)) - toTimeValue(getAnalysisDateLike(a)),
      );
  }, [analysisListRows, analysisListDateWindow, analysisListLaboratorio]);
  const selectedAnalysisRow = useMemo(
    () =>
      filteredAnalysisList.find((row) => row.id === selectedAnalysisRowId) ??
      filteredAnalysisList[0] ??
      null,
    [filteredAnalysisList, selectedAnalysisRowId],
  );
  const sideMenuItems = SIDE_MENU[moduleTab];
  const selectedSideItem = sideMenuItems.find((item) => item.id === selectedSideId) ?? sideMenuItems[0] ?? null;
  const normalizedPropertyDraft = useMemo(
    () => normalizePropertyName(propertyDraftName),
    [propertyDraftName],
  );
  const propertyNameInUse = useMemo(() => {
    const candidate = normalizedPropertyDraft.toLowerCase();
    if (!candidate) return false;
    return properties.some((property) => {
      if (propertyModalMode === 'edit' && property.id === selectedPropertyId) return false;
      return normalizePropertyName(property.nome).toLowerCase() === candidate;
    });
  }, [normalizedPropertyDraft, properties, propertyModalMode, selectedPropertyId]);
  const propertyDraftError = useMemo(() => {
    if (!propertyModalMode) return null;
    if (!normalizedPropertyDraft) return 'Informe o nome da propriedade.';
    if (normalizedPropertyDraft.length < 3) return 'Use pelo menos 3 caracteres.';
    if (normalizedPropertyDraft.length > 70) return 'Use no maximo 70 caracteres.';
    if (propertyNameInUse) return 'Ja existe propriedade com este nome.';
    return null;
  }, [propertyModalMode, normalizedPropertyDraft, propertyNameInUse]);
  const historyRowsAsc = useMemo(
    () =>
      [...analysisHistory].sort(
        (a, b) =>
          toTimeValue(getAnalysisDateLike(a)) - toTimeValue(getAnalysisDateLike(b)),
      ),
    [analysisHistory],
  );
  const historyDateOptions = useMemo(
    () =>
      historyRowsAsc.map((row, index) => ({
        value: String(index),
        label: `${formatDateLabel(getAnalysisDateLike(row))} | ${formatLaboratorioLabel(row.laboratorio)}`,
      })),
    [historyRowsAsc],
  );

  const refreshHistory = useCallback(async () => {
    if (!selectedTalhaoId) {
      setAnalysisHistory([]);
      setHistoryRange([0, 0]);
      return;
    }

    setLoadingHistory(true);
    try {
      const loaded = await fetchAnalysesByTalhao(selectedTalhaoId);
      setAnalysisHistory(loaded);
      if (loaded.length <= 1) {
        setHistoryRange([0, 0]);
      } else {
        setHistoryRange([loaded.length - 2, loaded.length - 1]);
      }
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao carregar histórico',
        message: err?.message ?? 'Não foi possível carregar o histórico da area.',
        color: 'red',
      });
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedTalhaoId]);

  const refreshAnalysisList = useCallback(async () => {
    if (!selectedPropertyId) {
      setAnalysisListRows([]);
      setSelectedAnalysisRowId(null);
      setAnalysisListDateRange([0, 0]);
      return;
    }

    setLoadingAnalysisList(true);
    try {
      const rows = selectedTalhaoId
        ? await fetchAnalysesByTalhao(selectedTalhaoId)
        : await fetchAnalysesByProperty(selectedPropertyId);

      setAnalysisListRows(rows);
      setSelectedAnalysisRowId((prev) =>
        prev && rows.some((row) => row.id === prev) ? prev : rows[0]?.id ?? null,
      );
      if (rows.length <= 1) {
        setAnalysisListDateRange([0, 0]);
      } else {
        setAnalysisListDateRange([0, rows.length - 1]);
      }
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao carregar listagem',
        message: err?.message ?? 'Não foi possível carregar as análises cadastradas.',
        color: 'red',
      });
    } finally {
      setLoadingAnalysisList(false);
    }
  }, [selectedPropertyId, selectedTalhaoId]);

  const refreshLaboratories = useCallback(async () => {
    const rows = await listLaboratories(currentUserId ?? undefined);
    setLaboratories(rows);
    setSelectedOrderLabId((prev) =>
      prev && rows.some((row) => row.id === prev) ? prev : rows[0]?.id ?? null,
    );
  }, [currentUserId]);

  useEffect(() => {
    setSelectedSideId(sideMenuItems[0]?.id ?? '');
  }, [moduleTab]);

  useEffect(() => {
    let alive = true;
    const loadProperties = async () => {
      if (!currentUserId) return;
      setLoadingLinks(true);
      try {
        const loaded = await fetchOrCreateUserProperties(currentUserId);
        if (!alive) return;
        setProperties(loaded);
        setSelectedPropertyId((prev) => prev ?? loaded[0]?.id ?? null);
      } catch (err: any) {
        notifications.show({
          title: 'Falha ao carregar propriedades',
          message: err?.message ?? 'Não foi possível carregar propriedades.',
          color: 'red',
        });
      } finally {
        if (alive) setLoadingLinks(false);
      }
    };
    void loadProperties();
    return () => {
      alive = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    let alive = true;
    const loadTalhoes = async () => {
      if (!selectedPropertyId) {
        setTalhoes([]);
        setSelectedTalhaoId(null);
        return;
      }
      setLoadingLinks(true);
      try {
        const loaded = await fetchTalhoesByProperty(selectedPropertyId);
        if (!alive) return;
        setTalhoes(loaded);
        setSelectedTalhaoId((prev) => {
          if (prev && loaded.some((talhao) => talhao.id === prev)) return prev;
          return loaded[0]?.id ?? null;
        });
      } catch (err: any) {
        notifications.show({
          title: 'Falha ao carregar talhões',
          message: err?.message ?? 'Não foi possível carregar os talhões.',
          color: 'red',
        });
      } finally {
        if (alive) setLoadingLinks(false);
      }
    };
    void loadTalhoes();
    return () => {
      alive = false;
    };
  }, [selectedPropertyId]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    void refreshAnalysisList();
  }, [refreshAnalysisList]);

  useEffect(() => {
    void refreshLaboratories();
  }, [refreshLaboratories]);

  useEffect(() => {
    setSelectedAnalysisRowId((prev) => {
      if (prev && filteredAnalysisList.some((row) => row.id === prev)) return prev;
      return filteredAnalysisList[0]?.id ?? null;
    });
  }, [filteredAnalysisList]);

  useEffect(() => {
    if (!selectedOrderLab) {
      setOrderServiceIds([]);
      return;
    }
    const validIds = new Set(selectedOrderLab.servicos.map((service) => service.id));
    setOrderServiceIds((prev) => {
      const filtered = prev.filter((serviceId) => validIds.has(serviceId));
      if (filtered.length > 0) return filtered;
      return selectedOrderLab.servicos.map((service) => service.id);
    });
  }, [selectedOrderLab]);

  useEffect(() => {
    if (!selectedAnalysisRow || !laboratories.length) return;
    const rowLab = formatLaboratorioLabel(selectedAnalysisRow.laboratorio).toLowerCase();
    const matched = laboratories.find(
      (lab) => lab.nome.trim().toLowerCase() === rowLab,
    );
    if (!matched) return;
    setSelectedOrderLabId((prev) => prev ?? matched.id);
  }, [selectedAnalysisRow, laboratories]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const q = {
          cultura: analise.cultura,
          variedade: analise.variedade,
          estado: analise.estado,
          cidade: analise.cidade,
          extrator: 'mehlich-1',
          estagio: analise.estagio ?? 'producao',
          idade_meses: toAgeInMonths(analise.idade),
        };
        const params = await getSoilParams(q);
        if (!alive || !params?.ideal) return;
        setIdealRanges(params.ideal);
        notifications.show({
          title: 'Faixas ideais aplicadas',
          message: summarizeRanges(params.ideal),
          color: 'teal',
        });
      } catch {
        if (!alive) return;
        notifications.show({
          title: 'Falha ao aplicar faixas',
          message: 'Não foi possível carregar os parametros da cultura.',
          color: 'red',
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [analise.cultura, analise.variedade, analise.estado, analise.cidade, analise.estagio, analise.idade]);

  const calculations = useMemo(() => {
    try {
      const raw: Record<string, any> = {};
      for (const [key, value] of Object.entries(values)) {
        const nutrientKey = key === 'M.O.' ? 'MO' : key;
        raw[nutrientKey] = {
          value: asNumber(value),
          unit: DEFAULT_UNITS[key] ?? '%',
        };
      }

      const nowIso = new Date().toISOString();
      const processed = NormalizationService.processContainer({
        id: crypto.randomUUID(),
        user_id: currentUserId ?? 'local-user',
        property_id: selectedPropertyId ?? 'na',
        talhao_id: selectedTalhaoId ?? 'na',
        data_amostragem: nowIso.slice(0, 10),
        profundidade: mapDepthToEnum(analise.profundidade),
        laboratorio_id: selectedOrderLabId ?? undefined,
        laboratorio: selectedOrderLab?.nome ?? manualLaboratoryName,
        raw: raw as any,
      });

      const normalizedData = (processed.normalized ?? {}) as Record<string, any>;
      const calcInput = {
        analysisId: String(processed.id ?? crypto.randomUUID()),
        normalizedData,
        params: {
          V2: 70,
          PRNT: 90,
          cultura: analise.cultura,
          idade_meses: toAgeInMonths(analise.idade),
          idealRanges,
          profundidade: analise.profundidade,
        },
        rulesetVersion: 'v1',
      };

      return {
        normalizedData,
        alerts: processed.alerts ?? [],
        calagem: CalagemService.calculate(calcInput).execution,
        gessagem: GessagemService.calculate(calcInput).execution,
        adubacao: AdubacaoService.calculate(calcInput).execution,
      };
    } catch {
      return null;
    }
  }, [values, currentUserId, selectedPropertyId, selectedTalhaoId, analise.profundidade, analise.cultura, analise.idade, idealRanges, selectedOrderLab]);

  const rows = useMemo<InspectRow[]>(() => {
    const list: InspectRow[] = [];
    const normalized = calculations?.normalizedData ?? {};

    const valOf = (key: string) => {
      if (typeof values[key] === 'number') return values[key];
      if (key === 'MO' && typeof values['M.O.'] === 'number') return values['M.O.'];
      return asNumber(normalized[key]?.value);
    };

    if (moduleTab === 'analise') {
      const keys = selectedSideId === 'a1'
        ? ['pH', 'V%', 'm%', 'MO']
        : selectedSideId === 'a2'
          ? ['P', 'K', 'Ca', 'Mg', 'Al', 'H+Al', 'SB', 'CTC', 'Argila']
          : ['S', 'Zn', 'Cu', 'Fe', 'Mn', 'B'];

      keys.forEach((key) => {
        const value = valOf(key);
        if (selectedSideId === 'a3' && value <= 0) return;
        const ideal = idealRanges[key] ?? idealRanges[key === 'MO' ? 'M.O.' : key];
        const status: RowStatus = !ideal ? 'info' : value < ideal[0] ? 'critical' : value > ideal[1] ? 'attention' : 'ok';
        list.push({
          id: `n-${key}`,
          label: key,
          value: `${formatValue(value)} ${DEFAULT_UNITS[key] ?? ''}`.trim(),
          status,
          description: ideal
            ? `Faixa ideal: ${ideal[0]} - ${ideal[1]} ${DEFAULT_UNITS[key] ?? ''}`
            : 'Sem faixa ideal configurada.',
          action: status === 'ok'
            ? 'Manter manejo e acompanhar histórico.'
            : status === 'critical'
              ? 'Priorizar correcao deste indicador no plano.'
              : 'Recalibrar dose e reavaliar em nova coleta.',
          editableKey: key,
          numericValue: value,
        });
      });

      if (!list.length) {
        list.push({
          id: 'a-empty',
          label: 'Micronutrientes',
          value: 'Sem dados',
          status: 'info',
          description: 'Não ha dados dessa categoria nesta amostra.',
          action: 'Solicitar inclusao desses parametros no laudo.',
        });
      }
    }

    if (moduleTab === 'calagem') {
      const outputs = calculations?.calagem?.outputs ?? {};
      const warnings = calculations?.calagem?.warnings ?? [];
      if (selectedSideId === 'c1') {
        list.push(
          {
            id: 'c-nc',
            label: 'Necessidade de Calagem (NC)',
            value: `${formatValue(asNumber(outputs.NC), 2)} t/ha`,
            status: asNumber(outputs.NC) > 5 ? 'attention' : 'ok',
            description: 'Dose calculada pelo metodo de saturacao por bases.',
            action: 'Planejar aplicacao e disponibilidade de corretivo.',
          },
          {
            id: 'c-v1',
            label: 'V% atual',
            value: `${formatValue(asNumber(outputs.V1), 1)} %`,
            status: asNumber(outputs.V1) < 50 ? 'critical' : 'ok',
            description: 'Saturacao por bases atual da amostra.',
            action: 'Comparar V% atual com alvo da cultura.',
          },
        );
      } else if (selectedSideId === 'c2') {
        (calculations?.calagem?.explain_steps ?? []).slice(0, 8).forEach((step: string, i: number) => {
          list.push({
            id: `c-step-${i}`,
            label: `Passo ${i + 1}`,
            value: 'Explicacao tecnica',
            status: 'info',
            description: step,
            action: 'Usar este passo no laudo tecnico.',
          });
        });
      } else {
        if (!warnings.length) {
          list.push({
            id: 'c-safe',
            label: 'Riscos de calagem',
            value: 'Sem alertas criticos',
            status: 'ok',
            description: 'Nenhum risco relevante identificado.',
            action: 'Executar plano com monitoramento normal.',
          });
        } else {
          warnings.forEach((warning: string, i: number) => {
            list.push({
              id: `c-w-${i}`,
              label: `Risco ${i + 1}`,
              value: 'Atencao',
              status: 'attention',
              description: warning,
              action: 'Avaliar parcelamento e viabilidade operacional.',
            });
          });
        }
      }
    }

    if (moduleTab === 'gessagem') {
      const outputs = calculations?.gessagem?.outputs ?? {};
      const normalized = calculations?.normalizedData ?? {};
      const warnings = calculations?.gessagem?.warnings ?? [];

      if (selectedSideId === 'g1') {
        const ng = asNumber(outputs.NG);
        list.push({
          id: 'g-ng',
          label: 'Necessidade de Gesso (NG)',
          value: `${formatValue(ng, 2)} t/ha`,
          status: ng > 0 ? 'attention' : 'ok',
          description: 'Dose estimada para melhoria do perfil.',
          action: ng > 0 ? 'Planejar aplicacao conforme textura e logistica.' : 'Sem necessidade imediata de gessagem.',
        });
      } else if (selectedSideId === 'g2') {
        const m = asNumber(normalized['m%']?.value);
        const ca = asNumber(normalized.Ca?.value);
        const argila = asNumber(normalized.Argila?.value);
        list.push(
          {
            id: 'g-m',
            label: 'Saturacao por Al (m%)',
            value: `${formatValue(m, 1)} %`,
            status: m > 20 ? 'critical' : 'ok',
            description: 'Criterio base para diagnostico de gessagem.',
            action: 'Se m% elevado, priorizar amelioracao em profundidade.',
          },
          {
            id: 'g-ca',
            label: 'Calcio trocavel',
            value: `${formatValue(ca, 2)} cmolc/dm3`,
            status: ca < 0.5 ? 'critical' : 'ok',
            description: 'Baixo Ca em profundidade indica resposta a gesso.',
            action: 'Validar diagnostico com histórico da area.',
          },
          {
            id: 'g-argila',
            label: 'Argila',
            value: `${formatValue(argila, 1)} %`,
            status: 'info',
            description: 'Textura influencia fator de dose.',
            action: 'Ajustar fator regional conforme classe textural.',
          },
        );
      } else {
        if (!warnings.length) {
          list.push({
            id: 'g-safe',
            label: 'Riscos de gessagem',
            value: 'Controlado',
            status: 'ok',
            description: 'Sem riscos criticos apontados pelo motor.',
            action: 'Manter monitoramento de Ca e Mg.',
          });
        } else {
          warnings.forEach((warning: string, i: number) => {
            list.push({
              id: `g-w-${i}`,
              label: `Risco ${i + 1}`,
              value: 'Atencao',
              status: 'attention',
              description: warning,
              action: 'Revisar dose e momento de aplicacao.',
            });
          });
        }
      }
    }

    if (moduleTab === 'adubacao') {
      const outputs = calculations?.adubacao?.outputs ?? {};
      const recN = asNumber(outputs.Rec_N);
      const recP = asNumber(outputs.Rec_P);
      const recK = asNumber(outputs.Rec_K);

      if (selectedSideId === 'd1') {
        list.push(
          {
            id: 'd-n',
            label: 'Recomendacao N',
            value: `${formatValue(recN, 1)} kg/ha`,
            status: recN > 0 ? 'attention' : 'ok',
            description: 'Dose baseada em idade e estagio da cultura.',
            action: 'Parcelar aplicacao para maior eficiencia.',
          },
          {
            id: 'd-p',
            label: 'Recomendacao P',
            value: `${formatValue(recP, 1)} kg/ha`,
            status: recP > 0 ? 'attention' : 'ok',
            description: 'Correcao de fosforo conforme faixa ideal.',
            action: 'Priorizar fonte eficiente para o sistema.',
          },
          {
            id: 'd-k',
            label: 'Recomendacao K',
            value: `${formatValue(recK, 1)} kg/ha`,
            status: recK > 0 ? 'attention' : 'ok',
            description: 'Ajuste de potassio conforme disponibilidade.',
            action: 'Planejar parcelamento para reduzir perdas.',
          },
        );
      } else if (selectedSideId === 'd2') {
        (calculations?.adubacao?.explain_steps ?? []).slice(0, 8).forEach((step: string, i: number) => {
          list.push({
            id: `d-step-${i}`,
            label: `Ajuste ${i + 1}`,
            value: 'Regra aplicada',
            status: 'info',
            description: step,
            action: 'Usar esta regra na justificativa tecnica.',
          });
        });
      } else {
        list.push(
          {
            id: 'd-p1',
            label: 'Prioridade 1',
            value: recP > recK ? 'Fosforo' : 'Potassio',
            status: 'attention',
            description: 'Nutriente critico com maior impacto no curto prazo.',
            action: 'Executar correcao do nutriente prioritario primeiro.',
          },
          {
            id: 'd-p2',
            label: 'Prioridade 2',
            value: recN > 0 ? 'Nitrogenio' : 'Manutencao',
            status: 'info',
            description: 'Sequenciar aporte de N conforme idade.',
            action: 'Programar doses menores e frequentes.',
          },
        );
      }
    }

    if (!list.length) {
      list.push({
        id: 'empty',
        label: 'Sem dados para exibir',
        value: '-',
        status: 'info',
        description: 'Selecione outro menu lateral ou complete os dados.',
        action: 'Ajuste o menu dinamico para continuar.',
      });
    }

    return list;
  }, [moduleTab, selectedSideId, values, idealRanges, calculations]);

  useEffect(() => {
    if (!rows.length) {
      setSelectedInspectId(null);
      return;
    }
    setSelectedInspectId((prev) =>
      prev && rows.some((row) => row.id === prev) ? prev : rows[0].id,
    );
  }, [rows]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedInspectId) ?? rows[0] ?? null,
    [rows, selectedInspectId],
  );
  const detailContext = DETAIL_LIBRARY[moduleTab]?.[selectedSideId] ?? null;
  const historyMarks = useMemo(() => {
    const len = historyRowsAsc.length;
    if (!len) return [];
    const interval = Math.max(1, Math.ceil(len / 5));
    return historyRowsAsc
      .map((row, index) => {
        if (index !== 0 && index !== len - 1 && index % interval !== 0) return null;
        return {
          value: index,
          label: formatDateLabel(getAnalysisDateLike(row)),
        };
      })
      .filter((item): item is { value: number; label: string } => item !== null);
  }, [historyRowsAsc]);

  const selectedHistoryPair = useMemo(() => {
    if (!historyRowsAsc.length) {
      return { from: null, to: null };
    }
    const maxIndex = historyRowsAsc.length - 1;
    const fromIndex = Math.max(0, Math.min(historyRange[0], maxIndex));
    const toIndex = Math.max(0, Math.min(historyRange[1], maxIndex));
    return {
      from: historyRowsAsc[Math.min(fromIndex, toIndex)] ?? null,
      to: historyRowsAsc[Math.max(fromIndex, toIndex)] ?? null,
    };
  }, [historyRowsAsc, historyRange]);

  const historyComparison = useMemo(() => {
    if (!selectedHistoryPair.from || !selectedHistoryPair.to) return [];
    return HISTORY_COMPARE_KEYS
      .map((key) => {
        const fromValue = readAnalysisNutrient(selectedHistoryPair.from, key);
        const toValue = readAnalysisNutrient(selectedHistoryPair.to, key);
        if (fromValue == null && toValue == null) return null;

        const currentValue =
          key === 'MO'
            ? asNullableNumber(values['M.O.'])
            : asNullableNumber(values[key]);
        const delta =
          fromValue != null && toValue != null ? toValue - fromValue : null;

        return {
          key,
          fromValue,
          toValue,
          currentValue,
          delta,
        };
      })
      .filter(
        (
          item,
        ): item is {
          key: string;
          fromValue: number | null;
          toValue: number | null;
          currentValue: number | null;
          delta: number | null;
        } => item !== null,
      );
  }, [selectedHistoryPair, values]);

  const handleAmostraChange = (codigoAmostra: string | null) => {
    const novaAnalise = analises.find((item) => item.codigo_amostra === codigoAmostra);
    if (!novaAnalise) return;
    setAnalise(novaAnalise);
    setValues(novaAnalise.nutrientes);
    setIdealRanges(novaAnalise.faixaIdeal);
  };

  const handleResetCurrentSample = () => {
    setValues(analise.nutrientes);
    setIdealRanges(analise.faixaIdeal);
    notifications.show({
      title: 'Amostra resetada',
      message: `Valores da amostra ${analise.codigo_amostra} restaurados.`,
      color: 'blue',
    });
  };

  const openAnalysisDetailFromList = () => {
    if (!selectedAnalysisRow) {
      notifications.show({
        title: 'Selecione uma análise',
        message: 'Escolha uma análise da listagem para abrir o detalhamento.',
        color: 'yellow',
      });
      return;
    }

    const nextValues: Record<string, number> = { ...analise.nutrientes };
    Object.keys(nextValues).forEach((key) => {
      const rowKey = key === 'M.O.' ? 'MO' : key;
      const value = readAnalysisNutrient(selectedAnalysisRow, rowKey);
      if (value != null) {
        nextValues[key] = value;
      }
    });

    if (selectedAnalysisRow.property_id) {
      setSelectedPropertyId(selectedAnalysisRow.property_id);
    }
    if (selectedAnalysisRow.talhao_id) {
      setSelectedTalhaoId(selectedAnalysisRow.talhao_id);
    }
    setValues(nextValues);
    setAnalysisViewMode('detail');
  };

  const setVal = (key: string, value: number) =>
    setValues((prev) => ({ ...prev, [key === 'MO' ? 'M.O.' : key]: value }));

  const openCreatePropertyModal = () => {
    setPropertyModalMode('create');
    setPropertyDraftName('');
  };

  const openEditPropertyModal = () => {
    if (!selectedProperty) {
      notifications.show({
        title: 'Selecione uma propriedade',
        message: 'Escolha uma propriedade antes de editar.',
        color: 'yellow',
      });
      return;
    }
    setPropertyModalMode('edit');
    setPropertyDraftName(selectedProperty.nome);
  };

  const closePropertyModal = (force = false) => {
    if (savingProperty && !force) return;
    setPropertyModalMode(null);
    setPropertyDraftName('');
  };

  const handleSaveProperty = async () => {
    if (!propertyModalMode || !currentUserId) return;
    if (propertyDraftError) {
      notifications.show({
        title: 'Nome inválido',
        message: propertyDraftError,
        color: 'yellow',
      });
      return;
    }

    const nome = normalizedPropertyDraft;
    try {
      setSavingProperty(true);
      setLoadingLinks(true);

      if (propertyModalMode === 'create') {
        const created = await createPropertyForUser(currentUserId, nome);
        setProperties((prev) => [...prev, created]);
        setSelectedPropertyId(created.id);
        notifications.show({
          title: 'Propriedade criada',
          message: `${created.nome} adicionada com sucesso.`,
          color: 'green',
        });
      } else {
        if (!selectedPropertyId || !selectedProperty) return;
        const previousName = normalizePropertyName(selectedProperty.nome);
        if (previousName.toLowerCase() === nome.toLowerCase()) {
          closePropertyModal(true);
          return;
        }
        const updated = await updatePropertyForUser(selectedPropertyId, nome);
        setProperties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        notifications.show({
          title: 'Propriedade atualizada',
          message: `Nome alterado para ${updated.nome}.`,
          color: 'green',
        });
      }

      closePropertyModal(true);
    } catch (err: any) {
      notifications.show({
        title:
          propertyModalMode === 'create'
            ? 'Falha ao criar propriedade'
            : 'Falha ao editar propriedade',
        message: err?.message ?? 'Não foi possível concluir a operação.',
        color: 'red',
      });
    } finally {
      setSavingProperty(false);
      setLoadingLinks(false);
    }
  };

  const openPropertyContactModal = () => {
    if (!selectedProperty) {
      notifications.show({
        title: 'Selecione uma propriedade',
        message: 'Escolha uma propriedade para editar o contato.',
        color: 'yellow',
      });
      return;
    }
    setPropertyContactModalOpened(true);
  };

  const handleSavePropertyContact = async (contact: ContactInfo) => {
    if (!selectedPropertyId || !selectedProperty) return;
    try {
      setSavingPropertyContact(true);
      const updated = await updatePropertyForUser(
        selectedPropertyId,
        selectedProperty.nome,
        contact,
      );
      setProperties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setPropertyContactModalOpened(false);
      notifications.show({
        title: 'Contato da propriedade atualizado',
        message: 'Dados de contato salvos com sucesso.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar contato',
        message: err?.message ?? 'Não foi possível salvar o contato da propriedade.',
        color: 'red',
      });
    } finally {
      setSavingPropertyContact(false);
    }
  };

  const handleDeleteProperty = () => {
    if (!selectedPropertyId || !selectedProperty || !currentUserId) return;

    const property = selectedProperty;
    const propertyId = selectedPropertyId;

    void (async () => {
      try {
        const propertySnapshot = await loadPropertyDeletionSnapshot(property);

        openPropertyDeleteGuardModal({
          propertyName: property.nome,
          talhoesCount: propertySnapshot.talhoes.length,
          analysesCount: propertySnapshot.analyses.length,
          onConfirm: async ({ exportPdf }) => {
            try {
              setLoadingLinks(true);
              if (exportPdf) {
                exportPropertySnapshotToPdf(propertySnapshot);
              }

              await deletePropertyForUser(propertyId);
              const loaded = await fetchOrCreateUserProperties(currentUserId);
              setProperties(loaded);
              setSelectedPropertyId(loaded[0]?.id ?? null);
              notifications.show({
                title: 'Propriedade excluida',
                message: 'A propriedade e os dados vinculados foram removidos.',
                color: 'green',
              });
              return true;
            } catch (err: any) {
              notifications.show({
                title: 'Falha ao excluir propriedade',
                message: err?.message ?? 'Não foi possível excluir a propriedade.',
                color: 'red',
              });
              return false;
            } finally {
              setLoadingLinks(false);
            }
          },
        });
      } catch (err: any) {
        notifications.show({
          title: 'Falha ao preparar exclusao',
          message: err?.message ?? 'Não foi possível carregar os dados da propriedade.',
          color: 'red',
        });
      }
    })();
  };

  const saveLinkedAnalysis = async () => {
    if (!currentUserId) return;
    if (!selectedPropertyId || !selectedTalhaoId) {
      notifications.show({
        title: 'Vinculo incompleto',
        message: 'Selecione propriedade e talhão antes de salvar.',
        color: 'yellow',
      });
      return;
    }

    try {
      setSavingAnalysis(true);
      const raw: Record<string, any> = {};
      for (const [key, value] of Object.entries(values)) {
        const nutrientKey = key === 'M.O.' ? 'MO' : key;
        raw[nutrientKey] = { value: Number(value), unit: DEFAULT_UNITS[key] ?? '%' };
      }

      const nowIso = new Date().toISOString();
      const processed = NormalizationService.processContainer({
        id: crypto.randomUUID(),
        user_id: currentUserId,
        property_id: selectedPropertyId,
        talhao_id: selectedTalhaoId,
        data_amostragem: nowIso.slice(0, 10),
        profundidade: mapDepthToEnum(analise.profundidade),
        laboratorio_id: selectedOrderLabId ?? undefined,
        laboratorio: selectedOrderLab?.nome ?? manualLaboratoryName,
        raw: raw as any,
      });

      const normalizedData = (processed.normalized ?? {}) as Record<string, any>;
      const calcInput = {
        analysisId: String(processed.id ?? crypto.randomUUID()),
        normalizedData,
        params: {
          V2: 70,
          PRNT: 90,
          cultura: analise.cultura,
          idade_meses: toAgeInMonths(analise.idade),
          idealRanges,
          profundidade: analise.profundidade,
        },
        rulesetVersion: 'v1',
      };

      const insertPayload = {
        user_id: currentUserId,
        property_id: selectedPropertyId,
        talhao_id: selectedTalhaoId,
        data_amostragem: nowIso.slice(0, 10),
        profundidade: mapDepthToEnum(analise.profundidade),
        laboratorio_id: selectedOrderLabId ?? undefined,
        laboratorio: selectedOrderLab?.nome ?? manualLaboratoryName,
        raw: processed.raw ?? raw,
        normalized: processed.normalized ?? {},
        executions: {
          calagem: CalagemService.calculate(calcInput).execution,
          gessagem: GessagemService.calculate(calcInput).execution,
          adubacao: AdubacaoService.calculate(calcInput).execution,
        },
        alerts: processed.alerts ?? [],
        ruleset_frozen: true,
      };

      await persistLinkedAnalysis(insertPayload as any);
      await refreshHistory();
      await refreshAnalysisList();
      notifications.show({
        title: 'Análise salva',
        message: 'Análise vinculada ao talhão com sucesso.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar análise',
        message: err?.message ?? 'Não foi possível salvar a análise.',
        color: 'red',
      });
    } finally {
      setSavingAnalysis(false);
    }
  };

  return (
    <Stack gap="md">
      <ContactInfoModal
        opened={propertyContactModalOpened}
        onClose={() => setPropertyContactModalOpened(false)}
        onSave={handleSavePropertyContact}
        value={selectedPropertyContact}
        saving={savingPropertyContact}
        title="Contato da propriedade"
        subtitle="Contato usado para compartilhar resultados e laudos."
      />

      <Modal
        opened={propertyModalMode !== null}
        onClose={closePropertyModal}
        centered
        title={propertyModalMode === 'create' ? 'Nova propriedade' : 'Editar propriedade'}
      >
        <Stack gap="sm">
          <TextInput
            label="Nome da propriedade"
            placeholder="Ex.: Fazenda Santa Luzia"
            value={propertyDraftName}
            onChange={(event) => setPropertyDraftName(event.currentTarget.value)}
            error={propertyDraftError}
            maxLength={70}
            data-autofocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleSaveProperty();
              }
            }}
          />
          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              onClick={() => closePropertyModal()}
              disabled={savingProperty}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveProperty}
              loading={savingProperty}
              disabled={Boolean(propertyDraftError)}
            >
              {propertyModalMode === 'create' ? 'Criar propriedade' : 'Salvar alteracoes'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {analysisViewMode === 'list' ? (
        <Card
          withBorder
          radius="md"
          p="md"
          style={{ background: 'linear-gradient(90deg, #0c1738 0%, #162b63 60%, #10214b 100%)' }}
        >
          <Group justify="space-between" align="center" mb="sm">
            <Stack gap={0}>
              <Title order={4} c="white">
                Projeto | Propriedade
              </Title>
              <Text c="rgba(255,255,255,0.85)" size="sm">
                {user?.email ?? 'usuario@local'} - fonte de dados: {dataProviderLabel}
              </Text>
            </Stack>

            <Badge color="yellow" variant="filled" size="lg">
              {isLocalDataMode ? 'MODO LOCAL' : 'MODO NUVEM'}
            </Badge>
          </Group>

          <Grid gutter="sm" align="end">
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Select
                label="Amostra"
                value={analise.codigo_amostra}
                data={amostrasOptions}
                onChange={handleAmostraChange}
                disabled={loadingLinks}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 3 }}>
              <Select
                label="Propriedade"
                value={selectedPropertyId}
                data={propertyOptions}
                onChange={(value) => {
                  setSelectedPropertyId(value);
                  setAnalysisViewMode('list');
                }}
                placeholder="Selecione"
                searchable
                nothingFoundMessage="Nenhuma propriedade encontrada"
                comboboxProps={{ withinPortal: false }}
                disabled={loadingLinks && properties.length === 0}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 3 }}>
              <Select
                label="Talhão"
                value={selectedTalhaoId}
                data={talhaoOptions}
                onChange={(value) => {
                  setSelectedTalhaoId(value);
                  setAnalysisViewMode('list');
                }}
                placeholder="Selecione"
                disabled={loadingLinks || !selectedPropertyId}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 3 }}>
              <Group justify="flex-end" wrap="nowrap">
                <Menu shadow="md" width={250} position="bottom-end">
                  <Menu.Target>
                    <Button color="dark" loading={loadingLinks}>
                      Acoes da Propriedade
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconPlus size={14} />} onClick={openCreatePropertyModal}>
                      Adicionar nova
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconPencil size={14} />}
                      onClick={openEditPropertyModal}
                      disabled={!selectedPropertyId}
                    >
                      Editar selecionada
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconMail size={14} />}
                      onClick={openPropertyContactModal}
                      disabled={!selectedPropertyId}
                    >
                      Contato da propriedade
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconTrash size={14} />}
                      onClick={handleDeleteProperty}
                      color="red"
                      disabled={!selectedPropertyId}
                    >
                      Excluir selecionada
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Grid.Col>
          </Grid>

          <Group mt="sm" gap="xs">
            <Badge color="cyan" variant="light">Cultura: {analise.cultura}</Badge>
            <Badge color="grape" variant="light">Estado: {analise.estado}</Badge>
            <Badge color="lime" variant="light">Cidade: {analise.cidade}</Badge>
            <Badge color="orange" variant="light">Profundidade: {analise.profundidade}</Badge>
          </Group>

          <Text c="rgba(255,255,255,0.88)" size="sm" mt={8}>
            Contato propriedade: {getPrimaryEmail(selectedPropertyContact) || '-'} | {getPrimaryPhone(selectedPropertyContact) || '-'}
          </Text>
        </Card>
      ) : (
        <Card
          withBorder
          radius="md"
          p="md"
          style={{ background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 70%, #111827 100%)' }}
        >
          <Group justify="space-between" align="center">
            <Stack gap={4}>
              <Title order={4} c="white">
                Detalhamento da Analise
              </Title>
              <Text size="sm" c="gray.4">
                Propriedade e talhao fixados conforme selecao na listagem.
              </Text>
            </Stack>
            <Button
              variant="light"
              color="gray"
              onClick={() => setAnalysisViewMode('list')}
            >
              Fechar detalhamento
            </Button>
          </Group>

          <Group mt="sm" gap="xs">
            <Badge color="green" variant="filled">
              Propriedade: {selectedProperty?.nome ?? '-'}
            </Badge>
            <Badge color="cyan" variant="filled">
              Talhao: {selectedTalhao?.nome ?? '-'}
            </Badge>
            <Badge color="indigo" variant="light">
              Data: {selectedAnalysisRow ? formatDateLabel(getAnalysisDateLike(selectedAnalysisRow)) : '--'}
            </Badge>
            <Badge color="grape" variant="light">
              Lab: {selectedAnalysisRow ? formatLaboratorioLabel(selectedAnalysisRow.laboratorio) : '--'}
            </Badge>
          </Group>
        </Card>
      )}

      <Card
        withBorder
        radius="md"
        p="md"
        style={{ background: '#101b2f', borderColor: '#1f3d66' }}
      >
        <Group justify="space-between" mb="xs">
          <div>
            <Title order={5} c="white">
              Listagem de Analises
            </Title>
            <Text size="sm" c="gray.4">
              Selecione propriedade e talhao para filtrar. Depois escolha a analise para abrir o detalhamento.
            </Text>
          </div>
          <Group gap="xs">
            <Badge color="indigo">{filteredAnalysisList.length} resultados</Badge>
            <Button
              variant="light"
              color="gray"
              onClick={() => setAnalysisViewMode('list')}
            >
              Listagem
            </Button>
            <Button
              color="cyan"
              onClick={openAnalysisDetailFromList}
              disabled={!selectedAnalysisRow}
            >
              Abrir detalhamento
            </Button>
          </Group>
        </Group>

        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Select
              label="Laboratorio"
              placeholder="Todos laboratorios"
              data={analysisListLaboratorioOptions}
              value={analysisListLaboratorio}
              onChange={setAnalysisListLaboratorio}
              clearable
              searchable
              nothingFoundMessage="Nenhum laboratorio"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Text size="sm" c="gray.4" mt={2}>
              Periodo (data minima e maxima)
            </Text>
            <RangeSlider
              min={0}
              max={Math.max(0, analysisRowsAsc.length - 1)}
              value={analysisListDateRange}
              onChange={(value) =>
                setAnalysisListDateRange([
                  Math.min(value[0], value[1]),
                  Math.max(value[0], value[1]),
                ])
              }
              step={1}
              minRange={analysisRowsAsc.length > 1 ? 1 : 0}
              marks={analysisListMarks}
              color="indigo"
              disabled={analysisRowsAsc.length === 0}
              label={(value) => {
                const row = analysisRowsAsc[value];
                return row ? formatDateLabel(getAnalysisDateLike(row)) : '--';
              }}
            />
          </Grid.Col>
        </Grid>

        <Table striped highlightOnHover withTableBorder mt="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data/Hora</Table.Th>
              <Table.Th>Laboratorio</Table.Th>
              <Table.Th>Talhao</Table.Th>
              <Table.Th>Profundidade</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loadingAnalysisList ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text size="sm" c="dimmed">Carregando analises...</Text>
                </Table.Td>
              </Table.Tr>
            ) : filteredAnalysisList.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text size="sm" c="dimmed">
                    Nenhuma analise encontrada para os filtros selecionados.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredAnalysisList.map((row) => {
                const selected = row.id === selectedAnalysisRow?.id;
                return (
                  <Table.Tr
                    key={row.id}
                    onClick={() => setSelectedAnalysisRowId(row.id)}
                    style={{
                      cursor: 'pointer',
                      background: selected ? 'rgba(59, 130, 246, 0.18)' : undefined,
                    }}
                  >
                    <Table.Td>{formatDateTimeLabel(getAnalysisDateLike(row))}</Table.Td>
                    <Table.Td>{formatLaboratorioLabel(row.laboratorio)}</Table.Td>
                    <Table.Td>{talhaoNameById.get(row.talhao_id) ?? row.talhao_id}</Table.Td>
                    <Table.Td>{row.profundidade || '-'}</Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>

        <Divider my="sm" color="#27446e" />

        <Stack gap="xs">
          <Text fw={600} c="white">
            Estimativa de custo do pedido de analise
          </Text>
          <Group align="flex-end" grow>
            <Select
              label="Laboratorio para pedido"
              placeholder="Selecione laboratorio"
              data={laboratoryOptions}
              value={selectedOrderLabId}
              onChange={setSelectedOrderLabId}
              searchable
              clearable
              nothingFoundMessage="Cadastre laboratorios em Configurações > Laboratorios"
            />
            <NumberInput
              label="Quantidade de amostras"
              min={1}
              value={orderSamplesCount}
              onChange={(value) =>
                setOrderSamplesCount(
                  Number.isFinite(Number(value)) && value !== ''
                    ? Number(value)
                    : '',
                )
              }
            />
          </Group>

          {!selectedOrderLab ? (
            <Text size="sm" c="gray.4">
              Selecione um laboratorio cadastrado para estimar o custo.
            </Text>
          ) : selectedOrderLab.servicos.length === 0 ? (
            <Text size="sm" c="gray.4">
              Este laboratorio nao tem servicos cadastrados.
            </Text>
          ) : (
            <Stack gap={4}>
              <Checkbox.Group
                value={orderServiceIds}
                onChange={(value) => setOrderServiceIds(value)}
              >
                <Stack gap={4}>
                  {selectedOrderLab.servicos.map((service) => (
                    <Group key={service.id} justify="space-between" wrap="nowrap">
                      <Checkbox
                        value={service.id}
                        label={service.nome}
                        styles={{ label: { color: '#dbeafe' } }}
                      />
                      <Badge color="teal" variant="light">
                        {formatCurrency(service.preco)}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              </Checkbox.Group>

              <Group justify="space-between" mt={4}>
                <Text size="sm" c="gray.4">
                  Servicos selecionados: {selectedOrderServices.length}
                </Text>
                <Badge color="green" size="lg">
                  Total estimado: {formatCurrency(estimatedOrderTotal)}
                </Badge>
              </Group>
            </Stack>
          )}
        </Stack>
      </Card>

      {analysisViewMode === 'detail' ? (
        <>
          <Card
        withBorder
        radius="md"
        p="sm"
        style={{ background: '#176632', borderColor: '#1b8b41' }}
      >
        <Group justify="space-between" align="center">
          <SegmentedControl
            value={moduleTab}
            onChange={(value) => setModuleTab(value as ModuleKey)}
            data={MODULE_OPTIONS}
            radius="xl"
            size="md"
            styles={{
              root: { backgroundColor: '#0f4f27' },
              indicator: { backgroundColor: '#072d16' },
              label: { color: 'white', fontWeight: 600 },
            }}
          />

          <Group gap="xs">
            <Badge color="teal" variant="filled">
              {selectedSideItem?.label ?? 'Sem submenu'}
            </Badge>
            <ActionIcon
              variant="filled"
              color="dark"
              onClick={handleResetCurrentSample}
              title="Resetar valores da amostra"
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Group>

        <Text c="rgba(255,255,255,0.85)" fw={600} size="sm" mt={8}>
          Propriedade: {selectedProperty?.nome ?? 'não selecionada'} | Talhao: {selectedTalhao?.nome ?? 'não selecionado'}
        </Text>
      </Card>

      <Card
        withBorder
        radius="md"
        p="md"
        style={{ background: '#111827', borderColor: '#374151' }}
      >
        <Group justify="space-between" mb="xs">
          <div>
            <Title order={5} c="white">Historico da Area</Title>
            <Text c="gray.4" size="sm">
              Slider temporal para comparar analises da mesma area (talhao).
            </Text>
          </div>
          <Badge color="indigo">{historyRowsAsc.length} analises</Badge>
        </Group>

        {!selectedTalhaoId ? (
          <Text c="gray.3" size="sm">
            Selecione um talhao para visualizar o historico.
          </Text>
        ) : loadingHistory ? (
          <Text c="gray.3" size="sm">
            Carregando historico...
          </Text>
        ) : historyRowsAsc.length === 0 ? (
          <Text c="gray.3" size="sm">
            Este talhao ainda nao possui analises salvas.
          </Text>
        ) : (
          <Stack gap="md">
            <RangeSlider
              min={0}
              max={Math.max(0, historyRowsAsc.length - 1)}
              value={historyRange}
              onChange={(value) =>
                setHistoryRange([
                  Math.min(value[0], value[1]),
                  Math.max(value[0], value[1]),
                ])
              }
              step={1}
              minRange={historyRowsAsc.length > 1 ? 1 : 0}
              marks={historyMarks}
              color="cyan"
              label={(value) => {
                const row = historyRowsAsc[value];
                return row ? formatDateLabel(getAnalysisDateLike(row)) : '--';
              }}
            />

            <Group grow>
              <Select
                label="Data A"
                data={historyDateOptions}
                value={String(Math.min(historyRange[0], historyRange[1]))}
                onChange={(value) => {
                  const idx = Number(value);
                  if (!Number.isFinite(idx)) return;
                  setHistoryRange((prev) => [
                    Math.min(idx, prev[1]),
                    Math.max(idx, prev[1]),
                  ]);
                }}
              />
              <Select
                label="Data B"
                data={historyDateOptions}
                value={String(Math.max(historyRange[0], historyRange[1]))}
                onChange={(value) => {
                  const idx = Number(value);
                  if (!Number.isFinite(idx)) return;
                  setHistoryRange((prev) => [
                    Math.min(prev[0], idx),
                    Math.max(prev[0], idx),
                  ]);
                }}
              />
            </Group>

            <Group grow>
              <Card radius="md" p="sm" style={{ background: '#1f2937' }}>
                <Text c="gray.4" size="xs">Ponto A (inicio)</Text>
                <Text c="white" fw={700}>
                  {selectedHistoryPair.from
                    ? formatDateLabel(getAnalysisDateLike(selectedHistoryPair.from))
                    : '--'}
                </Text>
              </Card>
              <Card radius="md" p="sm" style={{ background: '#1f2937' }}>
                <Text c="gray.4" size="xs">Ponto B (fim)</Text>
                <Text c="white" fw={700}>
                  {selectedHistoryPair.to
                    ? formatDateLabel(getAnalysisDateLike(selectedHistoryPair.to))
                    : '--'}
                </Text>
              </Card>
            </Group>

            <Divider color="#374151" />

            {historyComparison.length === 0 ? (
              <Text c="gray.4" size="sm">
                Sem nutrientes comparaveis para o intervalo selecionado.
              </Text>
            ) : (
              <Stack gap={8}>
                {historyComparison.map((item) => (
                  <Group key={item.key} justify="space-between" wrap="nowrap">
                    <Text c="gray.2" fw={600} miw={58}>
                      {item.key}
                    </Text>
                    <Badge color="gray" variant="light">
                      A: {item.fromValue == null ? '--' : formatValue(item.fromValue)}
                    </Badge>
                    <Badge color="gray" variant="light">
                      B: {item.toValue == null ? '--' : formatValue(item.toValue)}
                    </Badge>
                    <Badge
                      color={
                        item.delta == null
                          ? 'gray'
                          : item.delta > 0
                            ? 'teal'
                            : item.delta < 0
                              ? 'orange'
                              : 'blue'
                      }
                    >
                      Delta: {item.delta == null ? '--' : `${item.delta > 0 ? '+' : ''}${formatValue(item.delta)}`}
                    </Badge>
                    <Badge color="violet" variant="light">
                      Atual: {item.currentValue == null ? '--' : formatValue(item.currentValue)}
                    </Badge>
                  </Group>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Card>

      <Grid gutter="md" align="stretch">
        <Grid.Col span={{ base: 12, md: 3, lg: 2 }}>
          <Card
            radius="md"
            p="sm"
            h="100%"
            style={{ background: '#46205e', border: '1px solid #6a2d8f' }}
          >
            <Text c="white" fw={700} mb="sm">
              Menu Dinamico
            </Text>
            <Stack gap={6}>
              {sideMenuItems.map((item) => {
                const isActive = item.id === selectedSideId;
                return (
                  <UnstyledButton
                    key={item.id}
                    onClick={() => setSelectedSideId(item.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: isActive ? '#111' : 'rgba(255,255,255,0.18)',
                      color: 'white',
                      border: isActive ? '1px solid #f8e71c' : '1px solid transparent',
                    }}
                  >
                    <Text fw={700} size="sm">
                      {item.label}
                    </Text>
                    <Text size="xs" c="rgba(255,255,255,0.85)">
                      {item.hint}
                    </Text>
                  </UnstyledButton>
                );
              })}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5, lg: 6 }}>
          <Card
            radius="md"
            p="md"
            h="100%"
            style={{ background: '#0f2029', border: '1px solid #244455' }}
          >
            <Group justify="space-between" mb="xs">
              <div>
                <Title order={4} c="white">Conteudo Tecnico</Title>
                <Text size="sm" c="gray.4">
                  Clique em um item para ampliar no inspect.
                </Text>
              </div>
              <Badge color="cyan">{rows.length} itens</Badge>
            </Group>
            <Divider mb="sm" />

            <ScrollArea h={520}>
              <Stack gap="xs">
                {rows.map((row) => {
                  const isSelected = row.id === selectedInspectId;
                  return (
                    <UnstyledButton
                      key={row.id}
                      onClick={() => setSelectedInspectId(row.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: isSelected ? '#111111' : '#1d1d1d',
                        border: isSelected ? '2px solid #f8e71c' : '1px solid #2d2d2d',
                      }}
                    >
                      <Group justify="space-between" align="center" wrap="nowrap">
                        <Stack gap={0} style={{ minWidth: 0 }}>
                          <Text c="white" fw={700} truncate="end">
                            {row.label}
                          </Text>
                          <Text c="gray.3" size="xs" truncate="end">
                            {row.description}
                          </Text>
                        </Stack>

                        {row.editableKey && typeof row.numericValue === 'number' ? (
                          <NumberInput
                            value={row.numericValue}
                            onChange={(value) => setVal(row.editableKey!, Number(value) || 0)}
                            decimalScale={2}
                            step={0.1}
                            min={0}
                            max={9999}
                            hideControls
                            size="xs"
                            w={110}
                            styles={{ input: { backgroundColor: '#eaf2ec' } }}
                          />
                        ) : (
                          <Badge color={statusColor(row.status)} variant="light" size="lg">
                            {row.value}
                          </Badge>
                        )}
                      </Group>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </ScrollArea>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4, lg: 4 }}>
          <Stack h="100%" gap="md">
            <Card
              radius="md"
              p="md"
              style={{ background: '#25368d', border: '1px solid #3246b0' }}
            >
              <Group justify="space-between" mb="xs">
                <Title order={4} c="white">
                  Inspect
                </Title>
                <Badge color={statusColor(selectedRow?.status ?? 'info')}>
                  {statusLabel(selectedRow?.status ?? 'info')}
                </Badge>
              </Group>

              {selectedRow ? (
                <Stack gap="xs">
                  <Text c="white" fw={700}>{selectedRow.label}</Text>
                  <Text c="rgba(255,255,255,0.92)">Valor: {selectedRow.value}</Text>
                  <Progress
                    value={statusProgress(selectedRow.status)}
                    color={statusColor(selectedRow.status)}
                    radius="xl"
                    size="sm"
                  />
                  <Text c="rgba(255,255,255,0.85)" size="sm">{selectedRow.description}</Text>
                  <Divider color="rgba(255,255,255,0.25)" my={4} />
                  <Text c="rgba(255,255,255,0.95)" size="sm" fw={600}>Direcionamento</Text>
                  <Text c="rgba(255,255,255,0.85)" size="sm">{selectedRow.action}</Text>
                </Stack>
              ) : (
                <Text c="white">Selecione um item para inspecao.</Text>
              )}
            </Card>

            <Card
              radius="md"
              p="md"
              style={{ background: '#3f2d3a', border: '1px solid #684256', flex: 1 }}
            >
              <Stack gap="sm" h="100%" justify="space-between">
                <div>
                  <Group justify="space-between" align="center">
                    <Title order={5} c="white">Descricao e Detalhamento</Title>
                    <ThemeIcon variant="light" color="violet">
                      <IconDotsVertical size={14} />
                    </ThemeIcon>
                  </Group>
                  <Text size="sm" mt={6} c="gray.3">
                    {detailContext?.context ?? 'Detalhamento tecnico do item selecionado.'}
                  </Text>

                  <Divider my="sm" />

                  <Text size="sm" fw={700} c="white">O que e:</Text>
                  <Text size="sm" c="gray.2">{selectedRow?.description ?? 'Sem item selecionado.'}</Text>

                  <Text size="sm" fw={700} mt="sm" c="white">Por que importa:</Text>
                  <Text size="sm" c="gray.2">
                    {detailContext?.why ?? 'Impacto agronomico varia conforme cultura e objetivo da area.'}
                  </Text>

                  <Text size="sm" fw={700} mt="sm" c="white">O que fazer:</Text>
                  <Text size="sm" c="gray.2">{selectedRow?.action ?? 'Selecione um item para orientar o manejo.'}</Text>

                  <Text size="sm" fw={700} mt="sm" c="white">Plano de execucao:</Text>
                  <Stack gap={4} mt={4}>
                    {(selectedRow?.detailSteps ?? detailContext?.steps ?? []).slice(0, 3).map((step, idx) => (
                      <Text key={`${selectedRow?.id ?? 'ctx'}-${idx}`} size="sm" c="gray.2">
                        {idx + 1}. {step}
                      </Text>
                    ))}
                  </Stack>
                </div>

                <Stack gap={8}>
                  <Button
                    fullWidth
                    variant="light"
                    color="gray"
                    onClick={handleResetCurrentSample}
                  >
                    Resetar Valores da Amostra
                  </Button>
                  <Button
                    fullWidth
                    color="dark"
                    onClick={saveLinkedAnalysis}
                    loading={savingAnalysis}
                    disabled={!selectedPropertyId || !selectedTalhaoId}
                  >
                    Salvar Analise no Talhao
                  </Button>
                </Stack>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
        </>
      ) : null}

      {analysisViewMode === 'list' ? (
        <Text size="sm" c="dimmed">
          O detalhamento tecnico sera exibido apos selecionar uma analise na listagem.
        </Text>
      ) : null}
    </Stack>
  );
}
