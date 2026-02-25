import { type RefObject } from 'react';
import { Button } from '../../ui/button';
import { Loader2, Save } from 'lucide-react';
import { TalhaoForm } from './TalhaoForm';
import { TalhaoCultures } from './TalhaoCultures';
import { TalhaoMapControls } from './TalhaoMapControls';
import { TalhaoMapCanvas } from './TalhaoMapCanvas';
import type { CultureEntry, DrawMode, SelectedVertex } from '../../../modules/talhao/types';
import type { RncCultivarSelectionPayload } from '../../../services/rncCultivarService';
import type { MapPoint, ExclusionZone } from '../../../services/propertyMapService';
import type { GeoPoint } from '../../../services/mapBackgroundService';
import { type GeoLayerId } from '../../../modules/geo/baseLayers';

interface TalhaoDetailLayoutProps {
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
}

export function TalhaoDetailLayout(props: TalhaoDetailLayoutProps) {
    const canDeleteSelection =
        Boolean(props.selectedVertex) ||
        props.selectedZoneIndex != null ||
        props.selectedMainPolygon ||
        props.zones.length === 1;

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

            <TalhaoForm
                nome={props.nome}
                setNome={props.setNome}
                areaHa={props.areaHa}
                setAreaHa={props.setAreaHa}
                tipoSolo={props.tipoSolo}
                setTipoSolo={props.setTipoSolo}
                soilOptions={props.soilOptions}
                selectedSoilDescription={props.selectedSoilDescription}
                openSoilClassifier={props.openSoilClassifier}
                lastClassificationSummary={props.lastClassificationSummary}
            />

            <TalhaoCultures
                cultures={props.cultures}
                currentCulture={props.currentCulture}
                setCurrentCulture={props.setCurrentCulture}
                currentCultureOptions={props.currentCultureOptions}
                cultureDraft={props.cultureDraft}
                setCultureDraft={props.setCultureDraft}
                cultureModalOpened={props.cultureModalOpened}
                cultureLinkModalOpened={props.cultureLinkModalOpened}
                closeCultureModal={props.closeCultureModal}
                closeCultureLinkModal={props.closeCultureLinkModal}
                saveCultureDraft={props.saveCultureDraft}
                openCultureLinkModal={props.openCultureLinkModal}
                handleLinkCultureFromRnc={props.handleLinkCultureFromRnc}
                openEditCultureModal={props.openEditCultureModal}
                removeCulture={props.removeCulture}
                duplicateCultivarForTechnicalProfile={props.duplicateCultivarForTechnicalProfile}
            />

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                <TalhaoMapControls
                    drawMode={props.drawMode}
                    statusLabel={props.statusLabel}
                    mapSearchValue={props.mapSearchValue}
                    setMapSearchValue={props.setMapSearchValue}
                    mapSearchLoading={props.mapSearchLoading}
                    applyRealMapBackground={props.applyRealMapBackground}
                    pointSearchValue={props.pointSearchValue}
                    setPointSearchValue={props.setPointSearchValue}
                    addPointFromCoordinates={props.addPointFromCoordinates}
                    mapLayerId={props.mapLayerId}
                    setMapLayerId={props.setMapLayerId}
                    mapInteractive={props.mapInteractive}
                    setMapInteractive={props.setMapInteractive}
                    mapHasRealBackground={props.mapHasRealBackground}
                    clearRealMapBackground={props.clearRealMapBackground}
                    startMainDrawing={props.startMainDrawing}
                    startZoneDrawing={props.startZoneDrawing}
                    cancelDrawing={props.cancelDrawing}
                    finishDrawing={props.finishDrawing}
                    canDeleteSelection={canDeleteSelection}
                    removeCurrentSelection={props.removeCurrentSelection}
                    mainPointsLength={props.mainPoints.length}
                />

                <TalhaoMapCanvas
                    canvasRef={props.canvasRef}
                    stageWidth={props.stageWidth}
                    handleStageClick={props.handleStageClick}
                    handleMouseMove={props.handleMouseMove}
                    handleCloseWithRightClick={props.handleCloseWithRightClick}
                    mapCenter={props.mapCenter}
                    mapZoom={props.mapZoom}
                    mapLayerId={props.mapLayerId}
                    mapInteractive={props.mapInteractive}
                    onRealMapViewChange={props.onRealMapViewChange}
                    mainPoints={props.mainPoints}
                    currentPoints={props.currentPoints}
                    mousePos={props.mousePos}
                    zones={props.zones}
                    drawMode={props.drawMode}
                    selectedMainPolygon={props.selectedMainPolygon}
                    toggleMainPolygonSelection={props.toggleMainPolygonSelection}
                    selectedVertex={props.selectedVertex}
                    selectMainVertex={props.selectMainVertex}
                    moveMainAnchor={props.moveMainAnchor}
                    insertMainPointAfter={props.insertMainPointAfter}
                    selectedZoneIndex={props.selectedZoneIndex}
                    toggleZoneSelection={props.toggleZoneSelection}
                    clearSelectedVertex={props.clearSelectedVertex}
                    setSelectedZoneIndex={props.setSelectedZoneIndex}
                    insertZonePointAfter={props.insertZonePointAfter}
                    selectZoneVertex={props.selectZoneVertex}
                    moveZoneAnchor={props.moveZoneAnchor}
                    moveCurrentAnchor={props.moveCurrentAnchor}
                    nome={props.nome}
                />
            </div>
        </div>
    );
}
