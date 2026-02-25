import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import {
  Loader2,
} from 'lucide-react';
import { notify } from 'lib/notify';
import type { Talhao } from '../../types/property';
import {
  listSoilCatalog,
  type SoilCatalogEntry,
  findSoilCatalogEntry,
} from '../../services/soilCatalogService';
import {
  parseTalhaoGeometry,
  deleteTalhaoForProperty,
  type MapPoint,
  type TalhaoSoilClassificationSnapshot,
  updateTalhaoForProperty,
  type ExclusionZone,
} from '../../services/propertyMapService';
import type {
  SoilClassificationRequest,
  SoilResultResponse,
} from '../../services/soilClassificationContractService';
import { lazyWithBoundary } from '../../router/lazyWithBoundary';

// ── Módulo Talhão (constantes, utilitários, hooks) ──────────────────────────
import {
  UNCLASSIFIED_SOIL_VALUE,
  UNCLASSIFIED_SOIL_LABEL,
} from '../../modules/talhao/constants';
import {
  normalizeMonthYear,
  normalizeKey,
  isUnclassifiedSoilValue,
  resolveSoilLinkedColor,
} from '../../modules/talhao/utils/formatters';
import { useTalhaoDrawing } from '../../modules/talhao/hooks/useTalhaoDrawing';
import { useTalhaoCultures } from '../../modules/talhao/hooks/useTalhaoCultures';
import { useTalhaoMapBackground } from '../../modules/talhao/hooks/useTalhaoMapBackground';
import type { CultureEntry } from '../../modules/talhao/types';

// ── Novos Sub-componentes Refatorados ───────────────────────────────────────
import { TalhaoDetailLayout } from './TalhaoDetail/TalhaoDetailLayout';

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
      notify.show({
        title: 'Classificacao pendente',
        message: 'Execute a classificacao antes de aplicar no talhão.',
        color: 'yellow',
      });
      return;
    }
    if (!currentRequest || !currentResponse) {
      notify.show({
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
    notify.show({
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
        historico_culturas: culturesHook.cultures.map((item) => ({
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
      notify.show({
        title: 'Desenho salvo',
        message: 'Poligono fechado e salvo com clique direito.',
        color: 'green',
      });
    } catch (err: any) {
      notify.show({
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

  // ── Keyboard shortcut (Delete/Backspace) ──────────────────────────────
  useEffect(() => {
    if (!opened) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const hasSelection =
        Boolean(drawing.selectedVertex) ||
        drawing.selectedZoneIndex != null ||
        drawing.selectedMainPolygon ||
        drawing.mainPoints.length > 0;
      if (!hasSelection) return;

      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName ?? '';
      const isTyping =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        active?.isContentEditable === true;
      if (isTyping) return;

      event.preventDefault();
      drawing.removeCurrentSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [opened, drawing]);

  const save = async () => {
    if (!talhao) return;
    if (!nome.trim()) {
      notify.show({
        title: 'Nome obrigatorio',
        message: 'Informe o nome do talhão.',
        color: 'yellow',
      });
      return;
    }

    if (drawing.mainPoints.length < 3) {
      notify.show({
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

    try {
      setSaving(true);
      await updateTalhaoForProperty({
        talhaoId: talhao.id,
        nome: nome.trim(),
        area_ha: areaHa === '' ? undefined : Number(areaHa),
        tipo_solo: normalizedTipoSolo,
        color: resolvedTalhaoColor,
        points: drawing.mainPoints,
        exclusionZones: drawing.zones,
        mapReference: mapBg.mapCenter
          ? {
            center: mapBg.mapCenter,
            zoom: mapBg.mapZoom,
            layerId: mapBg.mapLayerId,
          }
          : null,
        soilClassification: soilClassificationSnapshot,
        currentCulture: culturesHook.currentCulture.trim() || null,
        historico_culturas: culturesHook.cultures.map((item) => ({
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
      notify.show({
        title: 'Talhão atualizado',
        message: 'Detalhamento do talhão salvo com sucesso.',
        color: 'green',
      });
    } catch (err: any) {
      notify.show({
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
      notify.show({
        title: 'Talhão vazio excluido',
        message: 'Talhão sem área removido com sucesso.',
        color: 'green',
      });
      setEmptyAreaGuardOpened(false);
      onClose();
    } catch (err: any) {
      notify.show({
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
      <Dialog open={opened} onOpenChange={(val: boolean) => !val && handleRequestClose()}>
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
                <TalhaoDetailLayout
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
                  currentCulture={culturesHook.currentCulture}
                  setCurrentCulture={culturesHook.setCurrentCulture}
                  currentCultureOptions={culturesHook.currentCultureOptions}
                  cultures={culturesHook.cultures}
                  cultureDraft={culturesHook.cultureDraft}
                  setCultureDraft={culturesHook.setCultureDraft}
                  cultureModalOpened={culturesHook.cultureModalOpened}
                  cultureLinkModalOpened={culturesHook.cultureLinkModalOpened}
                  closeCultureModal={culturesHook.closeCultureModal}
                  closeCultureLinkModal={culturesHook.closeCultureLinkModal}
                  saveCultureDraft={culturesHook.saveCultureDraft}
                  openCultureLinkModal={culturesHook.openCultureLinkModal}
                  handleLinkCultureFromRnc={culturesHook.handleLinkCultureFromRnc}
                  openEditCultureModal={culturesHook.openEditCultureModal}
                  removeCulture={culturesHook.removeCulture}
                  duplicateCultivarForTechnicalProfile={culturesHook.duplicateCultivarForTechnicalProfile}
                  drawMode={drawing.drawMode}
                  statusLabel={drawing.statusLabel}
                  startMainDrawing={drawing.startMainDrawing}
                  startZoneDrawing={drawing.startZoneDrawing}
                  cancelDrawing={drawing.cancelDrawing}
                  finishDrawing={drawing.finishDrawing}
                  zones={drawing.zones}
                  selectedMainPolygon={drawing.selectedMainPolygon}
                  selectedZoneIndex={drawing.selectedZoneIndex}
                  setSelectedZoneIndex={drawing.setSelectedZoneIndex}
                  toggleMainPolygonSelection={drawing.toggleMainPolygonSelection}
                  toggleZoneSelection={drawing.toggleZoneSelection}
                  removeSelectedZone={drawing.removeSelectedZone}
                  removeMainPolygon={drawing.removeMainPolygon}
                  selectedVertex={drawing.selectedVertex}
                  selectMainVertex={drawing.selectMainVertex}
                  selectZoneVertex={drawing.selectZoneVertex}
                  clearSelectedVertex={drawing.clearSelectedVertex}
                  removeSelectedVertex={drawing.removeSelectedVertex}
                  removeCurrentSelection={drawing.removeCurrentSelection}
                  canvasRef={canvasRef}
                  stageWidth={stageWidth}
                  mainPoints={drawing.mainPoints}
                  currentPoints={drawing.currentPoints}
                  mousePos={drawing.mousePos}
                  handleStageClick={drawing.handleStageClick}
                  handleMouseMove={drawing.handleMouseMove}
                  handleCloseWithRightClick={handleCloseWithRightClick}
                  moveMainAnchor={drawing.moveMainAnchor}
                  moveZoneAnchor={drawing.moveZoneAnchor}
                  moveCurrentAnchor={drawing.moveCurrentAnchor}
                  insertMainPointAfter={drawing.insertMainPointAfter}
                  insertZonePointAfter={drawing.insertZonePointAfter}
                  mapSearchValue={mapBg.mapSearchValue}
                  setMapSearchValue={mapBg.setMapSearchValue}
                  mapSearchLoading={mapBg.mapSearchLoading}
                  pointSearchValue={mapBg.pointSearchValue}
                  setPointSearchValue={mapBg.setPointSearchValue}
                  addPointFromCoordinates={() => mapBg.addPointFromCoordinates({
                    drawMode: drawing.drawMode,
                    mainPoints: drawing.mainPoints,
                    currentPoints: drawing.currentPoints,
                    stageWidth,
                    setCurrentPoints: drawing.setCurrentPoints,
                    setMousePos: drawing.setMousePos,
                    showDrawWarning: drawing.showDrawWarning,
                  })}
                  applyRealMapBackground={mapBg.applyRealMapBackground}
                  clearRealMapBackground={mapBg.clearRealMapBackground}
                  mapCenter={mapBg.mapCenter}
                  mapZoom={mapBg.mapZoom}
                  mapLayerId={mapBg.mapLayerId}
                  setMapLayerId={mapBg.setMapLayerId}
                  mapInteractive={mapBg.mapInteractive}
                  setMapInteractive={mapBg.setMapInteractive}
                  onRealMapViewChange={mapBg.handleRealMapViewChange}
                  mapHasRealBackground={Boolean(mapBg.mapCenter)}
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
