import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import {
  Select as ShadSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import {
  Loader2,
  Plus,
  Search,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  Map as IconMap2,
  MapPinOff,
  Square,
  X,
  Copy,
  Info,
  Ban,
  Check,
  Pencil,
  Spline,
} from 'lucide-react';
import { cn } from '../../lib/utils';
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
  type ExclusionZone,
} from '../../services/propertyMapService';
import type { GeoPoint } from '../../services/mapBackgroundService';
import {
  type RncCultivarSelectionPayload,
} from '../../services/rncCultivarService';
import {
  GEO_BASE_LAYERS,
  type GeoLayerId,
} from '../../modules/geo/baseLayers';
import type {
  SoilClassificationRequest,
  SoilResultResponse,
} from '../../services/soilClassificationContractService';
import { lazyWithBoundary } from '../../router/lazyWithBoundary';
import RncCultivarSelector from '../../views/Rnc/RncCultivarSelector';

// ── Módulo Talhão (tipos, constantes, utilitários) ──────────────────────────
import type {
  DrawMode,
  SelectedVertex,
  CultureEntry,
} from '../../modules/talhao/types';
import {
  UNCLASSIFIED_SOIL_VALUE,
  UNCLASSIFIED_SOIL_LABEL,
} from '../../modules/talhao/constants';
import {
  flattenPoints,
  polygonBounds,
  isPolygonInsidePolygon,
  isSegmentInsidePolygon,
  midpoint,
} from '../../modules/talhao/utils/geometry';
import {
  normalizeMonthYear,
  formatMonthYear,
  normalizeKey,
  isUnclassifiedSoilValue,
  resolveSoilLinkedColor,
} from '../../modules/talhao/utils/formatters';

// ── Hooks do módulo Talhão ──────────────────────────────────────────────────
import { useTalhaoDrawing } from '../../modules/talhao/hooks/useTalhaoDrawing';
import { useTalhaoCultures } from '../../modules/talhao/hooks/useTalhaoCultures';
import { useTalhaoMapBackground } from '../../modules/talhao/hooks/useTalhaoMapBackground';

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
  const [stageWidth, setStageWidth] = useState(900);
  const [saving, setSaving] = useState(false);
  const [emptyAreaGuardOpened, setEmptyAreaGuardOpened] = useState(false);
  const [emptyAreaGuardReason, setEmptyAreaGuardReason] = useState<'close' | 'save'>('close');
  const [deletingEmptyTalhao, setDeletingEmptyTalhao] = useState(false);

  // ── Form state (nome, área, solo) ──────────────────────────────────────
  const [nome, setNome] = useState('');
  const [areaHa, setAreaHa] = useState<number | ''>('');
  const [tipoSolo, setTipoSolo] = useState('');
  const [availableSoils, setAvailableSoils] = useState<SoilCatalogEntry[]>([]);
  const [soilClassifierOpened, setSoilClassifierOpened] = useState(false);
  const [soilClassificationRequest, setSoilClassificationRequest] =
    useState<SoilClassificationRequest | null>(null);
  const [soilClassificationResult, setSoilClassificationResult] =
    useState<SoilResultResponse | null>(null);
  const [soilClassificationSnapshot, setSoilClassificationSnapshot] =
    useState<TalhaoSoilClassificationSnapshot | null>(null);

  // ── Hooks extraídos ────────────────────────────────────────────────────
  const drawing = useTalhaoDrawing();
  const culturesHook = useTalhaoCultures();
  const mapBg = useTalhaoMapBackground();

  // ── Aliases para compatibilidade com GridLayout props ──────────────────
  const {
    drawMode, mainPoints, zones, currentPoints, mousePos, selectedVertex,
    selectedZoneIndex, selectedMainPolygon, statusLabel,
    setSelectedZoneIndex,
    showDrawWarning, handleStageClick, handleMouseMove,
    startMainDrawing, startZoneDrawing, cancelDrawing, finishDrawing,
    removeSelectedZone, removeMainPolygon, clearSelectedVertex,
    toggleMainPolygonSelection, toggleZoneSelection,
    selectMainVertex, selectZoneVertex, removeCurrentSelection,
    moveMainAnchor, moveZoneAnchor, moveCurrentAnchor,
    insertMainPointAfter, insertZonePointAfter,
    removeSelectedVertex,
  } = drawing;

  const {
    cultures, currentCulture, setCurrentCulture,
    cultureDraft, setCultureDraft, cultureModalOpened, cultureLinkModalOpened,
    currentCultureOptions,
    openCultureLinkModal, closeCultureLinkModal, handleLinkCultureFromRnc,
    openEditCultureModal, closeCultureModal, saveCultureDraft,
    removeCulture, duplicateCultivarForTechnicalProfile,
  } = culturesHook;

  const {
    mapSearchValue, setMapSearchValue, mapSearchLoading,
    mapCenter, mapZoom, mapLayerId, setMapLayerId,
    mapInteractive, setMapInteractive,
    pointSearchValue, setPointSearchValue,
    applyRealMapBackground, clearRealMapBackground, handleRealMapViewChange,
  } = mapBg;

  // ── Canvas resize observer ─────────────────────────────────────────────
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

  // ── Init do talhão ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!opened || !talhao) return;
    const geometry = parseTalhaoGeometry(talhao.coordenadas_svg);

    // Desenho
    drawing.resetFromGeometry(geometry.points, geometry.exclusionZones);

    // Form
    setNome(talhao.nome ?? '');
    setAreaHa(talhao.area_ha == null ? '' : talhao.area_ha);
    setTipoSolo(
      !talhao.tipo_solo || isUnclassifiedSoilValue(talhao.tipo_solo)
        ? UNCLASSIFIED_SOIL_VALUE
        : talhao.tipo_solo,
    );

    // Culturas
    const parsedCultures: CultureEntry[] = Array.isArray(talhao.historico_culturas)
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
    const persistedCurrentCulture =
      typeof geometry.currentCulture === 'string' ? geometry.currentCulture.trim() : '';
    culturesHook.resetFromTalhao(parsedCultures, persistedCurrentCulture);

    // Solo / classificação
    setSoilClassifierOpened(false);
    setSoilClassificationSnapshot(geometry.soilClassification ?? null);
    setSoilClassificationRequest(geometry.soilClassification?.request ?? null);
    setSoilClassificationResult(geometry.soilClassification?.response ?? null);

    // Mapa de fundo
    mapBg.resetFromGeometry(geometry.mapReference ?? null);
  }, [opened, talhao]);

  // ── Derivados do formulário ────────────────────────────────────────────
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

  // ── Classificação de solo ──────────────────────────────────────────────
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

  // ── Persistência de desenho (right-click save) ─────────────────────────
  const persistDrawingOnly = async (
    nextMainPoints: MapPoint[],
    nextZones: ExclusionZone[],
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
    drawing.handleCloseWithRightClick(event, persistDrawingOnly);
  };

  // ── addPointFromCoordinates (delega ao hook de mapa) ───────────────────
  const addPointFromCoordinates = () => {
    mapBg.addPointFromCoordinates({
      drawMode,
      mainPoints,
      currentPoints,
      stageWidth,
      setCurrentPoints: drawing.setCurrentPoints,
      setMousePos: drawing.setMousePos,
      showDrawWarning,
    });
  };

  // ── Keyboard shortcut (Delete/Backspace) ──────────────────────────────
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
      (zone) => zone.points.length >= 3 && !isPolygonInsidePolygon(zone.points, mainPoints),
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
    <Dialog open={opened} onOpenChange={(val) => !val && handleRequestClose()}>
      <DialogContent className="max-w-[1280px] w-[95vw] overflow-hidden flex flex-col max-h-[96vh] p-0">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <DialogTitle className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
            {talhao ? `Detalhamento do talhão: ${talhao.nome}` : 'Detalhamento do talhão'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-6">
            {!talhao ? (
              <p className="text-sm text-slate-500 italic">Selecione um talhão para detalhar.</p>
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
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>

    <Dialog open={emptyAreaGuardOpened} onOpenChange={setEmptyAreaGuardOpened}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Talhão sem área</DialogTitle>
          <DialogDescription>
            {emptyAreaGuardReason === 'save'
              ? 'Este talhão ainda não possui área. Não é possível salvar sem informar área.'
              : 'Este talhão ainda não possui área.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-500">
            Você pode voltar para edição e preencher a área, ou excluir o talhão vazio.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setEmptyAreaGuardOpened(false)}
              disabled={deletingEmptyTalhao}
            >
              Cancelar e voltar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void deleteEmptyTalhao()}
              disabled={deletingEmptyTalhao}
            >
              {deletingEmptyTalhao && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir talhão vazio
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={soilClassifierOpened} onOpenChange={closeSoilClassifier}>
      <DialogContent className="max-w-[1380px] w-[96vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle>Classificador SiBCS do talhão</DialogTitle>
          <DialogDescription>
            Execute a classificação, revise a confiança e aplique a ordem no campo de classe de solo do talhão.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 p-6">
          <div className="flex flex-col gap-4">
            {soilClassifierOpened ? (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-slate-400" size={32} />
                  </div>
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
          </div>
        </ScrollArea>
        <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Button variant="outline" onClick={closeSoilClassifier}>
            Fechar
          </Button>
          <Button onClick={applyClassificationToTalhao} disabled={!soilClassificationResult}>
            Aplicar classificação no talhão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  zones: ExclusionZone[];
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
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-20 pb-2 bg-white dark:bg-slate-950 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Ações do detalhamento
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => void props.save()}
            disabled={props.saving}
            className="h-9 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase"
          >
            {props.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            SALVAR DETALHAMENTO
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <Label htmlFor="talhao-nome" className="text-[10px] font-bold uppercase tracking-tight text-slate-500 mb-1.5 block">
            Nome do talhão
          </Label>
          <Input
            id="talhao-nome"
            value={props.nome}
            onChange={(event) => props.setNome(event.currentTarget.value)}
            className="h-10 text-sm"
          />
        </div>
        <div className="w-[120px] shrink-0">
          <Label htmlFor="talhao-area" className="text-[10px] font-bold uppercase tracking-tight text-slate-500 mb-1.5 block">
            Área (ha)
          </Label>
          <Input
            id="talhao-area"
            type="number"
            value={props.areaHa}
            min={0}
            step={0.01}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (value === '') {
                props.setAreaHa('');
                return;
              }
              props.setAreaHa(Number(value));
            }}
            className="h-10 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[220px] flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 mb-1.5 block">
              Classe de solo (SiBCS)
            </Label>
            <ShadSelect
              value={props.tipoSolo.trim() ? props.tipoSolo : UNCLASSIFIED_SOIL_VALUE}
              onValueChange={(value) => props.setTipoSolo(value || UNCLASSIFIED_SOIL_VALUE)}
            >
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="Selecione a classe" />
              </SelectTrigger>
              <SelectContent>
                {props.soilOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </ShadSelect>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 border-teal-200 dark:border-teal-800 text-teal-600 hover:bg-teal-50"
            onClick={props.openSoilClassifier}
            title="Classificar SiBCS com IA"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between -mt-2">
        <div className="flex gap-2">
          {props.lastClassificationSummary && (
            <Badge variant="secondary" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-bold">
              Última: {props.lastClassificationSummary}
            </Badge>
          )}
        </div>
      </div>

      {props.selectedSoilDescription && (
        <p className="text-[11px] text-slate-500 italic -mt-2 leading-relaxed">
          {props.selectedSoilDescription}
        </p>
      )}

      <Card className="border-slate-200 dark:border-slate-800 shadow-none">
        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-500"
              onClick={() => setCultureSectionOpened((prev) => !prev)}
            >
              {cultureSectionOpened ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Culturas do talhão
            </CardTitle>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
              {props.cultures.length} registros
            </Badge>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[10px] font-bold uppercase tracking-wider"
            onClick={props.openCultureLinkModal}
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Vincular cultura
          </Button>
        </CardHeader>

        {cultureSectionOpened && (
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4 rounded-lg border border-slate-100 dark:border-slate-800 p-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400">
                  Espécie atual
                </p>
                <ShadSelect
                  value={props.currentCulture || ""}
                  onValueChange={(value) => props.setCurrentCulture(value)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione a espécie ativa" />
                  </SelectTrigger>
                  <SelectContent>
                    {props.currentCultureOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </ShadSelect>
                {currentCultureRow ? (
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Refino por cultivar: <strong className="text-slate-700 dark:text-slate-300">{currentCultureRow.cultivar || '-'}</strong>
                    <br />
                    Período: <span className="font-medium">{formatMonthYear(currentCultureRow.data_inicio)} a {formatMonthYear(currentCultureRow.data_fim)}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">Sem espécie ativa selecionada.</p>
                )}
                <p className="text-[9px] text-slate-400 leading-tight">
                  Prioridade de referência para cálculos: cultivar quando informada; senão, espécie.
                </p>
              </div>

              <div className="lg:col-span-8 rounded-lg border border-slate-100 dark:border-slate-800 p-3 overflow-hidden">
                <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400 mb-2">
                  Histórico de culturas
                </p>
                {historyCultureRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/50">
                          <th className="px-2 py-1.5">Espécie</th>
                          <th className="px-2 py-1.5">Cultivar</th>
                          <th className="px-2 py-1.5">Período</th>
                          <th className="px-2 py-1.5">Fonte</th>
                          <th className="px-2 py-1.5 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyCultureRows.map(({ row, index }) => (
                          <tr
                            key={`${row.cultura}-${row.data_inicio}-${row.data_fim}-${index}`}
                            className="border-b border-slate-50 dark:border-slate-900 hover:bg-slate-50/30 dark:hover:bg-slate-900/30 transition-colors"
                          >
                            <td className="px-2 py-2 font-medium">{row.cultura}</td>
                            <td className="px-2 py-2 text-slate-500">{row.cultivar || '-'}</td>
                            <td className="px-2 py-2 text-slate-500">
                              {formatMonthYear(row.data_inicio)} a {formatMonthYear(row.data_fim)}
                            </td>
                            <td className="px-2 py-2">
                              <Badge variant="outline" className="text-[9px] py-0 h-4 bg-slate-50 text-slate-500 font-normal">
                                {row.technical_profile_id ? 'Custom' : row.technical_priority === 'cultivar' ? 'RNC' : 'Espécie'}
                              </Badge>
                            </td>
                            <td className="px-2 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                                  onClick={() => props.duplicateCultivarForTechnicalProfile(index)}
                                  disabled={!row.cultivar}
                                  title="Duplicar para dados próprios"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => props.openEditCultureModal(index)}
                                  title="Editar"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => props.removeCulture(index)}
                                  title="Remover"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic py-4 text-center">
                    Nenhum histórico anterior para este talhão.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

    <Dialog open={props.cultureModalOpened} onOpenChange={(val) => !val && props.closeCultureModal()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar período da cultura</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label className="text-[10px] uppercase font-bold text-slate-500">Espécie (RNC)</Label>
            <Input value={props.cultureDraft.cultura} readOnly className="h-9 bg-slate-50 text-xs" />
          </div>
          <div className="grid gap-2">
            <Label className="text-[10px] uppercase font-bold text-slate-500">Cultivar (RNC - refino)</Label>
            <Input value={props.cultureDraft.cultivar ?? ''} readOnly className="h-9 bg-slate-50 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-[10px] uppercase font-bold text-slate-500">Mês/ano inicial</Label>
              <Input
                type="month"
                value={props.cultureDraft.data_inicio}
                onChange={(event) =>
                  props.setCultureDraft({
                    ...props.cultureDraft,
                    data_inicio: normalizeMonthYear(event.currentTarget.value),
                  })
                }
                className="h-9 text-xs"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] uppercase font-bold text-slate-500">Mês/ano final</Label>
              <Input
                type="month"
                value={props.cultureDraft.data_fim}
                onChange={(event) =>
                  props.setCultureDraft({
                    ...props.cultureDraft,
                    data_fim: normalizeMonthYear(event.currentTarget.value),
                  })
                }
                className="h-9 text-xs"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={props.closeCultureModal}>
            <X className="mr-2 h-4 w-4" />
            CANCELAR
          </Button>
          <Button onClick={props.saveCultureDraft} className="bg-teal-600 hover:bg-teal-700">
            <Save className="mr-2 h-4 w-4" />
            SALVAR PERÍODO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={props.cultureLinkModalOpened} onOpenChange={(val) => !val && props.closeCultureLinkModal()}>
      <DialogContent className="max-w-[1180px] w-[92vw] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Vincular espécie/cultivar ao talhão</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 p-6">
          <RncCultivarSelector
            mode="picker"
            onSelect={props.handleLinkCultureFromRnc}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>

    <Card className="border-slate-200 dark:border-slate-800 shadow-none">
      <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Croqui do talhão
          </CardTitle>
          <Info className="h-4 w-4 text-slate-400 cursor-help" aria-label="Croqui visual de referência, sem proporção real." />
        </div>
        <Badge variant={props.drawMode === 'none' ? 'secondary' : 'destructive'} className="text-[10px] font-bold">
          {props.statusLabel}
        </Badge>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2 pb-2 overflow-x-auto">
          <div className="flex items-center gap-1 shrink-0">
            <Input
              className="h-9 w-[180px] text-xs"
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
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-blue-200 text-blue-600 hover:bg-blue-50"
              disabled={props.mapSearchLoading}
              onClick={() => void props.applyRealMapBackground()}
            >
              {props.mapSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex items-center gap-1 shrink-0 px-2 border-l">
            <Input
              className="h-9 w-[160px] text-xs"
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
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-teal-200 text-teal-600 hover:bg-teal-50"
              onClick={props.addPointFromCoordinates}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 shrink-0 px-2 border-l">
            <ShadSelect
              value={props.mapLayerId}
              onValueChange={(value) => props.setMapLayerId(value as GeoLayerId)}
              disabled={!props.mapHasRealBackground}
            >
              <SelectTrigger className="h-9 w-[120px] text-xs">
                <SelectValue placeholder="Camada" />
              </SelectTrigger>
              <SelectContent>
                {GEO_BASE_LAYERS.map((layer) => (
                  <SelectItem key={layer.id} value={layer.id}>
                    {layer.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </ShadSelect>

            <Button
              variant={props.mapInteractive ? "secondary" : "ghost"}
              size="icon"
              className={cn("h-9 w-9", props.mapInteractive ? "bg-teal-100 text-teal-700" : "text-slate-500")}
              onClick={() => props.setMapInteractive(!props.mapInteractive)}
              disabled={!props.mapHasRealBackground || props.drawMode !== 'none'}
              title="Alternar navegação"
            >
              <IconMap2 className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-500"
              onClick={props.clearRealMapBackground}
              disabled={!props.mapHasRealBackground}
              title="Fundo ilustrativo"
            >
              <MapPinOff className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 shrink-0 px-2 border-l">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-slate-200 text-slate-600"
              onClick={props.startMainDrawing}
              disabled={props.drawMode !== 'none' || props.mainPoints.length >= 3 || props.mapInteractive}
              title="Desenhar limite"
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-red-200 text-red-600 hover:bg-red-50"
              onClick={props.startZoneDrawing}
              disabled={props.drawMode !== 'none' || props.mapInteractive}
              title="Adicionar zona de exclusão"
            >
              <Spline className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-400"
              onClick={props.cancelDrawing}
              disabled={props.drawMode === 'none' || props.mapInteractive}
              title="Cancelar desenho"
            >
              <Ban className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-green-200 text-green-600 hover:bg-green-50"
              onClick={props.finishDrawing}
              disabled={props.drawMode === 'none' || props.mapInteractive}
              title="Concluir desenho"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 shrink-0 px-2 border-l">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-red-600 hover:bg-red-50"
              onClick={props.removeCurrentSelection}
              disabled={!canDeleteSelection}
              title="Excluir seleção"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          ref={props.canvasRef}
          className="relative w-full h-[440px] overflow-hidden rounded-lg border border-slate-200 bg-[#e8efe1]"
          style={{
            backgroundImage: props.mapCenter ? undefined : `url(${mapReferenceBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {props.mapCenter ? (
            <div className="absolute inset-0 z-0">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center bg-slate-100/50">
                    <Loader2 className="animate-spin text-slate-400" size={32} />
                  </div>
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
            className="absolute inset-0 z-10"
            style={{
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
                    points={flattenPoints(zone.points)}
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
                    ? zone.points.map((point, pointIndex) => {
                        const next = zone.points[(pointIndex + 1) % zone.points.length];
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
                  {zone.points.map((point, pointIndex) => (
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

        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-slate-400 italic">
            Um desenho principal por talhão. Arraste os pontos para editar.
          </p>
          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-100 font-bold">
            {props.zones.length} zonas
          </Badge>
        </div>
        {props.drawMode === 'zone' && props.currentPoints.length > 1 && hasInvalidPreviewSegment && (
          <p className="text-xs text-red-600 font-medium mt-1">
            Existe(m) aresta(s) fora da área útil. Ajuste os pontos.
          </p>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
