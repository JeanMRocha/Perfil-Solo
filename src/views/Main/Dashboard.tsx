import {
  Box,
  Loader,
} from '@mantine/core';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button as ShadButton } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { ScrollArea as ShadScrollArea } from '../../components/ui/scroll-area';
import { Input as ShadInput } from '../../components/ui/input';
import { notifications } from '@mantine/notifications';
import { useStore } from '@nanostores/react';
import {
  IconEdit,
  IconFileExport,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertyFullModal, {
  type PropertyFullModalSubmitPayload,
} from '../../components/Propriedades/PropertyFullModal';
import TalhaoDetailModal from '../../components/Propriedades/TalhaoDetailModal';
import {
  exportPropertySnapshotToPdf,
  openPropertyDeleteGuardModal,
  openTalhaoDeleteGuardModal,
} from '../../components/Propriedades/PropertyDeleteGuardModal';
import PropertyExportModal from './components/PropertyExportModal';
import { $tema } from '../../global-state/themeStore';
import { $currUser } from '../../global-state/user';
import type { Property, Talhao } from '../../types/property';
import {
  calculateBillingQuote,
  getBillingSubscriptionForUser,
} from '../../services/billingPlanService';
import { isLocalDataMode } from '../../services/dataProvider';
import {
  createPropertyForUser,
  createTalhaoForProperty,
  deleteTalhaoForProperty,
  deletePropertyForUser,
  fetchAnalysesByProperties,
  fetchTalhoesByProperty,
  fetchTalhoesByProperties,
  fetchUserProperties,
  updatePropertyForUser,
  type AnalysisRow,
} from '../../services/propertyMapService';
import {
  exportPropertiesDataToPdf,
} from '../../services/propertyExportService';
import {
  loadPropertyDeletionSnapshot,
} from '../../services/propertySnapshotService';
import { storageReadJson, storageWriteJson } from '../../services/safeLocalStorage';
import type {
  PropertyExportPropertyNode,
} from './components/PropertyExportModal';
import TalhaoSelectorModal, {
  type TalhaoSelectionRow,
} from './components/TalhaoSelectorModal';
import { cn } from '../../lib/utils';
import './dashboard.css';

const DASHBOARD_SELECTED_PROPERTY_KEY = 'perfilsolo_dashboard_selected_property_v1';
const DASHBOARD_SELECTED_TALHAO_KEY = 'perfilsolo_dashboard_selected_talhao_v1';
const PROPERTY_NODE_PREFIX = 'property:';
const TALHAO_NODE_PREFIX = 'talhao:';
const ANALYSIS_NODE_PREFIX = 'analysis:';

function formatAreaHa(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isPositiveNumber(value: unknown): boolean {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0;
}

function normalizeKey(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isUnclassifiedSoil(value?: string | null): boolean {
  const normalized = normalizeKey(value);
  return (
    normalized === 'nao classificado' || normalized === '__nao_classificado__'
  );
}

function sumNonTalhoesAreaAllocations(property: Property): number {
  const allocations = Array.isArray(property.area_allocations)
    ? property.area_allocations
    : [];

  return allocations.reduce((sum, row) => {
    const categoryId = String(row.category_id ?? '').trim().toLowerCase();
    if (categoryId === 'talhoes') return sum;

    const area = Number(row.area_ha ?? 0);
    if (!Number.isFinite(area) || area <= 0) return sum;
    return sum + area;
  }, 0);
}

function toPropertyNodeId(propertyId: string): string {
  return `${PROPERTY_NODE_PREFIX}${propertyId}`;
}

function toTalhaoNodeId(talhaoId: string): string {
  return `${TALHAO_NODE_PREFIX}${talhaoId}`;
}

function toAnalysisNodeId(analysisId: string): string {
  return `${ANALYSIS_NODE_PREFIX}${analysisId}`;
}

function formatAnalysisNodeLabel(row: AnalysisRow): string {
  const sampleCode = String((row as any)?.codigo_amostra ?? '').trim();
  const laboratory = String((row as any)?.laboratorio ?? '').trim();
  if (sampleCode && laboratory) return `Amostra ${sampleCode} - ${laboratory}`;
  if (sampleCode) return `Amostra ${sampleCode}`;
  if (laboratory) return `Análise - ${laboratory}`;
  const shortId = String(row.id ?? '').slice(0, 8);
  return shortId ? `Análise ${shortId}` : 'Análise sem código';
}

function readSelectedPropertyByUser(userId: string): string | null {
  const map = storageReadJson<Record<string, string | null>>(
    DASHBOARD_SELECTED_PROPERTY_KEY,
    {},
  );
  const value = String(map[userId] ?? '').trim();
  return value || null;
}

function writeSelectedPropertyByUser(userId: string, propertyId: string | null): void {
  const map = storageReadJson<Record<string, string | null>>(
    DASHBOARD_SELECTED_PROPERTY_KEY,
    {},
  );
  map[userId] = propertyId;
  storageWriteJson(DASHBOARD_SELECTED_PROPERTY_KEY, map);
}

function readSelectedTalhaoByUserAndProperty(
  userId: string,
  propertyId: string,
): string | null {
  const map = storageReadJson<Record<string, Record<string, string | null>>>(
    DASHBOARD_SELECTED_TALHAO_KEY,
    {},
  );
  const userMap = map[userId];
  if (!userMap || typeof userMap !== 'object') return null;
  const value = String(userMap[propertyId] ?? '').trim();
  return value || null;
}

function writeSelectedTalhaoByUserAndProperty(
  userId: string,
  propertyId: string,
  talhaoId: string | null,
): void {
  const map = storageReadJson<Record<string, Record<string, string | null>>>(
    DASHBOARD_SELECTED_TALHAO_KEY,
    {},
  );
  const userMap = { ...(map[userId] ?? {}) };
  userMap[propertyId] = talhaoId;
  map[userId] = userMap;
  storageWriteJson(DASHBOARD_SELECTED_TALHAO_KEY, map);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const tema = useStore($tema);
  const user = useStore($currUser);
  const currentUserId = user?.id ?? (isLocalDataMode ? 'local-user' : null);

  const [drawerOpened, setDrawerOpened] = useState(false);
  const [houseHovered, setHouseHovered] = useState(false);
  const [plotHovered, setPlotHovered] = useState(false);
  const [storeHovered, setStoreHovered] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [propertySearch, setPropertySearch] = useState('');
  const [propertyRows, setPropertyRows] = useState<Property[]>([]);
  const [propertyTalhoesAreaById, setPropertyTalhoesAreaById] = useState<Record<string, number>>({});
  const [propertyTalhoesCountById, setPropertyTalhoesCountById] = useState<Record<string, number>>({});
  const [propertyAnalysesCountById, setPropertyAnalysesCountById] = useState<Record<string, number>>({});
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [propertyModalMode, setPropertyModalMode] = useState<'create' | 'edit' | null>(
    null,
  );
  const [savingProperty, setSavingProperty] = useState(false);
  const [propertyOnboardingOpened, setPropertyOnboardingOpened] = useState(false);
  const [talhaoDrawerOpened, setTalhaoDrawerOpened] = useState(false);
  const [loadingTalhoes, setLoadingTalhoes] = useState(false);
  const [talhoesLoadError, setTalhoesLoadError] = useState<string | null>(null);
  const [talhaoSearch, setTalhaoSearch] = useState('');
  const [talhaoRows, setTalhaoRows] = useState<Talhao[]>([]);
  const [talhaoAnalysesCountById, setTalhaoAnalysesCountById] = useState<Record<string, number>>({});
  const [selectedTalhaoId, setSelectedTalhaoId] = useState<string | null>(null);
  const [talhaoDetailOpened, setTalhaoDetailOpened] = useState(false);
  const [exportModalOpened, setExportModalOpened] = useState(false);
  const [exportSelectedItemIds, setExportSelectedItemIds] = useState<string[]>([]);
  const [exportTalhoes, setExportTalhoes] = useState<Talhao[]>([]);
  const [exportAnalyses, setExportAnalyses] = useState<AnalysisRow[]>([]);
  const [exportIncludeSoilClassification, setExportIncludeSoilClassification] =
    useState(true);
  const [loadingExportTree, setLoadingExportTree] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const propertyInfoCardRef = useRef<HTMLDivElement | null>(null);
  const talhaoInfoCardRef = useRef<HTMLDivElement | null>(null);
  const [propertyIconWidthPx, setPropertyIconWidthPx] = useState<number | null>(null);
  const [talhaoIconWidthPx, setTalhaoIconWidthPx] = useState<number | null>(null);

  const overlay =
    tema === 'dark'
      ? 'linear-gradient(180deg, rgba(2, 6, 23, 0.32) 0%, rgba(2, 6, 23, 0.52) 100%)'
      : 'linear-gradient(180deg, rgba(15, 23, 42, 0.1) 0%, rgba(15, 23, 42, 0.22) 100%)';

  useEffect(() => {
    if (!currentUserId) {
      setSelectedPropertyId(null);
      return;
    }
    setSelectedPropertyId(readSelectedPropertyByUser(currentUserId));
  }, [currentUserId]);

  const loadProperties = useCallback(async () => {
    if (!currentUserId) {
      setPropertyRows([]);
      setPropertyTalhoesAreaById({});
      setPropertyTalhoesCountById({});
      setPropertyAnalysesCountById({});
      setSelectedPropertyId(null);
      return;
    }

    setLoadingProperties(true);
    setLoadError(null);
    try {
      const rows = await fetchUserProperties(currentUserId);
      const propertyIds = rows.map((row) => row.id);
      const [talhoes, analyses] =
        propertyIds.length > 0
          ? await Promise.all([
              fetchTalhoesByProperties(propertyIds),
              fetchAnalysesByProperties(propertyIds),
            ])
          : [[], []];
      const talhoesAreaByProperty = talhoes.reduce<Record<string, number>>((acc, talhao) => {
        const area = Number(talhao.area_ha ?? 0);
        if (!Number.isFinite(area) || area <= 0) return acc;
        acc[talhao.property_id] = (acc[talhao.property_id] ?? 0) + area;
        return acc;
      }, {});
      const talhoesCountByProperty = talhoes.reduce<Record<string, number>>((acc, talhao) => {
        acc[talhao.property_id] = (acc[talhao.property_id] ?? 0) + 1;
        return acc;
      }, {});
      const analysesCountByProperty = analyses.reduce<Record<string, number>>((acc, analysis) => {
        acc[analysis.property_id] = (acc[analysis.property_id] ?? 0) + 1;
        return acc;
      }, {});
      setPropertyRows(rows);
      setPropertyTalhoesAreaById(talhoesAreaByProperty);
      setPropertyTalhoesCountById(talhoesCountByProperty);
      setPropertyAnalysesCountById(analysesCountByProperty);
      setSelectedPropertyId((prev) => {
        if (prev && rows.some((row) => row.id === prev)) return prev;
        const stored = readSelectedPropertyByUser(currentUserId);
        if (stored && rows.some((row) => row.id === stored)) return stored;
        return rows[0]?.id ?? null;
      });
    } catch (err: any) {
      setLoadError(err?.message ?? 'Não foi possível carregar as propriedades.');
      setPropertyRows([]);
      setPropertyTalhoesAreaById({});
      setPropertyTalhoesCountById({});
      setPropertyAnalysesCountById({});
    } finally {
      setLoadingProperties(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (!drawerOpened) return;
    void loadProperties();
  }, [drawerOpened, loadProperties]);

  const loadTalhoesForSelectedProperty = useCallback(async () => {
    if (!selectedPropertyId) {
      setTalhaoRows([]);
      setTalhaoAnalysesCountById({});
      setSelectedTalhaoId(null);
      setTalhoesLoadError(null);
      return;
    }

    setLoadingTalhoes(true);
    setTalhoesLoadError(null);
    try {
      const [talhoes, analyses] = await Promise.all([
        fetchTalhoesByProperty(selectedPropertyId),
        fetchAnalysesByProperties([selectedPropertyId]),
      ]);

      const analysesCountByTalhao = analyses.reduce<Record<string, number>>((acc, row) => {
        acc[row.talhao_id] = (acc[row.talhao_id] ?? 0) + 1;
        return acc;
      }, {});

      setTalhaoRows(talhoes);
      setTalhaoAnalysesCountById(analysesCountByTalhao);
      setSelectedTalhaoId((prev) => {
        if (prev && talhoes.some((row) => row.id === prev)) return prev;
        if (currentUserId) {
          const stored = readSelectedTalhaoByUserAndProperty(
            currentUserId,
            selectedPropertyId,
          );
          if (stored && talhoes.some((row) => row.id === stored)) return stored;
        }
        return talhoes[0]?.id ?? null;
      });
    } catch (err: any) {
      setTalhaoRows([]);
      setTalhaoAnalysesCountById({});
      setSelectedTalhaoId(null);
      setTalhoesLoadError(err?.message ?? 'Não foi possível carregar os talhões da propriedade.');
    } finally {
      setLoadingTalhoes(false);
    }
  }, [currentUserId, selectedPropertyId]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    void loadTalhoesForSelectedProperty();
  }, [selectedPropertyId, loadTalhoesForSelectedProperty]);

  useEffect(() => {
    if (!talhaoDrawerOpened) return;
    void loadTalhoesForSelectedProperty();
  }, [talhaoDrawerOpened, loadTalhoesForSelectedProperty]);

  useEffect(() => {
    if (selectedPropertyId) return;
    if (talhaoDrawerOpened) {
      setTalhaoDrawerOpened(false);
      notifications.show({
        title: 'Sem propriedade ativa',
        message: 'Selecione ou cadastre uma propriedade antes de abrir os talhões.',
        color: 'yellow',
      });
    }
    setTalhaoRows([]);
    setTalhaoAnalysesCountById({});
    setSelectedTalhaoId(null);
    setTalhaoDetailOpened(false);
  }, [selectedPropertyId, talhaoDrawerOpened]);

  useEffect(() => {
    if (!currentUserId) return;
    writeSelectedPropertyByUser(currentUserId, selectedPropertyId);
  }, [currentUserId, selectedPropertyId]);

  useEffect(() => {
    if (!currentUserId || !selectedPropertyId) return;
    writeSelectedTalhaoByUserAndProperty(
      currentUserId,
      selectedPropertyId,
      selectedTalhaoId,
    );
  }, [currentUserId, selectedPropertyId, selectedTalhaoId]);

  const filteredProperties = useMemo(() => {
    const search = propertySearch.trim().toLowerCase();
    if (!search) return propertyRows;
    return propertyRows.filter((row) => row.nome.toLowerCase().includes(search));
  }, [propertyRows, propertySearch]);

  const exportTree = useMemo<PropertyExportPropertyNode[]>(() => {
    const talhoesByProperty = new Map<string, Talhao[]>();
    exportTalhoes.forEach((talhao) => {
      const list = talhoesByProperty.get(talhao.property_id) ?? [];
      list.push(talhao);
      talhoesByProperty.set(talhao.property_id, list);
    });

    const analysesByTalhao = new Map<string, AnalysisRow[]>();
    exportAnalyses.forEach((analysis) => {
      const list = analysesByTalhao.get(analysis.talhao_id) ?? [];
      list.push(analysis);
      analysesByTalhao.set(analysis.talhao_id, list);
    });

    return propertyRows.map((property) => {
      const talhoes = (talhoesByProperty.get(property.id) ?? []).map((talhao) => ({
        id: talhao.id,
        nodeId: toTalhaoNodeId(talhao.id),
        label: talhao.nome,
        analyses: (analysesByTalhao.get(talhao.id) ?? []).map((analysis) => ({
          id: analysis.id,
          nodeId: toAnalysisNodeId(analysis.id),
          label: formatAnalysisNodeLabel(analysis),
        })),
      }));

      return {
        id: property.id,
        nodeId: toPropertyNodeId(property.id),
        label: property.nome,
        talhoes,
      };
    });
  }, [propertyRows, exportTalhoes, exportAnalyses]);

  const selectedProperty = useMemo(
    () => propertyRows.find((row) => row.id === selectedPropertyId) ?? null,
    [propertyRows, selectedPropertyId],
  );
  const filteredTalhoes = useMemo(() => {
    const search = talhaoSearch.trim().toLowerCase();
    if (!search) return talhaoRows;
    return talhaoRows.filter((row) => row.nome.toLowerCase().includes(search));
  }, [talhaoRows, talhaoSearch]);
  const selectedTalhao = useMemo(
    () => talhaoRows.find((row) => row.id === selectedTalhaoId) ?? null,
    [selectedTalhaoId, talhaoRows],
  );
  const selectedTalhaoSoil = useMemo(() => {
    const soil = selectedTalhao?.tipo_solo?.trim() ?? '';
    if (!soil || isUnclassifiedSoil(soil)) return '';
    return soil;
  }, [selectedTalhao]);
  const selectedTalhaoArea = Number(selectedTalhao?.area_ha ?? 0);
  const selectedTalhaoAnalysesCount = selectedTalhao
    ? talhaoAnalysesCountById[selectedTalhao.id] ?? 0
    : 0;
  const showSelectedTalhaoArea = isPositiveNumber(selectedTalhaoArea);
  const showSelectedTalhaoAnalyses = selectedTalhaoAnalysesCount > 0;
  const talhaoSelectionRows = useMemo<TalhaoSelectionRow[]>(
    () =>
      filteredTalhoes.map((row) => ({
        ...row,
        analysesCount: talhaoAnalysesCountById[row.id] ?? 0,
      })),
    [filteredTalhoes, talhaoAnalysesCountById],
  );
  const propertyTotalAreaById = useMemo(
    () =>
      propertyRows.reduce<Record<string, number>>((acc, row) => {
        const talhoesArea = propertyTalhoesAreaById[row.id] ?? 0;
        const extraArea = sumNonTalhoesAreaAllocations(row);
        const calculatedTotal = talhoesArea + extraArea;
        const persistedTotal = Number(row.total_area ?? 0);

        if (Number.isFinite(calculatedTotal) && calculatedTotal > 0) {
          acc[row.id] = calculatedTotal;
        } else if (Number.isFinite(persistedTotal) && persistedTotal > 0) {
          acc[row.id] = persistedTotal;
        } else {
          acc[row.id] = 0;
        }

        return acc;
      }, {}),
    [propertyRows, propertyTalhoesAreaById],
  );
  const selectedPropertyTotalArea = selectedPropertyId
    ? propertyTotalAreaById[selectedPropertyId] ?? 0
    : 0;
  const selectedPropertyTalhoesArea = selectedPropertyId
    ? propertyTalhoesAreaById[selectedPropertyId] ?? 0
    : 0;
  const selectedPropertyOtherAreas = selectedProperty
    ? Math.max(0, selectedPropertyTotalArea - selectedPropertyTalhoesArea)
    : 0;
  const selectedPropertyTalhoesCount = selectedPropertyId
    ? propertyTalhoesCountById[selectedPropertyId] ?? 0
    : 0;
  const selectedPropertyAnalysesCount = selectedPropertyId
    ? propertyAnalysesCountById[selectedPropertyId] ?? 0
    : 0;
  const showSelectedPropertyOtherAreas = isPositiveNumber(selectedPropertyOtherAreas);
  const showSelectedPropertyTotalArea = isPositiveNumber(selectedPropertyTotalArea);
  const showSelectedPropertyTalhoes =
    selectedPropertyTalhoesCount > 0 || isPositiveNumber(selectedPropertyTalhoesArea);
  const showSelectedPropertyAnalyses = selectedPropertyAnalysesCount > 0;

  const updateSceneIconWidths = useCallback(() => {
    const propertyCardElement = propertyInfoCardRef.current;
    if (propertyCardElement) {
      const nextWidth = Math.max(
        120,
        Math.ceil(propertyCardElement.getBoundingClientRect().width * 1.03),
      );
      setPropertyIconWidthPx((prev) => (prev === nextWidth ? prev : nextWidth));
    } else {
      setPropertyIconWidthPx(null);
    }

    const talhaoCardElement = talhaoInfoCardRef.current;
    if (talhaoCardElement) {
      const nextWidth = Math.max(
        120,
        Math.ceil(talhaoCardElement.getBoundingClientRect().width * 1.03),
      );
      setTalhaoIconWidthPx((prev) => (prev === nextWidth ? prev : nextWidth));
    } else {
      setTalhaoIconWidthPx(null);
    }
  }, []);

  useEffect(() => {
    updateSceneIconWidths();
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => updateSceneIconWidths());
    if (propertyInfoCardRef.current) observer.observe(propertyInfoCardRef.current);
    if (talhaoInfoCardRef.current) observer.observe(talhaoInfoCardRef.current);

    return () => observer.disconnect();
  }, [
    updateSceneIconWidths,
    selectedPropertyId,
    selectedTalhaoId,
    showSelectedPropertyOtherAreas,
    showSelectedPropertyTotalArea,
    showSelectedPropertyTalhoes,
    showSelectedPropertyAnalyses,
    showSelectedTalhaoArea,
    showSelectedTalhaoAnalyses,
    selectedTalhaoSoil,
  ]);

  const propertyPlanSummary = useMemo(() => {
    if (!currentUserId) {
      return {
        used: propertyRows.length,
        included: 0,
        remaining: 0,
        exceeded: 0,
      };
    }

    const legacyPlanId = String((user as any)?.plan_id ?? (user as any)?.user_metadata?.plan_id ?? '').trim() || undefined;
    const subscription = getBillingSubscriptionForUser(currentUserId, legacyPlanId);
    const quote = calculateBillingQuote(subscription.plan_id, {
      properties: propertyRows.length,
      talhoes: 0,
      analises: 0,
      captured_at: new Date().toISOString(),
    });
    const propertiesLine = quote.lines.find((line) => line.feature_id === 'properties');
    const included = Math.max(0, propertiesLine?.included_units ?? 0);
    const used = Math.max(0, propertiesLine?.used_units ?? propertyRows.length);
    const remaining = Math.max(0, included - used);
    const exceeded = Math.max(0, used - included);

    return {
      used,
      included,
      remaining,
      exceeded,
    };
  }, [currentUserId, propertyRows.length, user]);

  const canCreateProperty =
    Boolean(currentUserId) && propertyPlanSummary.remaining > 0;

  const openPropertyCreate = () => {
    if (!canCreateProperty) {
      notifications.show({
        title: 'Limite de propriedades atingido',
        message: `Você já atingiu o limite do plano atual (${propertyPlanSummary.used}/${propertyPlanSummary.included}).`,
        color: 'yellow',
      });
      return;
    }
    setDrawerOpened(false);
    setPropertyModalMode('create');
  };

  const openPropertyEdit = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setDrawerOpened(false);
    setPropertyModalMode('edit');
  };

  const selectActiveProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setDrawerOpened(false);
  };

  const closePropertyModal = () => {
    if (savingProperty) return;
    setPropertyModalMode(null);
  };

  const openPropertyOnboardingWithHelp = () => {
    setPropertyOnboardingOpened(false);
    setDrawerOpened(true);
    notifications.show({
      title: 'Onboarding de propriedade',
      message: 'Use o botão Cadastrar no menu de propriedades. Se quiser, podemos guiar campo a campo.',
      color: 'blue',
    });
  };

  const openPropertyOnboardingWithoutHelp = () => {
    setPropertyOnboardingOpened(false);
    openPropertyCreate();
  };

  const openTalhaoMenu = () => {
    if (!selectedPropertyId) {
      setPropertyOnboardingOpened(true);
      notifications.show({
        title: 'Sem propriedade ativa',
        message: 'Antes de acessar talhões, selecione ou cadastre uma propriedade.',
        color: 'yellow',
      });
      return;
    }
    setTalhaoSearch('');
    setTalhaoDrawerOpened(true);
  };

  const openTalhaoCreate = async () => {
    if (!selectedPropertyId) {
      setPropertyOnboardingOpened(true);
      return;
    }
    try {
      const defaultName = `Novo talhão ${talhaoRows.length + 1}`;
      const created = await createTalhaoForProperty({
        propertyId: selectedPropertyId,
        nome: defaultName,
      });
      await Promise.all([loadTalhoesForSelectedProperty(), loadProperties()]);
      setSelectedTalhaoId(created.id);
      setTalhaoDrawerOpened(false);
      setTalhaoDetailOpened(true);
      notifications.show({
        title: 'Talhão criado',
        message: `${created.nome} criado. Complete os dados no detalhamento.`,
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao criar talhão',
        message: err?.message ?? 'Não foi possível iniciar o cadastro do talhão.',
        color: 'red',
      });
    }
  };

  const openTalhaoEdit = (talhaoId: string) => {
    const row = talhaoRows.find((item) => item.id === talhaoId);
    if (!row) return;
    setSelectedTalhaoId(row.id);
    setTalhaoDrawerOpened(false);
    setTalhaoDetailOpened(true);
  };

  const saveProperty = async (payload: PropertyFullModalSubmitPayload) => {
    if (!currentUserId) return;
    const nome = payload.nome.trim();
    if (!nome) {
      notifications.show({
        title: 'Nome obrigatorio',
        message: 'Informe o nome da propriedade para salvar.',
        color: 'yellow',
      });
      return;
    }

    try {
      setSavingProperty(true);
      if (propertyModalMode === 'create') {
        const created = await createPropertyForUser(
          currentUserId,
          nome,
          payload.contact,
          payload.patch,
        );
        await loadProperties();
        setSelectedPropertyId(created.id);
        notifications.show({
          title: 'Propriedade criada',
          message: `${created.nome} cadastrada com sucesso.`,
          color: 'green',
        });
      } else if (propertyModalMode === 'edit' && selectedPropertyId) {
        const updated = await updatePropertyForUser(
          selectedPropertyId,
          nome,
          payload.contact,
          payload.patch,
        );
        await loadProperties();
        setSelectedPropertyId(updated.id);
        notifications.show({
          title: 'Propriedade atualizada',
          message: `${updated.nome} atualizada com sucesso.`,
          color: 'green',
        });
      }
      if (propertyModalMode === 'create') {
        setPropertyModalMode(null);
      }
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar propriedade',
        message: err?.message ?? 'Não foi possível salvar a propriedade.',
        color: 'red',
      });
    } finally {
      setSavingProperty(false);
    }
  };

  const removeTalhao = (row: TalhaoSelectionRow) => {
    openTalhaoDeleteGuardModal({
      talhaoName: row.nome,
      analysesCount: row.analysesCount,
      onConfirm: async () => {
        try {
          await deleteTalhaoForProperty(row.id);
          await Promise.all([loadTalhoesForSelectedProperty(), loadProperties()]);
          notifications.show({
            title: 'Talhão excluido',
            message: `${row.nome} removido com sucesso.`,
            color: 'green',
          });
          return true;
        } catch (err: any) {
          notifications.show({
            title: 'Falha ao excluir talhão',
            message: err?.message ?? 'Não foi possível excluir o talhão.',
            color: 'red',
          });
          return false;
        }
      },
    });
  };

  const removeProperty = async (row: Property) => {
    try {
      const propertySnapshot = await loadPropertyDeletionSnapshot(row);

      openPropertyDeleteGuardModal({
        propertyName: row.nome,
        talhoesCount: propertySnapshot.talhoes.length,
        analysesCount: propertySnapshot.analyses.length,
        onConfirm: async ({ exportPdf }) => {
          try {
            if (exportPdf) {
              exportPropertySnapshotToPdf(propertySnapshot);
            }

            await deletePropertyForUser(row.id);
            await loadProperties();
            notifications.show({
              title: 'Propriedade excluida',
              message: `${row.nome} removida com sucesso.`,
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
          }
        },
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao preparar exclusão',
        message: err?.message ?? 'Não foi possível carregar os dados da propriedade.',
        color: 'red',
      });
    }
  };

  const openExportModal = async () => {
    if (propertyRows.length === 0) {
      notifications.show({
        title: 'Sem dados para exportar',
        message: 'Cadastre ao menos uma propriedade antes de exportar.',
        color: 'yellow',
      });
      return;
    }

    setLoadingExportTree(true);
    setExportModalOpened(true);
    setExportIncludeSoilClassification(true);
    try {
      const propertyIds = propertyRows.map((row) => row.id);
      const [talhoes, analyses] = await Promise.all([
        fetchTalhoesByProperties(propertyIds),
        fetchAnalysesByProperties(propertyIds),
      ]);

      setExportTalhoes(talhoes);
      setExportAnalyses(analyses);

      const allNodeIds = [
        ...propertyRows.map((row) => toPropertyNodeId(row.id)),
        ...talhoes.map((talhao) => toTalhaoNodeId(talhao.id)),
        ...analyses.map((analysis) => toAnalysisNodeId(analysis.id)),
      ];
      setExportSelectedItemIds(allNodeIds);
    } catch (err: any) {
      setExportTalhoes([]);
      setExportAnalyses([]);
      setExportSelectedItemIds(propertyRows.map((row) => toPropertyNodeId(row.id)));
      notifications.show({
        title: 'Falha ao carregar árvore de exportação',
        message: err?.message ?? 'Não foi possível carregar talhões e análises.',
        color: 'red',
      });
    } finally {
      setLoadingExportTree(false);
    }
  };

  const exportPropertiesPdf = async () => {
    if (!currentUserId) return;
    if (propertyRows.length === 0) return;
    if (loadingExportTree) return;

    const selectedSet = new Set(exportSelectedItemIds);
    if (selectedSet.size === 0) {
      notifications.show({
        title: 'Selecione itens',
        message: 'Marque ao menos um item da árvore para exportação.',
        color: 'yellow',
      });
      return;
    }

    try {
      setExportingPdf(true);
      const selectedAnalyses = exportAnalyses.filter((analysis) =>
        selectedSet.has(toAnalysisNodeId(analysis.id)),
      );

      const selectedTalhaoIds = new Set(
        exportTalhoes
          .filter((talhao) => selectedSet.has(toTalhaoNodeId(talhao.id)))
          .map((talhao) => talhao.id),
      );
      selectedAnalyses.forEach((analysis) => selectedTalhaoIds.add(analysis.talhao_id));

      const selectedTalhoes = exportTalhoes.filter((talhao) =>
        selectedTalhaoIds.has(talhao.id),
      );

      const selectedPropertyIds = new Set(
        propertyRows
          .filter((property) => selectedSet.has(toPropertyNodeId(property.id)))
          .map((property) => property.id),
      );
      selectedTalhoes.forEach((talhao) => selectedPropertyIds.add(talhao.property_id));
      selectedAnalyses.forEach((analysis) => selectedPropertyIds.add(analysis.property_id));

      if (selectedPropertyIds.size === 0) {
        notifications.show({
          title: 'Selecione propriedades',
          message: 'Marque ao menos uma propriedade, talhão ou análise para exportar.',
          color: 'yellow',
        });
        return;
      }

      const selectedProperties = propertyRows.filter((property) =>
        selectedPropertyIds.has(property.id),
      );

      const includeProperties = selectedProperties.length > 0;
      const includeTalhoes = selectedTalhoes.length > 0;
      const includeAnalyses = selectedAnalyses.length > 0;

      exportPropertiesDataToPdf({
        sections: {
          properties: includeProperties,
          talhoes: includeTalhoes,
          analyses: includeAnalyses,
          soilClassification: exportIncludeSoilClassification,
        },
        properties: selectedProperties,
        talhoes: selectedTalhoes,
        analyses: selectedAnalyses,
      });

      setExportModalOpened(false);
      notifications.show({
        title: 'Exportacao iniciada',
        message: 'Na janela aberta, escolha "Salvar como PDF".',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao exportar',
        message: err?.message ?? 'Não foi possível gerar o PDF.',
        color: 'red',
      });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <>
      <Box
        style={{
          position: 'relative',
          minHeight: 'clamp(420px, 68vh, 760px)',
          borderRadius: 16,
          overflow: 'hidden',
          border: tema === 'dark' ? '1px solid rgba(71, 85, 105, 0.6)' : '1px solid rgba(100, 116, 139, 0.45)',
          backgroundImage: `${overlay}, url('/backgrounds/game-field.svg')`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <Box
          style={{
            position: 'absolute',
            top: 'clamp(10px, 2.2vh, 26px)',
            right: 'clamp(10px, 2.2vw, 26px)',
            zIndex: 4,
          }}
        >
          <Box
            component="button"
            type="button"
            className="dashboard-store-balloon"
            title="Abrir loja interna"
            aria-label="Abrir loja interna"
            onClick={() => navigate('/marketplace')}
            onMouseEnter={() => setStoreHovered(true)}
            onMouseLeave={() => setStoreHovered(false)}
            style={{
              transform: storeHovered
                ? 'translateY(-4px) scale(1.03)'
                : 'translateY(0) scale(1)',
            }}
          >
            <img
              src="/sprites/store-balloon.vector.svg"
              alt="Balão da loja interna"
              className="dashboard-store-balloon-image"
              draggable={false}
            />
          </Box>
        </Box>

        <Box
          className="dashboard-scene-standard"
          style={{
            position: 'absolute',
            left: 'clamp(14px, 6vw, 78px)',
            bottom: 'clamp(12px, 5vh, 52px)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0,
            zIndex: 2,
            maxWidth: '94%',
          }}
        >
          <Box className="dashboard-scene-item">
            <Box
              component="button"
              type="button"
              className="dashboard-scene-icon-button"
              title="Abrir menu de propriedades"
              aria-label="Abrir menu de propriedades"
              onClick={() => setDrawerOpened(true)}
              onMouseEnter={() => setHouseHovered(true)}
              onMouseLeave={() => setHouseHovered(false)}
              style={{
                width: propertyIconWidthPx ? `${propertyIconWidthPx}px` : undefined,
                transform: houseHovered ? 'translateY(-6px) scale(1.03)' : 'translateY(0) scale(1)',
                transition: 'transform 180ms ease, filter 180ms ease',
                filter: houseHovered ? 'drop-shadow(0 14px 22px rgba(15, 23, 42, 0.45))' : 'drop-shadow(0 8px 14px rgba(15, 23, 42, 0.36))',
              }}
            >
              <img
                src="/sprites/farmhouse-property.png"
                alt="Casa da propriedade"
                className="dashboard-scene-image dashboard-property-image"
                draggable={false}
              />
            </Box>

            <Card
              ref={propertyInfoCardRef}
              className="dashboard-scene-info-card dashboard-property-info-card dashboard-info-card border-slate-200/50 dark:border-slate-800/50 shadow-xl backdrop-blur-md bg-white/90 dark:bg-slate-950/90"
            >
              <CardHeader className="p-3 pb-0 space-y-0 text-center">
                <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Propriedade Ativa
                </CardTitle>
                <div className="text-sm font-bold truncate">
                  {selectedProperty ? selectedProperty.nome : "Selecione na casa"}
                </div>
              </CardHeader>
              {selectedProperty && (
                <CardContent className="p-3 pt-1 space-y-1 text-center">
                  <div className="flex flex-col gap-0.5">
                    {showSelectedPropertyTotalArea && (
                      <Badge variant="outline" className="mx-auto text-[10px] h-5 border-teal-500/30 text-teal-700 dark:text-teal-300">
                        Total: {formatAreaHa(selectedPropertyTotalArea)} ha
                      </Badge>
                    )}
                    <div className="grid grid-cols-1 gap-1 mt-1 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                      {showSelectedPropertyOtherAreas && (
                        <span>Outras: {formatAreaHa(selectedPropertyOtherAreas)} ha</span>
                      )}
                      {showSelectedPropertyTalhoes && (
                        <span>Talhões: {selectedPropertyTalhoesCount} ({formatAreaHa(selectedPropertyTalhoesArea)} ha)</span>
                      )}
                      {showSelectedPropertyAnalyses && (
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          Análises: {selectedPropertyAnalysesCount}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </Box>

          {selectedProperty ? (
            <Box className="dashboard-scene-item">
              <Box
                component="button"
                type="button"
                className="dashboard-scene-icon-button"
                title="Abrir menu de talhões"
                aria-label="Abrir menu de talhões"
                onClick={openTalhaoMenu}
                onMouseEnter={() => setPlotHovered(true)}
                onMouseLeave={() => setPlotHovered(false)}
                style={{
                  width: talhaoIconWidthPx ? `${talhaoIconWidthPx}px` : undefined,
                  transform: plotHovered ? 'translateY(-5px) scale(1.02)' : 'translateY(0) scale(1)',
                  transition: 'transform 180ms ease, filter 180ms ease',
                  filter: plotHovered ? 'drop-shadow(0 12px 18px rgba(15, 23, 42, 0.42))' : 'drop-shadow(0 7px 12px rgba(15, 23, 42, 0.3))',
                }}
              >
                <img
                  src="/sprites/plowed-field-plot.png"
                  alt="Terra arada para abrir menu de talhões"
                  className="dashboard-scene-image dashboard-talhao-image"
                  draggable={false}
                />
              </Box>

              <Card
                ref={talhaoInfoCardRef}
                className="dashboard-scene-info-card dashboard-talhao-info-card dashboard-info-card border-slate-200/50 dark:border-slate-800/50 shadow-xl backdrop-blur-md bg-white/90 dark:bg-slate-950/90"
              >
                <CardHeader className="p-3 pb-0 space-y-0 text-center">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Talhão Selecionado
                  </CardTitle>
                  <div className="text-sm font-bold truncate">
                    {selectedTalhao ? selectedTalhao.nome : "Selecione no terreno"}
                  </div>
                </CardHeader>
                {selectedTalhao && (
                  <CardContent className="p-3 pt-1 space-y-1 text-center">
                    <div className="flex flex-col gap-0.5">
                      {showSelectedTalhaoArea && (
                        <Badge variant="outline" className="mx-auto text-[10px] h-5 border-amber-500/30 text-amber-700 dark:text-amber-300">
                          Área: {formatAreaHa(selectedTalhaoArea)} ha
                        </Badge>
                      )}
                      <div className="grid grid-cols-1 gap-1 mt-1 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                        {selectedTalhaoSoil && (
                          <span>Solo: {selectedTalhaoSoil}</span>
                        )}
                        {showSelectedTalhaoAnalyses && (
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            Análises: {selectedTalhaoAnalysesCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </Box>
          ) : null}
        </Box>
      </Box>

      <Dialog open={drawerOpened} onOpenChange={setDrawerOpened}>
        <DialogContent className="max-w-[760px] w-[92vw] overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Selecionar propriedade</DialogTitle>
            <DialogDescription className="hidden">
              Pesquise e selecione a propriedade ativa para trabalhar no dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-2">
            <div
              className={cn(
                "text-[10px] leading-relaxed rounded-lg p-2 border",
                tema === 'dark'
                  ? 'border-slate-800 bg-slate-900/50'
                  : 'border-slate-200 bg-slate-50/90'
              )}
            >
              Propriedades: <span className="font-bold">{propertyPlanSummary.used}</span>
              {' | '}Limite: <span className="font-bold">{propertyPlanSummary.included}</span>
              {' | '}Restantes:{' '}
              <span
                className={cn(
                  "font-bold",
                  propertyPlanSummary.remaining > 0 ? 'text-teal-600' : 'text-orange-600'
                )}
              >
                {propertyPlanSummary.remaining}
              </span>
              {propertyPlanSummary.exceeded > 0 && (
                <>
                  {' | '}Excedente:{' '}
                  <span className="font-bold text-orange-600">
                    {propertyPlanSummary.exceeded}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <ShadInput
                  placeholder="Buscar propriedade por nome"
                  value={propertySearch}
                  onChange={(event) => setPropertySearch(event.currentTarget.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2 whitespace-nowrap">
                <ShadButton
                  variant="outline"
                  size="sm"
                  onClick={openExportModal}
                  disabled={loadingProperties || propertyRows.length === 0}
                  className="h-9"
                >
                  <IconFileExport className="mr-2 h-4 w-4" />
                  Exportar
                </ShadButton>
                <ShadButton
                  size="sm"
                  onClick={openPropertyCreate}
                  disabled={!canCreateProperty}
                  className="h-9 bg-indigo-600 hover:bg-indigo-700"
                >
                  <IconPlus className="mr-2 h-4 w-4" />
                  Cadastrar
                </ShadButton>
              </div>
            </div>

            {loadingProperties ? (
              <div className="flex items-center gap-2 py-4">
                <Loader size="sm" />
                <span className="text-sm text-slate-500">Carregando propriedades...</span>
              </div>
            ) : loadError ? (
              <div className="flex flex-col gap-2">
                <span className="text-sm text-red-500">{loadError}</span>
                <ShadButton variant="outline" size="sm" onClick={() => void loadProperties()}>
                  Tentar novamente
                </ShadButton>
              </div>
            ) : filteredProperties.length === 0 ? (
              <div className="flex flex-col gap-3 py-4">
                <span className="text-sm text-slate-500 italic">
                  {canCreateProperty
                    ? 'Nenhuma propriedade cadastrada. Inicie um onboarding com ajuda ou cadastre direto.'
                    : 'Nenhuma propriedade cadastrada e o limite de seu plano foi atingido.'}
                </span>
                {canCreateProperty && (
                  <div className="flex flex-wrap gap-2">
                    <ShadButton variant="outline" size="sm" onClick={() => setPropertyOnboardingOpened(true)}>
                      Cadastrar com ajuda
                    </ShadButton>
                    <ShadButton size="sm" onClick={openPropertyCreate}>
                      Cadastrar sem ajuda
                    </ShadButton>
                  </div>
                )}
              </div>
            ) : (
              <ShadScrollArea className="flex-1 -mx-2 px-2 overflow-y-auto max-h-[52vh]">
                <div className="flex flex-col gap-2 pr-4">
                  {filteredProperties.map((row) => {
                    const selected = row.id === selectedPropertyId;
                    const rowTotalArea = propertyTotalAreaById[row.id] ?? 0;
                    const rowTalhoesCount = propertyTalhoesCountById[row.id] ?? 0;
                    const rowTalhoesArea = propertyTalhoesAreaById[row.id] ?? 0;
                    const rowAnalysesCount = propertyAnalysesCountById[row.id] ?? 0;
                    const rowMetaParts: string[] = [];
                    if (isPositiveNumber(rowTotalArea)) {
                      rowMetaParts.push(`Área total: ${formatAreaHa(rowTotalArea)} ha`);
                    }
                    if (rowTalhoesCount > 0 || isPositiveNumber(rowTalhoesArea)) {
                      rowMetaParts.push(
                        `Talhões: ${rowTalhoesCount} (${formatAreaHa(rowTalhoesArea)} ha)`,
                      );
                    }
                    if (rowAnalysesCount > 0) {
                      rowMetaParts.push(`Análises: ${rowAnalysesCount}`);
                    }
                    return (
                      <div
                        key={row.id}
                        className={cn(
                          "group rounded-xl border p-3 transition-all",
                          selected
                            ? tema === 'dark'
                              ? 'border-teal-500/50 bg-teal-500/10'
                              : 'border-teal-200 bg-teal-50'
                            : tema === 'dark'
                              ? 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                              : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <span
                              className={cn(
                                "font-bold text-sm truncate",
                                selected ? "text-teal-700 dark:text-teal-400" : ""
                              )}
                            >
                              {row.nome}
                            </span>
                            {rowMetaParts.length > 0 && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                {rowMetaParts.join(' | ')}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 shrink-0">
                            <ShadButton
                              size="sm"
                              variant={selected ? 'default' : 'ghost'}
                              className={cn(
                                "h-8 text-xs",
                                selected 
                                  ? "bg-teal-600 hover:bg-teal-700 text-white" 
                                  : "bg-slate-200/50 dark:bg-slate-800/50 hover:bg-slate-300 dark:hover:bg-slate-700"
                              )}
                              onClick={() => selectActiveProperty(row.id)}
                            >
                              {selected ? 'Ativa' : 'Selecionar'}
                            </ShadButton>
                            <ShadButton
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-400"
                              onClick={() => openPropertyEdit(row.id)}
                            >
                              <IconEdit className="mr-1.5 h-3 w-3" />
                              Editar
                            </ShadButton>
                            <ShadButton
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
                              onClick={() => void removeProperty(row)}
                            >
                              <IconTrash className="mr-1.5 h-3 w-3" />
                              Excluir
                            </ShadButton>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ShadScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PropertyExportModal
        opened={exportModalOpened}
        onClose={() => {
          if (exportingPdf || loadingExportTree) return;
          setExportModalOpened(false);
        }}
        loading={loadingExportTree}
        exporting={exportingPdf}
        tree={exportTree}
        selectedNodeIds={exportSelectedItemIds}
        onSelectedNodeIdsChange={setExportSelectedItemIds}
        includeSoilClassification={exportIncludeSoilClassification}
        onIncludeSoilClassificationChange={setExportIncludeSoilClassification}
        onExport={() => void exportPropertiesPdf()}
      />

      <TalhaoSelectorModal
        opened={talhaoDrawerOpened}
        onClose={() => setTalhaoDrawerOpened(false)}
        propertyName={selectedProperty?.nome ?? 'Propriedade ativa'}
        tema={tema}
        loading={loadingTalhoes}
        loadError={talhoesLoadError}
        searchValue={talhaoSearch}
        onSearchChange={setTalhaoSearch}
        rows={talhaoSelectionRows}
        selectedTalhaoId={selectedTalhaoId}
        onSelectTalhao={setSelectedTalhaoId}
        onExport={() => {
          setTalhaoDrawerOpened(false);
          void openExportModal();
        }}
        onCreateTalhao={openTalhaoCreate}
        onEditTalhao={openTalhaoEdit}
        onDeleteTalhao={(row) => void removeTalhao(row)}
        onRetryLoad={() => void loadTalhoesForSelectedProperty()}
      />

      <Dialog open={propertyOnboardingOpened} onOpenChange={setPropertyOnboardingOpened}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cadastrar propriedade</DialogTitle>
            <DialogDescription>
              Para trabalhar com talhões no dashboard, primeiro cadastre uma propriedade.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium">Escolha como deseja seguir:</p>
            <div className="flex gap-3">
              <ShadButton
                variant="outline"
                className="flex-1"
                onClick={openPropertyOnboardingWithHelp}
              >
                Com ajuda
              </ShadButton>
              <ShadButton
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={openPropertyOnboardingWithoutHelp}
              >
                Sem ajuda
              </ShadButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PropertyFullModal
        opened={propertyModalMode !== null}
        mode={propertyModalMode ?? 'create'}
        onClose={closePropertyModal}
        onSubmit={saveProperty}
        saving={savingProperty}
        userId={currentUserId}
        property={propertyModalMode === 'edit' ? selectedProperty : null}
        talhoesAreaHa={0}
      />

      <TalhaoDetailModal
        opened={talhaoDetailOpened}
        talhao={selectedTalhao}
        onClose={() => setTalhaoDetailOpened(false)}
        onSaved={async (talhaoId) => {
          await Promise.all([loadTalhoesForSelectedProperty(), loadProperties()]);
          setSelectedTalhaoId(talhaoId);
        }}
        onDeleted={async () => {
          await Promise.all([loadTalhoesForSelectedProperty(), loadProperties()]);
        }}
      />
    </>
  );
}
