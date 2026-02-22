import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Card,
  Collapse,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconBan,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconDeviceFloppy,
  IconHelpCircle,
  IconMap2,
  IconMapOff,
  IconMinus,
  IconPencil,
  IconPlus,
  IconPolygon,
  IconSearch,
  IconTrash,
  IconVectorSpline,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  Stage,
  Layer,
  Line,
  Circle,
  Group as KonvaGroup,
  Text as KonvaText,
} from 'react-konva';
import type { Talhao } from '../../types/property';
import mapReferenceBg from '../../assets/map-reference-bg.svg';
import {
  findSoilCatalogEntry,
  listSoilCatalog,
  type SoilCatalogEntry,
} from '../../services/soilCatalogService';
import {
  parseTalhaoGeometry,
  deleteTalhaoForProperty,
  type MapPoint,
  type TalhaoSoilClassificationSnapshot,
  updateTalhaoForProperty,
} from '../../services/propertyMapService';
import {
  resolveGeoPointFromInput,
  parseCoordinatesInput,
  type GeoPoint,
} from '../../services/mapBackgroundService';
import {
  GEO_BASE_LAYERS,
  type GeoLayerId,
} from '../../modules/geo/baseLayers';
import type {
  SoilClassificationRequest,
  SoilResultResponse,
} from '../../services/soilClassificationContractService';
import {
  type RncCultivarSelectionPayload,
} from '../../services/rncCultivarService';
import { duplicateCultivarTechnicalProfile } from '../../services/cultivarTechnicalProfilesService';
import { lazyWithBoundary } from '../../router/lazyWithBoundary';
import { CRS, latLng } from 'leaflet';
import RncCultivarSelector from '../../views/Rnc/RncCultivarSelector';

const LazyGeoBackdropMap = lazyWithBoundary(
  () =>
    import('../../modules/geo/GeoBackdropMap').then((module) => ({
      default: module.GeoBackdropMap,
    })),
  'GeoBackdropMap',
);

const LazySoilClassificationWorkspace = lazyWithBoundary(
  () =>
    import('../../modules/soilClassification').then((module) => ({
      default: module.SoilClassificationWorkspace,
    })),
  'SoilClassificationWorkspace',
);

type DrawMode = 'none' | 'main' | 'zone';
type CultureModalMode = 'edit';
type SelectedVertex =
  | { kind: 'main'; pointIndex: number }
  | { kind: 'zone'; zoneIndex: number; pointIndex: number };

type CultureEntry = {
  cultura: string;
  cultivar?: string;
  especie_nome_comum?: string;
  especie_nome_cientifico?: string;
  grupo_especie?: string;
  rnc_detail_url?: string;
  technical_profile_id?: string;
  technical_priority?: 'species' | 'cultivar';
  data_inicio: string;
  data_fim: string;
  fonte?: string;
};

const UNCLASSIFIED_SOIL_VALUE = '__nao_classificado__';
const UNCLASSIFIED_SOIL_LABEL = 'Não classificado';
const DEFAULT_SOIL_LINKED_COLOR = '#81C784';
const SOIL_COLOR_BY_ORDER: Record<string, string> = {
  argissolos: '#B45309',
  cambissolos: '#A16207',
  chernossolos: '#78350F',
  espodossolos: '#475569',
  gleissolos: '#0EA5A4',
  latossolos: '#7C3AED',
  luvissolos: '#D97706',
  neossolos: '#6B7280',
  nitossolos: '#16A34A',
  organossolos: '#166534',
  planossolos: '#2563EB',
  plintossolos: '#B91C1C',
  vertissolos: '#4F46E5',
};

function flattenPoints(points: MapPoint[]) {
  return points.flatMap((p) => [p.x, p.y]);
}

function polygonBounds(points: MapPoint[]) {
  if (!points.length) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  return points.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y),
    }),
    { minX: points[0].x, maxX: points[0].x, minY: points[0].y, maxY: points[0].y },
  );
}

function isPointOnSegment(point: MapPoint, start: MapPoint, end: MapPoint): boolean {
  const cross =
    (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > 0.5) return false;

  const dot =
    (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  if (dot < 0) return false;

  const squaredLength =
    (end.x - start.x) * (end.x - start.x) + (end.y - start.y) * (end.y - start.y);
  return dot <= squaredLength;
}

function isPointInsidePolygon(point: MapPoint, polygon: MapPoint[]): boolean {
  if (polygon.length < 3) return false;

  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (isPointOnSegment(point, a, b)) return true;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function signedArea2(a: MapPoint, b: MapPoint, c: MapPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function isProperSegmentIntersection(
  a1: MapPoint,
  a2: MapPoint,
  b1: MapPoint,
  b2: MapPoint,
): boolean {
  const o1 = signedArea2(a1, a2, b1);
  const o2 = signedArea2(a1, a2, b2);
  const o3 = signedArea2(b1, b2, a1);
  const o4 = signedArea2(b1, b2, a2);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function isSegmentInsidePolygon(start: MapPoint, end: MapPoint, polygon: MapPoint[]): boolean {
  if (polygon.length < 3) return false;
  if (!isPointInsidePolygon(start, polygon) || !isPointInsidePolygon(end, polygon)) {
    return false;
  }
  if (!isPointInsidePolygon(midpoint(start, end), polygon)) return false;

  for (let i = 0; i < polygon.length; i += 1) {
    const edgeA = polygon[i];
    const edgeB = polygon[(i + 1) % polygon.length];
    if (isProperSegmentIntersection(start, end, edgeA, edgeB)) {
      return false;
    }
  }
  return true;
}

function isPolygonInsidePolygon(inner: MapPoint[], outer: MapPoint[]): boolean {
  if (inner.length < 3 || outer.length < 3) return false;

  if (!inner.every((point) => isPointInsidePolygon(point, outer))) return false;

  for (let i = 0; i < inner.length; i += 1) {
    const innerA = inner[i];
    const innerB = inner[(i + 1) % inner.length];

    // Em poligonos concavos, dois pontos internos podem formar aresta externa.
    // Validamos um ponto no meio da aresta para garantir que o segmento permaneceu dentro.
    if (!isSegmentInsidePolygon(innerA, innerB, outer)) return false;
  }

  return true;
}

function midpoint(start: MapPoint, end: MapPoint): MapPoint {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function geoPointToCanvasPoint(
  geoPoint: GeoPoint,
  viewCenter: GeoPoint,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
): MapPoint {
  const centerProjected = CRS.EPSG3857.latLngToPoint(
    latLng(viewCenter.lat, viewCenter.lon),
    zoom,
  );
  const targetProjected = CRS.EPSG3857.latLngToPoint(
    latLng(geoPoint.lat, geoPoint.lon),
    zoom,
  );

  return {
    x: targetProjected.x - centerProjected.x + canvasWidth / 2,
    y: targetProjected.y - centerProjected.y + canvasHeight / 2,
  };
}

function normalizeMonthYear(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const isoMatch = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    if (year >= 1900 && month >= 1 && month <= 12) {
      return `${isoMatch[1]}-${isoMatch[2]}`;
    }
  }

  const brMatch = raw.match(/^(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const month = Number(brMatch[1]);
    const year = Number(brMatch[2]);
    if (year >= 1900 && month >= 1 && month <= 12) {
      return `${brMatch[2]}-${brMatch[1]}`;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  if (year < 1900 || month < 1 || month > 12) return '';
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`;
}

function monthYearOrder(value?: string | null): number {
  const normalized = normalizeMonthYear(value);
  if (!normalized) return Number.NaN;
  const [yearText, monthText] = normalized.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return Number.NaN;
  return year * 12 + month;
}

function formatMonthYear(value?: string | null): string {
  const normalized = normalizeMonthYear(value);
  if (!normalized) return '-';
  const [year, month] = normalized.split('-');
  return `${month}/${year}`;
}

function normalizeKey(value?: string | null): string {
  return (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isUnclassifiedSoilValue(value?: string | null): boolean {
  const normalized = normalizeKey(value);
  return (
    normalized === normalizeKey(UNCLASSIFIED_SOIL_VALUE) ||
    normalized === normalizeKey(UNCLASSIFIED_SOIL_LABEL)
  );
}

function resolveSoilLinkedColor(
  soilValue?: string | null,
  fallback?: string | null,
): string {
  const normalized = normalizeKey(soilValue);
  if (normalized && SOIL_COLOR_BY_ORDER[normalized]) return SOIL_COLOR_BY_ORDER[normalized];
  return (fallback && fallback.trim()) || DEFAULT_SOIL_LINKED_COLOR;
}

function normalizeGeoLayerId(value?: string | null): GeoLayerId {
  if (value === 'streets' || value === 'topographic' || value === 'satellite') {
    return value;
  }
  return 'satellite';
}

interface TalhaoDetailModalProps {
  opened: boolean;
  talhao: Talhao | null;
  onClose: () => void;
  onSaved: (talhaoId: string) => Promise<void> | void;
  onDeleted?: (talhaoId: string) => Promise<void> | void;
}

export default function TalhaoDetailModal({
  opened,
  talhao,
  onClose,
  onSaved,
  onDeleted,
}: TalhaoDetailModalProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const lastDrawWarningAt = useRef(0);
  const [stageWidth, setStageWidth] = useState(900);
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [currentPoints, setCurrentPoints] = useState<MapPoint[]>([]);
  const [mousePos, setMousePos] = useState<MapPoint | null>(null);
  const [mainPoints, setMainPoints] = useState<MapPoint[]>([]);
  const [zones, setZones] = useState<MapPoint[][]>([]);
  const [selectedMainPolygon, setSelectedMainPolygon] = useState(false);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);
  const [selectedVertex, setSelectedVertex] = useState<SelectedVertex | null>(null);
  const [mapSearchValue, setMapSearchValue] = useState('');
  const [mapCenter, setMapCenter] = useState<GeoPoint | null>(null);
  const [mapZoom, setMapZoom] = useState(16);
  const [mapLayerId, setMapLayerId] = useState<GeoLayerId>('satellite');
  const [mapInteractive, setMapInteractive] = useState(false);
  const [mapSearchLoading, setMapSearchLoading] = useState(false);
  const [pointSearchValue, setPointSearchValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [emptyAreaGuardOpened, setEmptyAreaGuardOpened] = useState(false);
  const [emptyAreaGuardReason, setEmptyAreaGuardReason] = useState<'close' | 'save'>(
    'close',
  );
  const [deletingEmptyTalhao, setDeletingEmptyTalhao] = useState(false);

  const [nome, setNome] = useState('');
  const [areaHa, setAreaHa] = useState<number | ''>('');
  const [tipoSolo, setTipoSolo] = useState('');
  const [currentCulture, setCurrentCulture] = useState('');
  const [cultureDraft, setCultureDraft] = useState<CultureEntry>({
    cultura: '',
    cultivar: '',
    data_inicio: '',
    data_fim: '',
  });
  const [cultures, setCultures] = useState<CultureEntry[]>([]);
  const [availableSoils, setAvailableSoils] = useState<SoilCatalogEntry[]>([]);
  const [cultureModalOpened, setCultureModalOpened] = useState(false);
  const [cultureLinkModalOpened, setCultureLinkModalOpened] = useState(false);
  const [cultureModalMode, setCultureModalMode] =
    useState<CultureModalMode>('edit');
  const [editingCultureIndex, setEditingCultureIndex] = useState<number | null>(
    null,
  );
  const [soilClassifierOpened, setSoilClassifierOpened] = useState(false);
  const [soilClassificationRequest, setSoilClassificationRequest] =
    useState<SoilClassificationRequest | null>(null);
  const [soilClassificationResult, setSoilClassificationResult] =
    useState<SoilResultResponse | null>(null);
  const [soilClassificationSnapshot, setSoilClassificationSnapshot] =
    useState<TalhaoSoilClassificationSnapshot | null>(null);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element || !opened) return;

    const updateWidth = () => {
      setStageWidth(Math.max(340, Math.floor(element.clientWidth)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [opened]);

  useEffect(() => {
    if (opened) return;
    setSoilClassifierOpened(false);
  }, [opened]);

  useEffect(() => {
    if (!opened) return;
    setAvailableSoils(listSoilCatalog());
  }, [opened]);

  useEffect(() => {
    if (!opened || !talhao) return;
    const geometry = parseTalhaoGeometry(talhao.coordenadas_svg);
    setMainPoints(geometry.points);
    setZones(geometry.exclusionZones);
    setSelectedMainPolygon(false);
    setSelectedZoneIndex(null);
    setSelectedVertex(null);
    setDrawMode('none');
    setCurrentPoints([]);
    setMousePos(null);
    setNome(talhao.nome ?? '');
    setAreaHa(talhao.area_ha == null ? '' : talhao.area_ha);
    setTipoSolo(
      !talhao.tipo_solo || isUnclassifiedSoilValue(talhao.tipo_solo)
        ? UNCLASSIFIED_SOIL_VALUE
        : talhao.tipo_solo,
    );
    const parsedCultures = Array.isArray(talhao.historico_culturas)
      ? talhao.historico_culturas.map((item) => ({
          cultura: item.cultura ?? '',
          cultivar: item.cultivar ?? '',
          especie_nome_comum: (item as any)?.especie_nome_comum ?? undefined,
          especie_nome_cientifico: (item as any)?.especie_nome_cientifico ?? undefined,
          grupo_especie: (item as any)?.grupo_especie ?? undefined,
          rnc_detail_url: (item as any)?.rnc_detail_url ?? undefined,
          technical_profile_id: (item as any)?.technical_profile_id ?? undefined,
          technical_priority: (item as any)?.technical_priority ?? undefined,
          data_inicio: normalizeMonthYear(item.data_inicio ?? item.safra),
          data_fim: normalizeMonthYear(item.data_fim ?? item.safra),
          fonte: (item as any)?.fonte ?? undefined,
        }))
      : [];
    setCultures(parsedCultures);
    const persistedCurrentCulture =
      typeof geometry.currentCulture === 'string' ? geometry.currentCulture.trim() : '';
    setCurrentCulture(persistedCurrentCulture || parsedCultures[0]?.cultura || '');
    setCultureDraft({ cultura: '', cultivar: '', data_inicio: '', data_fim: '' });
    setCultureModalOpened(false);
    setCultureLinkModalOpened(false);
    setCultureModalMode('edit');
    setEditingCultureIndex(null);
    setSoilClassifierOpened(false);
    setSoilClassificationSnapshot(geometry.soilClassification ?? null);
    setSoilClassificationRequest(geometry.soilClassification?.request ?? null);
    setSoilClassificationResult(geometry.soilClassification?.response ?? null);
    setMapSearchValue('');
    if (geometry.mapReference?.center) {
      setMapCenter({
        lat: geometry.mapReference.center.lat,
        lon: geometry.mapReference.center.lon,
      });
      setMapZoom(Math.max(3, Math.min(19, Math.round(geometry.mapReference.zoom ?? 16))));
      setMapLayerId(normalizeGeoLayerId(geometry.mapReference.layerId));
    } else {
      setMapCenter(null);
      setMapZoom(16);
      setMapLayerId('satellite');
    }
    setMapInteractive(false);
    setMapSearchLoading(false);
    setPointSearchValue('');
  }, [opened, talhao]);

  const statusLabel = useMemo(() => {
    if (drawMode === 'main') return 'Desenhando limite principal';
    if (drawMode === 'zone') return 'Desenhando zona de exclusao';
    return 'Visualizacao';
  }, [drawMode]);

  const currentCultureOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of cultures) {
      const label = row.cultura.trim();
      if (!label) continue;
      const key = normalizeKey(label);
      if (!key || map.has(key)) continue;
      map.set(key, label);
    }
    const selected = currentCulture.trim();
    if (selected) {
      const key = normalizeKey(selected);
      if (key && !map.has(key)) {
        map.set(key, selected);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((value) => ({ value, label: value }));
  }, [cultures, currentCulture]);

  const soilOptions = useMemo(() => {
    const catalogOptions = availableSoils.map((soil) => ({
      value: soil.nome,
      label: soil.nome,
    }));
    const options = [
      { value: UNCLASSIFIED_SOIL_VALUE, label: UNCLASSIFIED_SOIL_LABEL },
      ...catalogOptions,
    ];
    const currentSoil = tipoSolo.trim();
    if (!currentSoil) return options;

    const hasCurrent = options.some(
      (option) => normalizeKey(option.value) === normalizeKey(currentSoil),
    );
    if (hasCurrent) return options;

    return [
      { value: currentSoil, label: `${currentSoil} (personalizado)` },
      ...options,
    ];
  }, [availableSoils, tipoSolo]);

  const selectedSoil = useMemo(
    () => (isUnclassifiedSoilValue(tipoSolo) ? null : findSoilCatalogEntry(tipoSolo)),
    [tipoSolo],
  );

  const normalizedTipoSolo = useMemo(() => {
    const raw = tipoSolo.trim();
    if (!raw || isUnclassifiedSoilValue(raw)) return null;
    return raw;
  }, [tipoSolo]);

  const resolvedTalhaoColor = useMemo(
    () => resolveSoilLinkedColor(normalizedTipoSolo, talhao?.cor_identificacao),
    [normalizedTipoSolo, talhao?.cor_identificacao],
  );

  const hasValidArea = useMemo(() => {
    if (areaHa === '') return false;
    const parsed = Number(areaHa);
    return Number.isFinite(parsed) && parsed > 0;
  }, [areaHa]);

  const lastClassificationSummary = useMemo(() => {
    const primary = soilClassificationResult?.result?.primary;
    if (!primary) return null;
    return `${primary.order} (${Math.round(primary.confidence)}%)`;
  }, [soilClassificationResult]);

  const openSoilClassifier = () => {
    setSoilClassifierOpened(true);
  };

  const closeSoilClassifier = () => {
    setSoilClassifierOpened(false);
  };

  const applyClassificationToTalhao = () => {
    const primary = soilClassificationResult?.result.primary;
    const currentRequest = soilClassificationRequest;
    const currentResponse = soilClassificationResult;
    if (!primary) {
      notifications.show({
        title: 'Classificacao pendente',
        message: 'Execute a classificacao antes de aplicar no talhão.',
        color: 'yellow',
      });
      return;
    }
    if (!currentRequest || !currentResponse) {
      notifications.show({
        title: 'Classificacao incompleta',
        message: 'Não foi possível capturar os dados completos da classificacao.',
        color: 'yellow',
      });
      return;
    }
    setSoilClassificationSnapshot({
      request: currentRequest,
      response: currentResponse,
      applied_at: new Date().toISOString(),
    });
    setTipoSolo(primary.order);
    setSoilClassifierOpened(false);
    notifications.show({
      title: 'Classe aplicada',
      message: `Classe de solo definida como ${primary.order}.`,
      color: 'green',
    });
  };

  const showDrawWarning = (title: string, message: string) => {
    const now = Date.now();
    if (now - lastDrawWarningAt.current < 700) return;
    lastDrawWarningAt.current = now;
    notifications.show({
      title,
      message,
      color: 'yellow',
    });
  };

  const handleStageClick = (event: any) => {
    if (drawMode === 'none') {
      setSelectedMainPolygon(false);
      setSelectedZoneIndex(null);
      setSelectedVertex(null);
      return;
    }
    if (event?.evt?.button === 2) return;
    const stage = event.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) return;
    if (drawMode === 'zone' && !isPointInsidePolygon(point, mainPoints)) {
      showDrawWarning(
        'Ponto fora da area util',
        'A zona de exclusao deve ficar dentro do limite principal do talhão.',
      );
      return;
    }
    setCurrentPoints((prev) => [...prev, { x: point.x, y: point.y }]);
  };

  const handleMouseMove = (event: any) => {
    if (drawMode === 'none') return;
    const stage = event.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) return;
    setMousePos({ x: point.x, y: point.y });
  };

  const startMainDrawing = () => {
    if (mainPoints.length >= 3) {
      notifications.show({
        title: 'Area util ja definida',
        message:
          'Cada talhão aceita apenas uma area util. Edite os vertices existentes para ajustar.',
        color: 'yellow',
      });
      return;
    }
    setSelectedMainPolygon(false);
    setSelectedVertex(null);
    setDrawMode('main');
    setCurrentPoints([]);
    setMousePos(null);
  };

  const startZoneDrawing = () => {
    if (mainPoints.length < 3) {
      notifications.show({
        title: 'Desenhe o limite primeiro',
        message: 'Defina o limite do talhão antes de criar zonas de exclusao.',
        color: 'yellow',
      });
      return;
    }
    setSelectedMainPolygon(false);
    setSelectedVertex(null);
    setDrawMode('zone');
    setCurrentPoints([]);
    setMousePos(null);
  };

  const cancelDrawing = () => {
    setSelectedMainPolygon(false);
    setSelectedZoneIndex(null);
    setSelectedVertex(null);
    setDrawMode('none');
    setCurrentPoints([]);
    setMousePos(null);
  };

  const finishDrawing = () => {
    if (currentPoints.length < 3) {
      notifications.show({
        title: 'Desenho incompleto',
        message: 'Desenhe pelo menos 3 pontos.',
        color: 'yellow',
      });
      return;
    }

    if (drawMode === 'main') {
      setMainPoints(currentPoints);
      notifications.show({
        title: 'Limite atualizado',
        message: 'Desenho principal do talhão definido.',
        color: 'green',
      });
    } else if (drawMode === 'zone') {
      if (!isPolygonInsidePolygon(currentPoints, mainPoints)) {
        notifications.show({
          title: 'Zona fora da area util',
          message:
            'Todos os pontos da zona de exclusao precisam ficar dentro da area util do talhão.',
          color: 'yellow',
        });
        return;
      }
      setZones((prev) => [...prev, currentPoints]);
      notifications.show({
        title: 'Zona adicionada',
        message: 'Zona de exclusao adicionada ao talhão.',
        color: 'green',
      });
    }

    setDrawMode('none');
    setSelectedMainPolygon(false);
    setSelectedVertex(null);
    setCurrentPoints([]);
    setMousePos(null);
  };

  const persistDrawingOnly = async (
    nextMainPoints: MapPoint[],
    nextZones: MapPoint[][],
  ) => {
    if (!talhao) return;
    const persistedGeometry = parseTalhaoGeometry(talhao.coordenadas_svg);
    try {
      await updateTalhaoForProperty({
        talhaoId: talhao.id,
        nome: talhao.nome || 'Talhão',
        area_ha: talhao.area_ha,
        tipo_solo: talhao.tipo_solo,
        color: resolveSoilLinkedColor(talhao.tipo_solo, talhao.cor_identificacao),
        points: nextMainPoints,
        exclusionZones: nextZones,
        soilClassification: soilClassificationSnapshot,
        currentCulture: persistedGeometry.currentCulture ?? null,
        historico_culturas: cultures.map((item) => ({
          cultura: item.cultura,
          cultivar: item.cultivar,
          especie_nome_comum: item.especie_nome_comum,
          especie_nome_cientifico: item.especie_nome_cientifico,
          grupo_especie: item.grupo_especie,
          rnc_detail_url: item.rnc_detail_url,
          technical_profile_id: item.technical_profile_id,
          technical_priority: item.technical_priority,
          data_inicio: item.data_inicio,
          data_fim: item.data_fim,
          fonte: item.fonte,
        })),
      });
      notifications.show({
        title: 'Desenho salvo',
        message: 'Poligono fechado e salvo com clique direito.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar desenho',
        message:
          err?.message ?? 'Não foi possível salvar o desenho automaticamente.',
        color: 'red',
      });
    }
  };

  const handleCloseWithRightClick = (event: any) => {
    event?.evt?.preventDefault?.();
    if (drawMode === 'none') return;
    if (currentPoints.length < 3) {
      notifications.show({
        title: 'Desenho incompleto',
        message: 'Desenhe pelo menos 3 pontos.',
        color: 'yellow',
      });
      return;
    }

    if (drawMode === 'zone' && !isPolygonInsidePolygon(currentPoints, mainPoints)) {
      notifications.show({
        title: 'Zona fora da area util',
        message:
          'Todos os pontos da zona de exclusao precisam ficar dentro da area util do talhão.',
        color: 'yellow',
      });
      return;
    }

    const nextMainPoints = drawMode === 'main' ? currentPoints : mainPoints;
    const nextZones = drawMode === 'zone' ? [...zones, currentPoints] : zones;

    if (drawMode === 'main') {
      setMainPoints(nextMainPoints);
    } else if (drawMode === 'zone') {
      setZones(nextZones);
    }

    setDrawMode('none');
    setSelectedMainPolygon(false);
    setSelectedVertex(null);
    setCurrentPoints([]);
    setMousePos(null);

    void persistDrawingOnly(nextMainPoints, nextZones);
  };

  const removeSelectedZone = () => {
    const targetIndex =
      selectedZoneIndex != null ? selectedZoneIndex : zones.length === 1 ? 0 : null;

    if (targetIndex == null) {
      notifications.show({
        title: 'Selecione a zona',
        message: 'Escolha a zona de exclusao para remover.',
        color: 'yellow',
      });
      return;
    }

    setZones((prev) => prev.filter((_, idx) => idx !== targetIndex));
    setSelectedMainPolygon(false);
    setSelectedZoneIndex(null);
    setSelectedVertex((prev) => {
      if (!prev || prev.kind !== 'zone') return prev;
      if (prev.zoneIndex === targetIndex) return null;
      if (prev.zoneIndex > targetIndex) {
        return { ...prev, zoneIndex: prev.zoneIndex - 1 };
      }
      return prev;
    });
  };

  const removeMainPolygon = () => {
    const hadMain = mainPoints.length > 0 || currentPoints.length > 0;
    const hadZones = zones.length > 0;
    if (!hadMain && !hadZones) return;
    setMainPoints([]);
    setZones([]);
    setSelectedMainPolygon(false);
    setSelectedZoneIndex(null);
    setSelectedVertex(null);
    setDrawMode('none');
    setCurrentPoints([]);
    setMousePos(null);
    notifications.show({
      title: hadMain ? 'Limite removido' : 'Zonas removidas',
      message:
        hadMain && hadZones
          ? 'O limite principal e as zonas de exclusao foram removidos.'
          : hadMain
            ? 'O limite principal foi removido.'
            : 'As zonas de exclusao foram removidas.',
      color: 'yellow',
    });
  };

  const clearSelectedVertex = () => {
    setSelectedVertex(null);
  };

  const toggleMainPolygonSelection = () => {
    if (selectedMainPolygon) {
      setSelectedMainPolygon(false);
      setSelectedVertex((prev) => (prev?.kind === 'main' ? null : prev));
      return;
    }
    setSelectedMainPolygon(true);
    setSelectedZoneIndex(null);
    setSelectedVertex((prev) => (prev?.kind === 'zone' ? null : prev));
  };

  const toggleZoneSelection = (zoneIndex: number) => {
    if (selectedZoneIndex === zoneIndex) {
      setSelectedZoneIndex(null);
      setSelectedVertex((prev) =>
        prev?.kind === 'zone' && prev.zoneIndex === zoneIndex ? null : prev,
      );
      return;
    }
    setSelectedMainPolygon(false);
    setSelectedZoneIndex(zoneIndex);
    setSelectedVertex((prev) => (prev?.kind === 'main' ? null : prev));
  };

  const selectMainVertex = (pointIndex: number) => {
    setSelectedMainPolygon(true);
    setSelectedZoneIndex(null);
    setSelectedVertex({ kind: 'main', pointIndex });
  };

  const selectZoneVertex = (zoneIndex: number, pointIndex: number) => {
    setSelectedMainPolygon(false);
    setSelectedZoneIndex(zoneIndex);
    setSelectedVertex({ kind: 'zone', zoneIndex, pointIndex });
  };

  const removeSelectedVertex = () => {
    if (!selectedVertex) {
      notifications.show({
        title: 'Selecione um ponto',
        message: 'Clique em uma bolinha para excluir o vertice.',
        color: 'yellow',
      });
      return;
    }

    if (selectedVertex.kind === 'main') {
      if (mainPoints.length <= 3) {
        notifications.show({
          title: 'Minimo de 3 pontos',
          message: 'O limite principal precisa ter ao menos 3 vertices.',
          color: 'yellow',
        });
        return;
      }
      const nextMainPoints = mainPoints.filter(
        (_, idx) => idx !== selectedVertex.pointIndex,
      );
      const hasZoneOutside = zones.some(
        (zone) => zone.length >= 3 && !isPolygonInsidePolygon(zone, nextMainPoints),
      );
      if (hasZoneOutside) {
        notifications.show({
          title: 'Ajuste inválido',
          message:
            'Remover esse ponto deixaria zona de exclusao fora da area util.',
          color: 'yellow',
        });
        return;
      }
      setMainPoints(nextMainPoints);
      setSelectedVertex(null);
      notifications.show({
        title: 'Ponto removido',
        message: 'Vertice removido do limite principal.',
        color: 'green',
      });
      return;
    }

    const zone = zones[selectedVertex.zoneIndex];
    if (!zone) {
      setSelectedVertex(null);
      return;
    }
    if (zone.length <= 3) {
      notifications.show({
        title: 'Minimo de 3 pontos',
        message:
          'A zona precisa ter ao menos 3 vertices. Use remover zona para excluir totalmente.',
        color: 'yellow',
      });
      return;
    }

    const nextZone = zone.filter((_, idx) => idx !== selectedVertex.pointIndex);
    if (!isPolygonInsidePolygon(nextZone, mainPoints)) {
      notifications.show({
        title: 'Ajuste inválido',
        message: 'A zona precisa continuar dentro da area util.',
        color: 'yellow',
      });
      return;
    }

    setZones((prev) =>
      prev.map((item, idx) => (idx === selectedVertex.zoneIndex ? nextZone : item)),
    );
    setSelectedZoneIndex(selectedVertex.zoneIndex);
    setSelectedVertex(null);
    notifications.show({
      title: 'Ponto removido',
      message: 'Vertice removido da zona de exclusao.',
      color: 'green',
    });
  };

  const removeCurrentSelection = () => {
    if (selectedVertex) {
      removeSelectedVertex();
      return;
    }

    if (selectedZoneIndex != null || zones.length === 1) {
      removeSelectedZone();
      return;
    }

    if (selectedMainPolygon) {
      removeMainPolygon();
      return;
    }

    notifications.show({
      title: 'Selecione antes de excluir',
      message: 'Clique em um ponto, zona ou limite para remover.',
      color: 'yellow',
    });
  };

  const openCultureLinkModal = () => {
    setCultureLinkModalOpened(true);
  };

  const closeCultureLinkModal = () => {
    setCultureLinkModalOpened(false);
  };

  const handleLinkCultureFromRnc = (payload: RncCultivarSelectionPayload) => {
    const cultura = String(payload.cultura ?? '').trim();
    const cultivar = String(payload.cultivar ?? '').trim();
    const dataInicio = normalizeMonthYear(payload.dataInicio);
    const dataFim = normalizeMonthYear(payload.dataFim);
    if (!cultura || !dataInicio || !dataFim) {
      notifications.show({
        title: 'Seleção incompleta',
        message: 'A espécie e o período são obrigatórios para o vínculo.',
        color: 'yellow',
      });
      return;
    }
    if (monthYearOrder(dataInicio) > monthYearOrder(dataFim)) {
      notifications.show({
        title: 'Período inválido',
        message: 'O período selecionado é inválido.',
        color: 'yellow',
      });
      return;
    }

    const incomingRow: CultureEntry = {
      cultura,
      cultivar: cultivar || undefined,
      especie_nome_comum: String(payload.especieNomeComum ?? '').trim() || cultura,
      especie_nome_cientifico: String(payload.especieNomeCientifico ?? '').trim() || undefined,
      grupo_especie: String(payload.grupoEspecie ?? '').trim() || undefined,
      rnc_detail_url: String(payload.rncDetailUrl ?? '').trim() || undefined,
      technical_priority: cultivar ? 'cultivar' : 'species',
      data_inicio: dataInicio,
      data_fim: dataFim,
      fonte: payload.fonte,
    };

    setCultures((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          normalizeKey(item.cultura) === normalizeKey(incomingRow.cultura) &&
          normalizeKey(item.cultivar ?? '') === normalizeKey(incomingRow.cultivar ?? ''),
      );
      if (existingIndex < 0) return [...prev, incomingRow];
      return prev.map((item, index) => (index === existingIndex ? incomingRow : item));
    });

    if (!currentCulture.trim()) {
      setCurrentCulture(cultura);
    }

    notifications.show({
      title: 'Cultura vinculada',
      message: cultivar
        ? `${cultura} vinculada com refino da cultivar ${cultivar}.`
        : `${cultura} vinculada por espécie (sem refino de cultivar).`,
      color: 'green',
    });
    setCultureLinkModalOpened(false);
  };

  const openEditCultureModal = (index: number) => {
    const row = cultures[index];
    if (!row) return;

    setCultureModalMode('edit');
    setEditingCultureIndex(index);
    setCultureDraft({
      cultura: row.cultura,
      cultivar: row.cultivar ?? '',
      data_inicio: row.data_inicio,
      data_fim: row.data_fim,
    });
    setCultureModalOpened(true);
  };

  const closeCultureModal = () => {
    setCultureModalOpened(false);
  };

  const saveCultureDraft = () => {
    if (cultureModalMode !== 'edit' || editingCultureIndex == null) {
      notifications.show({
        title: 'Cadastro manual bloqueado',
        message: 'Use o seletor do RNC para incluir novas culturas no talhão.',
        color: 'yellow',
      });
      setCultureModalOpened(false);
      return;
    }

    const cultura = cultureDraft.cultura.trim();
    const cultivar = cultureDraft.cultivar?.trim() || '';
    const dataInicio = normalizeMonthYear(cultureDraft.data_inicio);
    const dataFim = normalizeMonthYear(cultureDraft.data_fim);

    if (!cultura || !dataInicio || !dataFim) {
      notifications.show({
        title: 'Dados incompletos',
        message: 'Informe espécie, mês/ano inicial e mês/ano final.',
        color: 'yellow',
      });
      return;
    }

    if (monthYearOrder(dataInicio) > monthYearOrder(dataFim)) {
      notifications.show({
        title: 'Periodo inválido',
        message: 'O mês/ano final deve ser maior ou igual ao mês/ano inicial.',
        color: 'yellow',
      });
      return;
    }

    const row: CultureEntry = {
      cultura,
      cultivar: cultivar || undefined,
      data_inicio: dataInicio,
      data_fim: dataFim,
    };

    setCultures((prev) =>
      prev.map((item, index) =>
        index === editingCultureIndex
          ? {
              ...item,
              ...row,
            }
          : item,
      ),
    );
    if (!currentCulture.trim()) {
      setCurrentCulture(row.cultura);
    }

    setCultureModalOpened(false);
  };

  const removeCulture = (index: number) => {
    setCultures((prev) => {
      const removed = prev[index];
      const next = prev.filter((_, idx) => idx !== index);
      if (
        removed &&
        normalizeKey(removed.cultura) === normalizeKey(currentCulture) &&
        !next.some((item) => normalizeKey(item.cultura) === normalizeKey(currentCulture))
      ) {
        setCurrentCulture(next[0]?.cultura ?? '');
      }
      return next;
    });
  };

  const duplicateCultivarForTechnicalProfile = (index: number) => {
    const row = cultures[index];
    if (!row) return;

    const especieNomeComum = String(
      row.especie_nome_comum || row.cultura || '',
    ).trim();
    const especieNomeCientifico = String(row.especie_nome_cientifico || '').trim();
    const grupoEspecie = String(row.grupo_especie || '').trim();
    const cultivarNome = String(row.cultivar || '').trim();

    if (!especieNomeComum) {
      notifications.show({
        title: 'Espécie inválida',
        message: 'Não foi possível identificar a espécie para preparar os dados técnicos.',
        color: 'yellow',
      });
      return;
    }

    if (!cultivarNome) {
      notifications.show({
        title: 'Cultivar ausente',
        message: 'Selecione uma cultivar para duplicar dados técnicos específicos.',
        color: 'yellow',
      });
      return;
    }

    const technicalProfile = duplicateCultivarTechnicalProfile({
      especieNomeComum,
      especieNomeCientifico,
      grupoEspecie,
      cultivarNome,
      rncDetailUrl: row.rnc_detail_url,
    });

    setCultures((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              cultivar: technicalProfile.cultivar_nome,
              technical_profile_id: technicalProfile.id,
              technical_priority: 'cultivar',
            }
          : item,
      ),
    );

    notifications.show({
      title: 'Cultivar duplicada para edição técnica',
      message: `${technicalProfile.cultivar_nome} preparada para receber seus dados de produção.`,
      color: 'green',
    });
  };

  const moveMainAnchor = (index: number, point: MapPoint): boolean => {
    const nextMainPoints = mainPoints.map((item, idx) => (idx === index ? point : item));
    const hasZoneOutside = zones.some(
      (zone) => zone.length >= 3 && !isPolygonInsidePolygon(zone, nextMainPoints),
    );
    if (hasZoneOutside) {
      showDrawWarning(
        'Ajuste inválido',
        'Esse movimento colocaria uma zona de exclusao fora da area util.',
      );
      return false;
    }
    setMainPoints(nextMainPoints);
    return true;
  };

  const moveZoneAnchor = (
    zoneIndex: number,
    pointIndex: number,
    point: MapPoint,
  ): boolean => {
    const zone = zones[zoneIndex];
    if (!zone) return false;
    const nextZone = zone.map((item, pIdx) => (pIdx === pointIndex ? point : item));
    if (!isPolygonInsidePolygon(nextZone, mainPoints)) {
      showDrawWarning(
        'Ajuste inválido',
        'A zona de exclusao precisa permanecer dentro da area util.',
      );
      return false;
    }
    setZones((prev) =>
      prev.map((item, idx) => (idx === zoneIndex ? nextZone : item)),
    );
    return true;
  };

  const moveCurrentAnchor = (index: number, point: MapPoint): boolean => {
    const nextCurrent = currentPoints.map((item, idx) =>
      idx === index ? point : item,
    );
    if (drawMode === 'zone' && !isPolygonInsidePolygon(nextCurrent, mainPoints)) {
      showDrawWarning(
        'Ajuste inválido',
        'A zona de exclusao precisa permanecer dentro da area util.',
      );
      return false;
    }
    setCurrentPoints(nextCurrent);
    return true;
  };

  const insertMainPointAfter = (index: number) => {
    setMainPoints((prev) => {
      if (prev.length < 2) return prev;
      const nextIndex = (index + 1) % prev.length;
      const nextPoint = midpoint(prev[index], prev[nextIndex]);
      return [...prev.slice(0, index + 1), nextPoint, ...prev.slice(index + 1)];
    });
    setSelectedVertex(null);
  };

  const insertZonePointAfter = (zoneIndex: number, pointIndex: number) => {
    setZones((prev) =>
      prev.map((zone, idx) => {
        if (idx !== zoneIndex || zone.length < 2) return zone;
        const nextIndex = (pointIndex + 1) % zone.length;
        const nextPoint = midpoint(zone[pointIndex], zone[nextIndex]);
        if (!isPointInsidePolygon(nextPoint, mainPoints)) {
          showDrawWarning(
            'Ponto inválido',
            'Não foi possível inserir ponto medio fora da area util.',
          );
          return zone;
        }
        return [
          ...zone.slice(0, pointIndex + 1),
          nextPoint,
          ...zone.slice(pointIndex + 1),
        ];
      }),
    );
    setSelectedVertex(null);
  };

  const applyRealMapBackground = async () => {
    const query = mapSearchValue.trim();
    if (!query) {
      notifications.show({
        title: 'Informe uma busca',
        message: 'Digite um CEP (8 digitos) ou coordenadas (lat, lon).',
        color: 'yellow',
      });
      return;
    }

    try {
      setMapSearchLoading(true);
      const point = await resolveGeoPointFromInput(query);
      if (!point) {
        notifications.show({
          title: 'Localização não encontrada',
          message: 'Não foi possível localizar este CEP/coordenada.',
          color: 'yellow',
        });
        return;
      }

      setMapCenter(point);
      setMapZoom(16);
      setMapLayerId('satellite');
      setMapInteractive(false);
      notifications.show({
        title: 'Fundo real aplicado',
        message: `Centro aproximado em ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}.`,
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Falha na busca',
        message: error?.message ?? 'Não foi possível obter o mapa de referencia real.',
        color: 'red',
      });
    } finally {
      setMapSearchLoading(false);
    }
  };

  const clearRealMapBackground = () => {
    setMapCenter(null);
    setMapZoom(16);
    setMapLayerId('satellite');
    setMapInteractive(false);
  };

  const handleRealMapViewChange = (next: { center: GeoPoint; zoom: number }) => {
    setMapCenter(next.center);
    setMapZoom(next.zoom);
  };

  const addPointFromCoordinates = () => {
    const rawValue = pointSearchValue.trim();
    if (!rawValue) {
      notifications.show({
        title: 'Informe coordenadas',
        message: 'Digite latitude e longitude no formato: -23.55052, -46.63331.',
        color: 'yellow',
      });
      return;
    }

    if (drawMode === 'none') {
      notifications.show({
        title: 'Inicie o desenho',
        message: 'Ative o desenho do limite ou da zona para inserir pontos por coordenada.',
        color: 'yellow',
      });
      return;
    }

    if (mapInteractive) {
      notifications.show({
        title: 'Desative navegacao',
        message: 'Desative a navegacao do mapa para continuar desenhando.',
        color: 'yellow',
      });
      return;
    }

    if (!mapCenter) {
      notifications.show({
        title: 'Fundo real obrigatorio',
        message: 'Aplique um mapa real para converter coordenadas em pontos do croqui.',
        color: 'yellow',
      });
      return;
    }

    const geoPoint = parseCoordinatesInput(rawValue);
    if (!geoPoint) {
      notifications.show({
        title: 'Formato inválido',
        message: 'Use o formato latitude, longitude. Ex.: -23.55052, -46.63331.',
        color: 'yellow',
      });
      return;
    }

    const mappedPoint = geoPointToCanvasPoint(
      geoPoint,
      mapCenter,
      mapZoom,
      Math.max(1, stageWidth),
      440,
    );

    if (
      mappedPoint.x < 0 ||
      mappedPoint.x > stageWidth ||
      mappedPoint.y < 0 ||
      mappedPoint.y > 440
    ) {
      notifications.show({
        title: 'Ponto fora da visao atual',
        message:
          'Ajuste zoom/posicao do mapa para enquadrar o ponto e tente novamente.',
        color: 'yellow',
      });
      return;
    }

    if (drawMode === 'zone') {
      if (!isPointInsidePolygon(mappedPoint, mainPoints)) {
        showDrawWarning(
          'Ponto fora da area util',
          'A zona de exclusao deve ficar dentro do limite principal do talhão.',
        );
        return;
      }
      if (currentPoints.length > 0) {
        const lastPoint = currentPoints[currentPoints.length - 1];
        if (!isSegmentInsidePolygon(lastPoint, mappedPoint, mainPoints)) {
          showDrawWarning(
            'Aresta fora da area util',
            'Esse novo ponto criaria uma aresta fora da area util.',
          );
          return;
        }
      }
    }

    setCurrentPoints((prev) => [...prev, mappedPoint]);
    setMousePos(mappedPoint);
    setPointSearchValue('');
  };

  useEffect(() => {
    if (!opened) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const hasSelection =
        Boolean(selectedVertex) ||
        selectedZoneIndex != null ||
        selectedMainPolygon ||
        zones.length === 1;
      if (!hasSelection) return;

      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName ?? '';
      const isTyping =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        active?.isContentEditable === true;
      if (isTyping) return;

      event.preventDefault();
      removeCurrentSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    opened,
    selectedVertex,
    selectedZoneIndex,
    selectedMainPolygon,
    zones,
    mainPoints,
  ]);

  const save = async () => {
    if (!talhao) return;
    if (!nome.trim()) {
      notifications.show({
        title: 'Nome obrigatorio',
        message: 'Informe o nome do talhão.',
        color: 'yellow',
      });
      return;
    }

    if (mainPoints.length < 3) {
      notifications.show({
        title: 'Limite obrigatorio',
        message: 'Cada talhão precisa ter um desenho principal.',
        color: 'yellow',
      });
      return;
    }

    if (!hasValidArea) {
      setEmptyAreaGuardReason('save');
      setEmptyAreaGuardOpened(true);
      return;
    }

    const invalidZoneIndex = zones.findIndex(
      (zone) => zone.length >= 3 && !isPolygonInsidePolygon(zone, mainPoints),
    );
    if (invalidZoneIndex >= 0) {
      notifications.show({
        title: 'Zona de exclusao inválida',
        message: `A zona ${invalidZoneIndex + 1} esta fora da area util. Ajuste antes de salvar.`,
        color: 'yellow',
      });
      return;
    }

    try {
      setSaving(true);
      await updateTalhaoForProperty({
        talhaoId: talhao.id,
        nome: nome.trim(),
        area_ha: areaHa === '' ? undefined : Number(areaHa),
        tipo_solo: normalizedTipoSolo,
        color: resolvedTalhaoColor,
        points: mainPoints,
        exclusionZones: zones,
        mapReference: mapCenter
          ? {
              center: mapCenter,
              zoom: mapZoom,
              layerId: mapLayerId,
            }
          : null,
        soilClassification: soilClassificationSnapshot,
        currentCulture: currentCulture.trim() || null,
        historico_culturas: cultures.map((item) => ({
          cultura: item.cultura,
          cultivar: item.cultivar,
          especie_nome_comum: item.especie_nome_comum,
          especie_nome_cientifico: item.especie_nome_cientifico,
          grupo_especie: item.grupo_especie,
          rnc_detail_url: item.rnc_detail_url,
          technical_profile_id: item.technical_profile_id,
          technical_priority: item.technical_priority,
          data_inicio: item.data_inicio,
          data_fim: item.data_fim,
          fonte: item.fonte,
        })),
      });

      await onSaved(talhao.id);
      notifications.show({
        title: 'Talhão atualizado',
        message: 'Detalhamento do talhão salvo com sucesso.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar talhão',
        message: err?.message ?? 'Não foi possível salvar o detalhamento.',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRequestClose = () => {
    if (!talhao) {
      onClose();
      return;
    }
    if (!hasValidArea) {
      setEmptyAreaGuardReason('close');
      setEmptyAreaGuardOpened(true);
      return;
    }
    onClose();
  };

  const deleteEmptyTalhao = async () => {
    if (!talhao || deletingEmptyTalhao) return;
    try {
      setDeletingEmptyTalhao(true);
      await deleteTalhaoForProperty(talhao.id);
      await onDeleted?.(talhao.id);
      notifications.show({
        title: 'Talhão vazio excluido',
        message: 'Talhão sem área removido com sucesso.',
        color: 'green',
      });
      setEmptyAreaGuardOpened(false);
      onClose();
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao excluir talhão vazio',
        message: err?.message ?? 'Não foi possível excluir o talhão vazio.',
        color: 'red',
      });
    } finally {
      setDeletingEmptyTalhao(false);
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleRequestClose}
        title={talhao ? `Detalhamento do talhao: ${talhao.nome}` : 'Detalhamento do talhão'}
        size="clamp(340px, 95vw, 1280px)"
        padding="sm"
        centered
      >
        {!talhao ? (
          <Text c="dimmed">Selecione um talhao para detalhar.</Text>
        ) : (
          <GridLayout
            nome={nome}
            setNome={setNome}
            areaHa={areaHa}
            setAreaHa={setAreaHa}
            tipoSolo={tipoSolo}
            setTipoSolo={setTipoSolo}
            soilOptions={soilOptions}
            selectedSoilDescription={selectedSoil?.descricao ?? null}
            openSoilClassifier={openSoilClassifier}
            lastClassificationSummary={lastClassificationSummary}
            currentCulture={currentCulture}
            setCurrentCulture={setCurrentCulture}
            currentCultureOptions={currentCultureOptions}
            cultures={cultures}
            cultureDraft={cultureDraft}
            setCultureDraft={setCultureDraft}
            cultureModalOpened={cultureModalOpened}
            cultureLinkModalOpened={cultureLinkModalOpened}
            closeCultureModal={closeCultureModal}
            closeCultureLinkModal={closeCultureLinkModal}
            saveCultureDraft={saveCultureDraft}
            openCultureLinkModal={openCultureLinkModal}
            handleLinkCultureFromRnc={handleLinkCultureFromRnc}
            openEditCultureModal={openEditCultureModal}
            removeCulture={removeCulture}
            duplicateCultivarForTechnicalProfile={duplicateCultivarForTechnicalProfile}
            drawMode={drawMode}
            statusLabel={statusLabel}
            startMainDrawing={startMainDrawing}
            startZoneDrawing={startZoneDrawing}
            cancelDrawing={cancelDrawing}
            finishDrawing={finishDrawing}
            zones={zones}
            selectedMainPolygon={selectedMainPolygon}
            selectedZoneIndex={selectedZoneIndex}
            setSelectedZoneIndex={setSelectedZoneIndex}
            toggleMainPolygonSelection={toggleMainPolygonSelection}
            toggleZoneSelection={toggleZoneSelection}
            removeSelectedZone={removeSelectedZone}
            removeMainPolygon={removeMainPolygon}
            selectedVertex={selectedVertex}
            selectMainVertex={selectMainVertex}
            selectZoneVertex={selectZoneVertex}
            clearSelectedVertex={clearSelectedVertex}
            removeSelectedVertex={removeSelectedVertex}
            removeCurrentSelection={removeCurrentSelection}
            canvasRef={canvasRef}
            stageWidth={stageWidth}
            mainPoints={mainPoints}
            currentPoints={currentPoints}
            mousePos={mousePos}
            handleStageClick={handleStageClick}
            handleMouseMove={handleMouseMove}
            handleCloseWithRightClick={handleCloseWithRightClick}
            moveMainAnchor={moveMainAnchor}
            moveZoneAnchor={moveZoneAnchor}
            moveCurrentAnchor={moveCurrentAnchor}
            insertMainPointAfter={insertMainPointAfter}
            insertZonePointAfter={insertZonePointAfter}
            mapSearchValue={mapSearchValue}
            setMapSearchValue={setMapSearchValue}
            mapSearchLoading={mapSearchLoading}
            pointSearchValue={pointSearchValue}
            setPointSearchValue={setPointSearchValue}
            addPointFromCoordinates={addPointFromCoordinates}
            applyRealMapBackground={applyRealMapBackground}
            clearRealMapBackground={clearRealMapBackground}
            mapCenter={mapCenter}
            mapZoom={mapZoom}
            mapLayerId={mapLayerId}
            setMapLayerId={setMapLayerId}
            mapInteractive={mapInteractive}
            setMapInteractive={setMapInteractive}
            onRealMapViewChange={handleRealMapViewChange}
            mapHasRealBackground={Boolean(mapCenter)}
            save={save}
            saving={saving}
          />
        )}
      </Modal>

      <Modal
        opened={emptyAreaGuardOpened}
        onClose={() => setEmptyAreaGuardOpened(false)}
        centered
        closeOnClickOutside={false}
        closeOnEscape={false}
        title="Talhão sem área"
      >
        <Stack gap="sm">
          <Text size="sm">
            {emptyAreaGuardReason === 'save'
              ? 'Este talhão ainda não possui área. Não é possível salvar sem informar área.'
              : 'Este talhão ainda não possui área.'}
          </Text>
          <Text size="sm" c="dimmed">
            Você pode voltar para edição e preencher a área, ou excluir o talhão vazio.
          </Text>
          <Group justify="flex-end" mt="xs">
            <Button
              variant="light"
              color="gray"
              onClick={() => setEmptyAreaGuardOpened(false)}
              disabled={deletingEmptyTalhao}
            >
              Cancelar e voltar edição
            </Button>
            <Button
              color="red"
              onClick={() => void deleteEmptyTalhao()}
              loading={deletingEmptyTalhao}
            >
              Excluir talhão vazio
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={soilClassifierOpened}
        onClose={closeSoilClassifier}
        title="Classificador SiBCS do talhão"
        size="clamp(340px, 96vw, 1380px)"
        centered
        padding="sm"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Execute a classificacao, revise a confianca e aplique a ordem no campo de classe de solo do talhao.
          </Text>
          {soilClassifierOpened ? (
            <Suspense
              fallback={
                <Center h={180}>
                  <Loader size="sm" />
                </Center>
              }
            >
              <LazySoilClassificationWorkspace
                key={`${talhao?.id ?? 'talhao'}-${soilClassificationSnapshot?.applied_at ?? 'novo'}`}
                initialRequest={soilClassificationRequest ?? undefined}
                onRequestChange={setSoilClassificationRequest}
                onResult={setSoilClassificationResult}
              />
            </Suspense>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={closeSoilClassifier}>
              Fechar
            </Button>
            <Button onClick={applyClassificationToTalhao} disabled={!soilClassificationResult}>
              Aplicar classificacao no talhao
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function GridLayout(props: {
  nome: string;
  setNome: (value: string) => void;
  areaHa: number | '';
  setAreaHa: (value: number | '') => void;
  tipoSolo: string;
  setTipoSolo: (value: string) => void;
  soilOptions: Array<{ value: string; label: string }>;
  selectedSoilDescription: string | null;
  openSoilClassifier: () => void;
  lastClassificationSummary: string | null;
  currentCulture: string;
  setCurrentCulture: (value: string) => void;
  currentCultureOptions: Array<{ value: string; label: string }>;
  cultures: CultureEntry[];
  cultureDraft: CultureEntry;
  setCultureDraft: (value: CultureEntry) => void;
  cultureModalOpened: boolean;
  cultureLinkModalOpened: boolean;
  closeCultureModal: () => void;
  closeCultureLinkModal: () => void;
  saveCultureDraft: () => void;
  openCultureLinkModal: () => void;
  handleLinkCultureFromRnc: (payload: RncCultivarSelectionPayload) => void;
  openEditCultureModal: (index: number) => void;
  removeCulture: (index: number) => void;
  duplicateCultivarForTechnicalProfile: (index: number) => void;
  drawMode: DrawMode;
  statusLabel: string;
  startMainDrawing: () => void;
  startZoneDrawing: () => void;
  cancelDrawing: () => void;
  finishDrawing: () => void;
  zones: MapPoint[][];
  selectedMainPolygon: boolean;
  selectedZoneIndex: number | null;
  setSelectedZoneIndex: (index: number | null) => void;
  toggleMainPolygonSelection: () => void;
  toggleZoneSelection: (zoneIndex: number) => void;
  removeSelectedZone: () => void;
  removeMainPolygon: () => void;
  selectedVertex: SelectedVertex | null;
  selectMainVertex: (pointIndex: number) => void;
  selectZoneVertex: (zoneIndex: number, pointIndex: number) => void;
  clearSelectedVertex: () => void;
  removeSelectedVertex: () => void;
  removeCurrentSelection: () => void;
  canvasRef: RefObject<HTMLDivElement | null>;
  stageWidth: number;
  mainPoints: MapPoint[];
  currentPoints: MapPoint[];
  mousePos: MapPoint | null;
  handleStageClick: (event: any) => void;
  handleMouseMove: (event: any) => void;
  handleCloseWithRightClick: (event: any) => void;
  moveMainAnchor: (index: number, point: MapPoint) => boolean;
  moveZoneAnchor: (
    zoneIndex: number,
    pointIndex: number,
    point: MapPoint,
  ) => boolean;
  moveCurrentAnchor: (index: number, point: MapPoint) => boolean;
  insertMainPointAfter: (index: number) => void;
  insertZonePointAfter: (zoneIndex: number, pointIndex: number) => void;
  mapSearchValue: string;
  setMapSearchValue: (value: string) => void;
  mapSearchLoading: boolean;
  pointSearchValue: string;
  setPointSearchValue: (value: string) => void;
  addPointFromCoordinates: () => void;
  applyRealMapBackground: () => Promise<void>;
  clearRealMapBackground: () => void;
  mapCenter: GeoPoint | null;
  mapZoom: number;
  mapLayerId: GeoLayerId;
  setMapLayerId: (value: GeoLayerId) => void;
  mapInteractive: boolean;
  setMapInteractive: (value: boolean) => void;
  onRealMapViewChange: (next: { center: GeoPoint; zoom: number }) => void;
  mapHasRealBackground: boolean;
  save: () => Promise<void>;
  saving: boolean;
}) {
  const previewPathPoints =
    props.currentPoints.length > 0
      ? [
          ...props.currentPoints,
          props.mousePos ?? props.currentPoints[props.currentPoints.length - 1],
        ]
      : [];

  const previewSegments =
    previewPathPoints.length >= 2
      ? previewPathPoints.slice(0, -1).map((start, index) => {
          const end = previewPathPoints[index + 1];
          const invalidZoneSegment =
            props.drawMode === 'zone' &&
            props.mainPoints.length >= 3 &&
            !isSegmentInsidePolygon(start, end, props.mainPoints);
          return {
            key: `preview-segment-${index}`,
            start,
            end,
            invalid: invalidZoneSegment,
          };
        })
      : [];

  const hasInvalidPreviewSegment = previewSegments.some((segment) => segment.invalid);
  const mainBounds = props.mainPoints.length > 0 ? polygonBounds(props.mainPoints) : null;
  const talhaoLabel = props.nome.trim() || 'Talhão';
  const isDrawingMode = props.drawMode !== 'none';
  const canInteractExistingShapes = !isDrawingMode;
  const canDeleteSelection =
    Boolean(props.selectedVertex) ||
    props.selectedZoneIndex != null ||
    props.selectedMainPolygon ||
    props.zones.length === 1;
  const deleteSelectionLabel = props.selectedVertex
    ? 'Excluir ponto selecionado (Del)'
    : props.selectedZoneIndex != null || props.zones.length === 1
      ? 'Remover zona selecionada (Del)'
      : props.selectedMainPolygon
        ? 'Remover limite selecionado (Del)'
        : 'Selecione ponto, zona ou limite para excluir';
  const mapLayerOptions = GEO_BASE_LAYERS.map((layer) => ({
    value: layer.id,
    label: layer.label,
  }));
  const [cultureSectionOpened, setCultureSectionOpened] = useState(false);

  const currentCultureRow = useMemo(
    () =>
      props.cultures.find(
        (row) => normalizeKey(row.cultura) === normalizeKey(props.currentCulture),
      ) ?? null,
    [props.cultures, props.currentCulture],
  );

  const historyCultureRows = useMemo(() => {
    const currentKey = normalizeKey(props.currentCulture);
    return props.cultures
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        if (!currentKey) return true;
        return normalizeKey(row.cultura) !== currentKey;
      });
  }, [props.cultures, props.currentCulture]);

  return (
    <Stack gap="sm">
      <Group
        justify="space-between"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          paddingBottom: 4,
          background: 'var(--mantine-color-body)',
        }}
      >
        <Text size="sm" c="dimmed">
          Acoes do detalhamento
        </Text>
        <Group gap="xs">
          <Tooltip label="Salvar detalhamento">
            <ActionIcon
              aria-label="Salvar detalhamento"
              color="green"
              size="lg"
              onClick={() => void props.save()}
              loading={props.saving}
            >
              <IconDeviceFloppy size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Group align="flex-end" wrap="wrap" gap="xs">
        <TextInput
          label="Nome do talhão"
          value={props.nome}
          onChange={(event) => props.setNome(event.currentTarget.value)}
          style={{ flex: '1 1 clamp(220px, 30vw, 320px)' }}
        />
        <NumberInput
          label="Area (ha)"
          value={props.areaHa}
          min={0}
          decimalScale={2}
          style={{ flex: '0 0 clamp(96px, 9vw, 136px)' }}
          onChange={(value) => {
            if (value == null || value === '') {
              props.setAreaHa('');
              return;
            }
            props.setAreaHa(Number(value));
          }}
        />
        <Box style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flex: '1 1 clamp(220px, 28vw, 300px)' }}>
          <Select
            label="Classe de solo (SiBCS)"
            placeholder="Selecione a classe"
            searchable
            clearable
            nothingFoundMessage="Nenhuma classe encontrada"
            data={props.soilOptions}
            value={props.tipoSolo.trim() ? props.tipoSolo : UNCLASSIFIED_SOIL_VALUE}
            onChange={(value) => props.setTipoSolo(value ?? UNCLASSIFIED_SOIL_VALUE)}
            style={{ flex: 1 }}
          />
          <Tooltip label="Classificar SiBCS">
            <ActionIcon
              aria-label="Classificar SiBCS"
              variant="light"
              color="green"
              size="lg"
              onClick={props.openSoilClassifier}
              mb={1}
            >
              <IconSearch size={16} />
            </ActionIcon>
          </Tooltip>
        </Box>
      </Group>
      <Group justify="space-between" align="center" mt={-4}>
        <Group gap={8}>
          {props.lastClassificationSummary ? (
            <Badge variant="light" color="teal">
              Ultima: {props.lastClassificationSummary}
            </Badge>
          ) : null}
        </Group>
      </Group>
      {props.selectedSoilDescription ? (
        <Text size="xs" c="dimmed" mt={-6}>
          {props.selectedSoilDescription}
        </Text>
      ) : null}

      <Card withBorder p="xs">
        <Group justify="space-between" mb="xs">
          <Group gap={8}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={
                cultureSectionOpened ? 'Recolher seção de culturas' : 'Expandir seção de culturas'
              }
              onClick={() => setCultureSectionOpened((prev) => !prev)}
            >
              {cultureSectionOpened ? (
                <IconChevronUp size={15} />
              ) : (
                <IconChevronDown size={15} />
              )}
            </ActionIcon>
            <Text fw={700}>Culturas do talhão</Text>
            <Badge color="grape">{props.cultures.length} registros</Badge>
          </Group>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={props.openCultureLinkModal}
          >
            Vincular cultura e período
          </Button>
        </Group>

        <Collapse in={cultureSectionOpened}>
          <Group align="stretch" gap="xs" wrap="wrap" grow>
            <Card withBorder p="xs" style={{ flex: '1 1 clamp(220px, 28vw, 360px)' }}>
              <Stack gap={6}>
                <Text fw={600} size="sm">
                  Espécie atual
                </Text>
                <Select
                  placeholder="Selecione a espécie ativa"
                  searchable
                  clearable
                  nothingFoundMessage="Nenhuma espécie encontrada"
                  data={props.currentCultureOptions}
                  value={props.currentCulture || null}
                  onChange={(value) => props.setCurrentCulture(value ?? '')}
                />
                {currentCultureRow ? (
                  <Text size="xs" c="dimmed">
                    {`Refino por cultivar: ${currentCultureRow.cultivar || '-'} | Período: ${formatMonthYear(currentCultureRow.data_inicio)} a ${formatMonthYear(currentCultureRow.data_fim)}`}
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed">
                    Sem espécie ativa selecionada.
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  Prioridade de referência para cálculos: cultivar quando informada; senão, espécie.
                </Text>
              </Stack>
            </Card>

            <Card withBorder p="xs" style={{ flex: '1 1 clamp(280px, 45vw, 620px)' }}>
              <Stack gap={6}>
                <Text fw={600} size="sm">
                  Histórico de culturas
                </Text>
                {historyCultureRows.length > 0 ? (
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Espécie</Table.Th>
                        <Table.Th>Cultivar (refino)</Table.Th>
                        <Table.Th>Período</Table.Th>
                        <Table.Th>Prioridade</Table.Th>
                        <Table.Th>Dados técnicos</Table.Th>
                        <Table.Th>Ações</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {historyCultureRows.map(({ row, index }) => (
                        <Table.Tr
                          key={`${row.cultura}-${row.data_inicio}-${row.data_fim}-${index}`}
                        >
                          <Table.Td>{row.cultura}</Table.Td>
                          <Table.Td>{row.cultivar || '-'}</Table.Td>
                          <Table.Td>
                            {`${formatMonthYear(row.data_inicio)} a ${formatMonthYear(row.data_fim)}`}
                          </Table.Td>
                          <Table.Td>
                            {row.cultivar ? 'Cultivar' : 'Espécie'}
                          </Table.Td>
                          <Table.Td>
                            {row.technical_profile_id
                              ? 'Cultivar custom'
                              : row.technical_priority === 'cultivar'
                                ? 'Cultivar RNC'
                                : 'Espécie'}
                          </Table.Td>
                          <Table.Td>
                            <Group gap={6}>
                              <Tooltip label="Duplicar cultivar para dados técnicos próprios">
                                <ActionIcon
                                  size="sm"
                                  variant="light"
                                  color="teal"
                                  aria-label="Duplicar cultivar para dados técnicos"
                                  onClick={() =>
                                    props.duplicateCultivarForTechnicalProfile(index)
                                  }
                                  disabled={!row.cultivar}
                                >
                                  <IconCopy size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Editar cultura/safra">
                                <ActionIcon
                                  size="sm"
                                  variant="light"
                                  color="blue"
                                  aria-label="Editar cultura/safra"
                                  onClick={() => props.openEditCultureModal(index)}
                                >
                                  <IconPencil size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Remover cultura/safra">
                                <ActionIcon
                                  size="sm"
                                  color="red"
                                  variant="light"
                                  aria-label="Remover cultura/safra"
                                  onClick={() => props.removeCulture(index)}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text size="sm" c="dimmed">
                    Nenhum histórico anterior para este talhão.
                  </Text>
                )}
              </Stack>
            </Card>
          </Group>
        </Collapse>
      </Card>

      <Modal
        opened={props.cultureModalOpened}
        onClose={props.closeCultureModal}
        title="Editar período da cultura"
        centered
      >
        <Stack>
          <TextInput
            label="Espécie (RNC)"
            value={props.cultureDraft.cultura}
            readOnly
          />

          <TextInput
            label="Cultivar (RNC - refino)"
            value={props.cultureDraft.cultivar ?? ''}
            readOnly
          />

          <Group grow>
            <TextInput
              type="month"
              label="Mês/ano inicial"
              value={props.cultureDraft.data_inicio}
              onChange={(event) =>
                props.setCultureDraft({
                  ...props.cultureDraft,
                  data_inicio: normalizeMonthYear(event.currentTarget.value),
                })
              }
            />
            <TextInput
              type="month"
              label="Mês/ano final"
              value={props.cultureDraft.data_fim}
              onChange={(event) =>
                props.setCultureDraft({
                  ...props.cultureDraft,
                  data_fim: normalizeMonthYear(event.currentTarget.value),
                })
              }
            />
          </Group>

          <Group justify="flex-end">
            <Tooltip label="Cancelar">
              <ActionIcon
                variant="light"
                color="gray"
                size="lg"
                aria-label="Cancelar"
                onClick={props.closeCultureModal}
              >
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Salvar periodo">
              <ActionIcon
                color="green"
                size="lg"
                aria-label="Salvar periodo"
                onClick={props.saveCultureDraft}
              >
                <IconDeviceFloppy size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={props.cultureLinkModalOpened}
        onClose={props.closeCultureLinkModal}
        title="Vincular espécie/cultivar ao talhão"
        centered
        size="clamp(340px, 92vw, 1180px)"
      >
        <RncCultivarSelector
          mode="picker"
          onSelect={props.handleLinkCultureFromRnc}
        />
      </Modal>

      <Card withBorder p="xs">
        <Group justify="space-between" mb="xs">
          <Group gap={6} align="center">
            <Text fw={700}>Croqui do talhao</Text>
            <Tooltip label="Croqui visual de referencia, sem proporcao/escala real do terreno.">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Ajuda sobre escala do croqui do talhão"
              >
                <IconHelpCircle size={15} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Badge color={props.drawMode === 'none' ? 'blue' : 'orange'}>
            {props.statusLabel}
          </Badge>
        </Group>

        <Group
          mb="sm"
          gap={6}
          wrap="nowrap"
          style={{ overflowX: 'auto', paddingBottom: 2 }}
        >
          <TextInput
            style={{ flex: 1, minWidth: 226 }}
            size="sm"
            aria-label="Referencia real por CEP ou coordenadas"
            placeholder="CEP ou coordenadas"
            value={props.mapSearchValue}
            onChange={(event) => props.setMapSearchValue(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void props.applyRealMapBackground();
              }
            }}
          />
          <Tooltip label="Aplicar fundo real">
            <ActionIcon
              color="blue"
              size="md"
              aria-label="Aplicar fundo real"
              loading={props.mapSearchLoading}
              onClick={() => void props.applyRealMapBackground()}
            >
              <IconSearch size={16} />
            </ActionIcon>
          </Tooltip>
          <TextInput
            size="sm"
            style={{ width: 188, minWidth: 188 }}
            aria-label="Adicionar ponto por coordenadas"
            placeholder="Lat, Lon do ponto"
            value={props.pointSearchValue}
            onChange={(event) => props.setPointSearchValue(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                props.addPointFromCoordinates();
              }
            }}
          />
          <Tooltip label="Inserir ponto por coordenada">
            <ActionIcon
              size="md"
              color="teal"
              aria-label="Inserir ponto por coordenada"
              onClick={props.addPointFromCoordinates}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </Tooltip>
          <Select
            size="sm"
            placeholder="Camada"
            aria-label="Selecionar camada do mapa"
            style={{ width: 129, minWidth: 129 }}
            data={mapLayerOptions}
            value={props.mapLayerId}
            onChange={(value) => {
              if (!value) return;
              props.setMapLayerId(value as GeoLayerId);
            }}
            disabled={!props.mapHasRealBackground}
          />
          <Tooltip
            label={
              props.mapInteractive
                ? 'Desativar navegacao do mapa'
                : 'Ativar navegacao do mapa (pan/zoom)'
            }
          >
            <ActionIcon
              size="md"
              color={props.mapInteractive ? 'teal' : 'gray'}
              variant={props.mapInteractive ? 'filled' : 'light'}
              aria-label="Alternar navegacao do mapa"
              onClick={() => props.setMapInteractive(!props.mapInteractive)}
              disabled={!props.mapHasRealBackground || props.drawMode !== 'none'}
            >
              <IconMap2 size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Voltar para fundo ilustrativo">
            <ActionIcon
              color="gray"
              variant="light"
              size="md"
              aria-label="Voltar para fundo ilustrativo"
              onClick={props.clearRealMapBackground}
              disabled={!props.mapHasRealBackground}
            >
              <IconMapOff size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Desenhar limite do talhão">
            <ActionIcon
              variant="light"
              size="md"
              aria-label="Desenhar limite do talhão"
              onClick={props.startMainDrawing}
              disabled={
                props.drawMode !== 'none' || props.mainPoints.length >= 3 || props.mapInteractive
              }
            >
              <IconPolygon size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Adicionar zona de exclusao">
            <ActionIcon
              variant="light"
              color="red"
              size="md"
              aria-label="Adicionar zona de exclusao"
              onClick={props.startZoneDrawing}
              disabled={props.drawMode !== 'none' || props.mapInteractive}
            >
              <IconVectorSpline size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Cancelar desenho">
            <ActionIcon
              variant="light"
              color="gray"
              size="md"
              aria-label="Cancelar desenho"
              onClick={props.cancelDrawing}
              disabled={props.drawMode === 'none' || props.mapInteractive}
            >
              <IconBan size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Concluir desenho">
            <ActionIcon
              size="md"
              color="green"
              aria-label="Concluir desenho"
              onClick={props.finishDrawing}
              disabled={props.drawMode === 'none' || props.mapInteractive}
            >
              <IconCheck size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={deleteSelectionLabel}>
            <ActionIcon
              color="red"
              variant="light"
              size="md"
              aria-label="Excluir selecao atual"
              onClick={props.removeCurrentSelection}
              disabled={!canDeleteSelection}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Excluir ponto selecionado (Del)">
            <ActionIcon
              color="orange"
              variant="light"
              size="md"
              aria-label="Excluir ponto selecionado"
              onClick={props.removeSelectedVertex}
              disabled={!props.selectedVertex}
            >
              <IconMinus size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Remover limite do talhão">
            <ActionIcon
              color="orange"
              variant="light"
              size="md"
              aria-label="Remover limite do talhão"
              onClick={props.removeMainPolygon}
              disabled={
                props.mainPoints.length === 0 &&
                props.currentPoints.length === 0 &&
                props.zones.length === 0
              }
            >
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <div
          ref={props.canvasRef}
          style={{
            width: '100%',
            height: 440,
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: '#e8efe1',
            backgroundImage: props.mapCenter ? undefined : `url(${mapReferenceBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
          }}
        >
          {props.mapCenter ? (
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              <Suspense
                fallback={
                  <Center h="100%">
                    <Loader size="sm" />
                  </Center>
                }
              >
                <LazyGeoBackdropMap
                  center={props.mapCenter}
                  zoom={props.mapZoom}
                  layerId={props.mapLayerId}
                  interactive={props.mapInteractive}
                  onViewChange={props.onRealMapViewChange}
                />
              </Suspense>
            </div>
          ) : null}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              pointerEvents: props.mapInteractive ? 'none' : 'auto',
            }}
          >
            <Stage
              width={props.stageWidth}
              height={440}
              onMouseDown={props.handleStageClick}
              onMouseMove={props.handleMouseMove}
              onContextMenu={props.handleCloseWithRightClick}
            >
              <Layer>
              {props.mainPoints.length >= 3 ? (
                <>
                  <Line
                    points={flattenPoints(props.mainPoints)}
                    closed
                    listening={canInteractExistingShapes}
                    fill={
                      props.selectedMainPolygon
                        ? 'rgba(34,197,94,0.46)'
                        : 'rgba(34,197,94,0.35)'
                    }
                    stroke={props.selectedMainPolygon ? '#065f46' : '#15803d'}
                    strokeWidth={props.selectedMainPolygon ? 2.5 : 2}
                    onMouseDown={(event) => {
                      event.cancelBubble = true;
                      props.toggleMainPolygonSelection();
                    }}
                    onTouchStart={(event) => {
                      event.cancelBubble = true;
                      props.toggleMainPolygonSelection();
                    }}
                  />
                  <KonvaText
                    x={mainBounds ? (mainBounds.minX + mainBounds.maxX) / 2 - 120 : 0}
                    y={mainBounds ? Math.max(8, mainBounds.minY - 26) : 8}
                    width={240}
                    align="center"
                    text={talhaoLabel}
                    fontSize={13}
                    fontStyle="bold"
                    fill="#14532d"
                    listening={false}
                  />
                  {props.drawMode === 'none'
                    ? props.mainPoints.map((point, index) => {
                        const next = props.mainPoints[(index + 1) % props.mainPoints.length];
                        const middle = midpoint(point, next);
                        return (
                          <KonvaGroup key={`main-insert-${index}`}>
                            <Line
                              points={[point.x, point.y, next.x, next.y]}
                              stroke="rgba(14,165,233,0.001)"
                              strokeWidth={20}
                              lineCap="round"
                              onMouseDown={(event) => {
                                event.cancelBubble = true;
                                props.insertMainPointAfter(index);
                              }}
                              onTouchStart={(event) => {
                                event.cancelBubble = true;
                                props.insertMainPointAfter(index);
                              }}
                            />
                            <Circle
                              x={middle.x}
                              y={middle.y}
                              radius={4.5}
                              fill="rgba(14,165,233,0.75)"
                              stroke="#ffffff"
                              strokeWidth={1}
                              hitStrokeWidth={18}
                              onMouseDown={(event) => {
                                event.cancelBubble = true;
                                props.insertMainPointAfter(index);
                              }}
                              onTouchStart={(event) => {
                                event.cancelBubble = true;
                                props.insertMainPointAfter(index);
                              }}
                            />
                          </KonvaGroup>
                        );
                      })
                    : null}
                  {props.mainPoints.map((point, index) => (
                    (() => {
                      const isSelected =
                        props.selectedVertex?.kind === 'main' &&
                        props.selectedVertex.pointIndex === index;
                      return (
                        <Circle
                          key={`main-anchor-${index}`}
                          x={point.x}
                          y={point.y}
                          radius={7}
                          fill={isSelected ? '#0369a1' : '#0f172a'}
                          stroke={isSelected ? '#67e8f9' : '#ffffff'}
                          strokeWidth={isSelected ? 2.3 : 1.5}
                          hitStrokeWidth={24}
                          listening={canInteractExistingShapes}
                          draggable={canInteractExistingShapes}
                          onMouseDown={(event) => {
                            event.cancelBubble = true;
                            props.selectMainVertex(index);
                          }}
                          onTouchStart={(event) => {
                            event.cancelBubble = true;
                            props.selectMainVertex(index);
                          }}
                          onClick={() => props.selectMainVertex(index)}
                          onDragMove={(event) => {
                            const { x, y } = event.target.position();
                            const moved = props.moveMainAnchor(index, { x, y });
                            if (!moved) {
                              event.target.position({ x: point.x, y: point.y });
                            }
                          }}
                        />
                      );
                    })()
                  ))}
                </>
              ) : null}

              {props.zones.map((zone, index) => (
                <KonvaGroup key={`zone-group-${index}`}>
                  <Line
                    points={flattenPoints(zone)}
                    closed
                    listening={canInteractExistingShapes}
                    fill={
                      props.selectedZoneIndex === index
                        ? 'rgba(244,63,94,0.5)'
                        : 'rgba(239,68,68,0.35)'
                    }
                    stroke={props.selectedZoneIndex === index ? '#9f1239' : '#b91c1c'}
                    strokeWidth={2}
                    onMouseDown={(event) => {
                      event.cancelBubble = true;
                      props.toggleZoneSelection(index);
                      props.clearSelectedVertex();
                    }}
                    onTouchStart={(event) => {
                      event.cancelBubble = true;
                      props.toggleZoneSelection(index);
                      props.clearSelectedVertex();
                    }}
                  />
                  {props.drawMode === 'none'
                    ? zone.map((point, pointIndex) => {
                        const next = zone[(pointIndex + 1) % zone.length];
                        const middle = midpoint(point, next);
                        return (
                          <KonvaGroup key={`zone-insert-${index}-${pointIndex}`}>
                            <Line
                              points={[point.x, point.y, next.x, next.y]}
                              stroke="rgba(244,63,94,0.001)"
                              strokeWidth={20}
                              lineCap="round"
                              onMouseDown={(event) => {
                                event.cancelBubble = true;
                                props.setSelectedZoneIndex(index);
                                props.insertZonePointAfter(index, pointIndex);
                              }}
                              onTouchStart={(event) => {
                                event.cancelBubble = true;
                                props.setSelectedZoneIndex(index);
                                props.insertZonePointAfter(index, pointIndex);
                              }}
                            />
                            <Circle
                              x={middle.x}
                              y={middle.y}
                              radius={4.2}
                              fill="rgba(244,63,94,0.75)"
                              stroke="#ffffff"
                              strokeWidth={1}
                              hitStrokeWidth={18}
                              onMouseDown={(event) => {
                                event.cancelBubble = true;
                                props.setSelectedZoneIndex(index);
                                props.insertZonePointAfter(index, pointIndex);
                              }}
                              onTouchStart={(event) => {
                                event.cancelBubble = true;
                                props.setSelectedZoneIndex(index);
                                props.insertZonePointAfter(index, pointIndex);
                              }}
                            />
                          </KonvaGroup>
                        );
                      })
                    : null}
                  {zone.map((point, pointIndex) => (
                    (() => {
                      const isSelected =
                        props.selectedVertex?.kind === 'zone' &&
                        props.selectedVertex.zoneIndex === index &&
                        props.selectedVertex.pointIndex === pointIndex;
                      return (
                        <Circle
                          key={`zone-anchor-${index}-${pointIndex}`}
                          x={point.x}
                          y={point.y}
                          radius={6}
                          fill={isSelected ? '#be123c' : '#7f1d1d'}
                          stroke={isSelected ? '#fecdd3' : '#ffffff'}
                          strokeWidth={isSelected ? 2.2 : 1.2}
                          hitStrokeWidth={22}
                          listening={canInteractExistingShapes}
                          draggable={canInteractExistingShapes}
                          onMouseDown={(event) => {
                            event.cancelBubble = true;
                            props.selectZoneVertex(index, pointIndex);
                          }}
                          onTouchStart={(event) => {
                            event.cancelBubble = true;
                            props.selectZoneVertex(index, pointIndex);
                          }}
                          onDragMove={(event) => {
                            const { x, y } = event.target.position();
                            const moved = props.moveZoneAnchor(index, pointIndex, { x, y });
                            if (!moved) {
                              event.target.position({ x: point.x, y: point.y });
                            }
                          }}
                          onClick={() => props.selectZoneVertex(index, pointIndex)}
                        />
                      );
                    })()
                  ))}
                </KonvaGroup>
              ))}

              {props.currentPoints.length > 0 ? (
                <>
                  {previewSegments.map((segment) => (
                    <Line
                      key={segment.key}
                      points={[segment.start.x, segment.start.y, segment.end.x, segment.end.y]}
                      stroke={segment.invalid ? '#dc2626' : '#0f172a'}
                      strokeWidth={segment.invalid ? 2.6 : 2}
                      dash={segment.invalid ? [4, 3] : [6, 4]}
                    />
                  ))}
                  {props.currentPoints.map((point, index) => (
                    <Circle
                      key={`current-anchor-${index}`}
                      x={point.x}
                      y={point.y}
                      radius={7}
                      fill="#111827"
                      stroke="#ffffff"
                      strokeWidth={1.2}
                      hitStrokeWidth={22}
                      draggable
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onTouchStart={(event) => {
                        event.cancelBubble = true;
                      }}
                      onDragMove={(event) => {
                        const { x, y } = event.target.position();
                        const moved = props.moveCurrentAnchor(index, { x, y });
                        if (!moved) {
                          event.target.position({ x: point.x, y: point.y });
                        }
                      }}
                    />
                  ))}
                </>
              ) : null}
              </Layer>
            </Stage>
          </div>
        </div>

        <Group justify="space-between" mt="sm">
          <Text size="sm" c="dimmed">
            Um desenho principal por talhao. Zonas de exclusao podem ser varias.
          </Text>
          <Badge color="red">{props.zones.length} zonas</Badge>
        </Group>
        <Text size="sm" c="dimmed" mt={4}>
          Arraste as bolinhas para editar vertices. Clique na bolinha para selecionar e use Excluir ponto (Del).
        </Text>
        {props.drawMode === 'zone' && props.currentPoints.length > 1 && hasInvalidPreviewSegment ? (
          <Text size="sm" c="red.6" mt={2}>
            Existe aresta fora da area util. Ajuste os pontos ate todas as arestas ficarem validas.
          </Text>
        ) : null}
      </Card>

    </Stack>
  );
}
