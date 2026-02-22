import {
  Box,
  Button,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
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

            <Box
              ref={propertyInfoCardRef}
              className="dashboard-scene-info-card dashboard-property-info-card dashboard-info-card"
            >
              {selectedProperty ? (
                <>
                  <Text size="xs" fw={700} ta="center">
                    Propriedade selecionada:
                  </Text>
                  <Text size="sm" fw={700} ta="center">
                    {selectedProperty.nome}
                  </Text>
                  {showSelectedPropertyOtherAreas ? (
                    <Text size="xs" fw={600} ta="center">
                      Outras áreas: {formatAreaHa(selectedPropertyOtherAreas)} ha
                    </Text>
                  ) : null}
                  {showSelectedPropertyTotalArea ? (
                    <Text size="xs" fw={700} ta="center">
                      Total: {formatAreaHa(selectedPropertyTotalArea)} ha
                    </Text>
                  ) : null}
                  {showSelectedPropertyTalhoes ? (
                    <Text size="xs" fw={600} ta="center">
                      Talhões: {selectedPropertyTalhoesCount} ({formatAreaHa(selectedPropertyTalhoesArea)} ha)
                    </Text>
                  ) : null}
                  {showSelectedPropertyAnalyses ? (
                    <Text size="xs" fw={600} ta="center">
                      Análises: {selectedPropertyAnalysesCount}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text size="sm" fw={700} ta="center">
                  Selecione uma propriedade na casa
                </Text>
              )}
            </Box>
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

              <Box
                ref={talhaoInfoCardRef}
                className="dashboard-scene-info-card dashboard-talhao-info-card dashboard-info-card"
              >
                {selectedTalhao ? (
                  <>
                    <Text size="xs" fw={700} ta="center">
                      Talhão selecionado:
                    </Text>
                    <Text size="xs" fw={700} ta="center">
                      {selectedTalhao.nome}
                    </Text>
                    {showSelectedTalhaoArea ? (
                      <Text size="xs" fw={600} ta="center">
                        Área: {formatAreaHa(selectedTalhaoArea)} ha
                      </Text>
                    ) : null}
                    {selectedTalhaoSoil ? (
                      <Text size="xs" fw={600} ta="center">
                        Solo: {selectedTalhaoSoil}
                      </Text>
                    ) : null}
                    {showSelectedTalhaoAnalyses ? (
                      <Text size="xs" fw={600} ta="center">
                        Análises: {selectedTalhaoAnalysesCount}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text size="xs" fw={700} ta="center">
                    Selecione um talhão no terreno
                  </Text>
                )}
              </Box>
            </Box>
          ) : null}
        </Box>
      </Box>

      <Modal
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        centered
        size="clamp(320px, 92vw, 760px)"
        radius="md"
        withCloseButton
        title="Selecionar propriedade"
      >
        <Stack gap="xs">
          <Text
            size="xs"
            style={{
              borderRadius: 8,
              padding: '4px 6px',
              border:
                tema === 'dark'
                  ? '1px solid rgba(100, 116, 139, 0.35)'
                  : '1px solid rgba(148, 163, 184, 0.4)',
              background:
                tema === 'dark'
                  ? 'rgba(15, 23, 42, 0.35)'
                  : 'rgba(248, 250, 252, 0.92)',
            }}
          >
            Propriedades: <Text span fw={700}>{propertyPlanSummary.used}</Text>
            {' | '}Limite: <Text span fw={700}>{propertyPlanSummary.included}</Text>
            {' | '}Restantes:{' '}
            <Text
              span
              fw={700}
              c={propertyPlanSummary.remaining > 0 ? 'teal' : 'orange'}
            >
              {propertyPlanSummary.remaining}
            </Text>
            {propertyPlanSummary.exceeded > 0 ? (
              <>
                {' | '}Excedente:{' '}
                <Text span fw={700} c="orange">
                  {propertyPlanSummary.exceeded}
                </Text>
              </>
            ) : null}
          </Text>

          <Group align="center" wrap="wrap" gap="xs">
            <TextInput
              leftSection={<IconSearch size={14} />}
              placeholder="Buscar propriedade por nome"
              value={propertySearch}
              onChange={(event) => setPropertySearch(event.currentTarget.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <Group gap="xs" wrap="nowrap">
              <Button
                variant="light"
                color="blue"
                leftSection={<IconFileExport size={14} />}
                onClick={openExportModal}
                radius="md"
                disabled={loadingProperties || propertyRows.length === 0}
                title="Exportar propriedades/talhões/análises em PDF"
              >
                Exportar
              </Button>
              <Button
                leftSection={<IconPlus size={14} />}
                onClick={openPropertyCreate}
                radius="md"
                disabled={!canCreateProperty}
                title={
                  canCreateProperty
                    ? 'Cadastrar nova propriedade'
                    : `Limite atingido (${propertyPlanSummary.used}/${propertyPlanSummary.included})`
                }
              >
                Cadastrar
              </Button>
            </Group>
          </Group>

          {loadingProperties ? (
            <Group gap="xs">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Carregando propriedades...
              </Text>
            </Group>
          ) : loadError ? (
            <Stack gap={6}>
              <Text size="sm" c="red">
                {loadError}
              </Text>
              <Button variant="light" size="xs" onClick={() => void loadProperties()}>
                Tentar novamente
              </Button>
            </Stack>
          ) : filteredProperties.length === 0 ? (
            <Stack gap={8}>
              <Text size="sm" c="dimmed">
                {canCreateProperty
                  ? 'Nenhuma propriedade cadastrada. Inicie um onboarding com ajuda ou cadastre direto.'
                  : 'Nenhuma propriedade cadastrada e o limite de cadastro do plano atual foi atingido.'}
              </Text>
              {canCreateProperty ? (
                <Group gap="xs" wrap="wrap">
                  <Button size="xs" variant="light" color="blue" onClick={() => setPropertyOnboardingOpened(true)}>
                    Cadastrar com ajuda
                  </Button>
                  <Button size="xs" onClick={openPropertyCreate}>
                    Cadastrar sem ajuda
                  </Button>
                </Group>
              ) : null}
            </Stack>
          ) : (
            <ScrollArea.Autosize mah="52vh" type="always">
              <Stack gap={6} pr={2}>
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
                    <Box
                      key={row.id}
                      style={{
                        borderRadius: 10,
                        border:
                          tema === 'dark'
                            ? '1px solid rgba(100, 116, 139, 0.35)'
                            : '1px solid rgba(148, 163, 184, 0.45)',
                        background:
                          selected
                            ? tema === 'dark'
                              ? 'rgba(20, 184, 166, 0.16)'
                              : 'rgba(20, 184, 166, 0.12)'
                            : tema === 'dark'
                              ? 'rgba(15, 23, 42, 0.34)'
                              : 'rgba(248, 250, 252, 0.9)',
                        padding: '7px 8px',
                      }}
                    >
                      <Group justify="space-between" wrap="wrap" gap={6}>
                        <Text
                          fw={selected ? 700 : 600}
                          size="sm"
                          c={selected ? 'teal' : undefined}
                          style={{
                            minWidth: 140,
                            maxWidth: 250,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {row.nome}
                        </Text>
                        {rowMetaParts.length > 0 ? (
                          <Text size="xs" c="dimmed">
                            {rowMetaParts.join(' | ')}
                          </Text>
                        ) : null}
                        <Group gap={6} wrap="wrap">
                          <Button
                            size="xs"
                            variant={selected ? 'filled' : 'light'}
                            color={selected ? 'teal' : 'gray'}
                            onClick={() => selectActiveProperty(row.id)}
                          >
                            {selected ? 'Ativa' : 'Selecionar'}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="indigo"
                            leftSection={<IconEdit size={14} />}
                            onClick={() => openPropertyEdit(row.id)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => void removeProperty(row)}
                          >
                            Excluir
                          </Button>
                        </Group>
                      </Group>
                    </Box>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>
          )}
        </Stack>
      </Modal>

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

      <Modal
        opened={propertyOnboardingOpened}
        onClose={() => setPropertyOnboardingOpened(false)}
        centered
        radius="md"
        title="Cadastrar propriedade"
      >
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Para trabalhar com talhões no dashboard, primeiro cadastre uma propriedade.
          </Text>
          <Text size="sm">
            Escolha como deseja seguir:
          </Text>
          <Group gap="xs" wrap="wrap">
            <Button variant="light" color="blue" onClick={openPropertyOnboardingWithHelp}>
              Com ajuda
            </Button>
            <Button onClick={openPropertyOnboardingWithoutHelp}>
              Sem ajuda
            </Button>
          </Group>
        </Stack>
      </Modal>

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
