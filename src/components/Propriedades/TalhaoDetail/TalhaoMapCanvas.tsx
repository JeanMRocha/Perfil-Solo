import { Suspense, type RefObject } from 'react';
import {
    Stage,
    Layer,
    Line,
    Circle,
    Group as KonvaGroup,
    Text as KonvaText,
} from 'react-konva';
import { Loader2 } from 'lucide-react';
import mapReferenceBg from '../../../assets/map-reference-bg.svg';
import {
    flattenPoints,
    polygonBounds,
    isSegmentInsidePolygon,
    midpoint,
} from '../../../modules/talhao/utils/geometry';
import type { DrawMode, SelectedVertex } from '../../../modules/talhao/types';
import type { MapPoint, ExclusionZone } from '../../../services/propertyMapService';
import type { GeoPoint } from '../../../services/mapBackgroundService';
import { type GeoLayerId } from '../../../modules/geo/baseLayers';
import { lazyWithBoundary } from '../../../router/lazyWithBoundary';

const LazyGeoBackdropMap = lazyWithBoundary(
    () =>
        import('../../../modules/geo/GeoBackdropMap').then((module) => ({
            default: module.GeoBackdropMap,
        })),
    'GeoBackdropMap',
);

interface TalhaoMapCanvasProps {
    canvasRef: RefObject<HTMLDivElement | null>;
    stageWidth: number;
    handleStageClick: (event: any) => void;
    handleMouseMove: (event: any) => void;
    handleCloseWithRightClick: (event: any) => void;
    mapCenter: GeoPoint | null;
    mapZoom: number;
    mapLayerId: GeoLayerId;
    mapInteractive: boolean;
    onRealMapViewChange: (next: { center: GeoPoint; zoom: number }) => void;
    mainPoints: MapPoint[];
    currentPoints: MapPoint[];
    mousePos: MapPoint | null;
    zones: ExclusionZone[];
    drawMode: DrawMode;
    selectedMainPolygon: boolean;
    toggleMainPolygonSelection: () => void;
    selectedVertex: SelectedVertex | null;
    selectMainVertex: (index: number) => void;
    moveMainAnchor: (index: number, point: MapPoint) => boolean;
    insertMainPointAfter: (index: number) => void;
    selectedZoneIndex: number | null;
    toggleZoneSelection: (index: number) => void;
    clearSelectedVertex: () => void;
    setSelectedZoneIndex: (index: number | null) => void;
    insertZonePointAfter: (zoneIndex: number, pointIndex: number) => void;
    selectZoneVertex: (zoneIndex: number, pointIndex: number) => void;
    moveZoneAnchor: (zoneIndex: number, pointIndex: number, point: MapPoint) => boolean;
    moveCurrentAnchor: (index: number, point: MapPoint) => boolean;
    nome: string;
}

export function TalhaoMapCanvas({
    canvasRef,
    stageWidth,
    handleStageClick,
    handleMouseMove,
    handleCloseWithRightClick,
    mapCenter,
    mapZoom,
    mapLayerId,
    mapInteractive,
    onRealMapViewChange,
    mainPoints,
    currentPoints,
    mousePos,
    zones,
    drawMode,
    selectedMainPolygon,
    toggleMainPolygonSelection,
    selectedVertex,
    selectMainVertex,
    moveMainAnchor,
    insertMainPointAfter,
    selectedZoneIndex,
    toggleZoneSelection,
    clearSelectedVertex,
    setSelectedZoneIndex,
    insertZonePointAfter,
    selectZoneVertex,
    moveZoneAnchor,
    moveCurrentAnchor,
    nome,
}: TalhaoMapCanvasProps) {
    const previewPathPoints =
        currentPoints.length > 0
            ? [
                ...currentPoints,
                mousePos ?? currentPoints[currentPoints.length - 1],
            ]
            : [];

    const previewSegments =
        previewPathPoints.length >= 2
            ? previewPathPoints.slice(0, -1).map((start, index) => {
                const end = previewPathPoints[index + 1];
                const invalidZoneSegment =
                    drawMode === 'zone' &&
                    mainPoints.length >= 3 &&
                    !isSegmentInsidePolygon(start, end, mainPoints);
                return {
                    key: `preview-segment-${index}`,
                    start,
                    end,
                    invalid: invalidZoneSegment,
                };
            })
            : [];

    const mainBounds = mainPoints.length > 0 ? polygonBounds(mainPoints) : null;
    const talhaoLabel = nome.trim() || 'Talhão';
    const isDrawingMode = drawMode !== 'none';
    const canInteractExistingShapes = !isDrawingMode;

    return (
        <div
            ref={canvasRef}
            className="relative w-full h-[440px] overflow-hidden rounded-lg border border-slate-200 bg-[#e8efe1]"
            style={{
                backgroundImage: mapCenter ? undefined : `url(${mapReferenceBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            {mapCenter && (
                <div className="absolute inset-0 z-0">
                    <Suspense
                        fallback={
                            <div className="flex h-full items-center justify-center bg-slate-100/50">
                                <Loader2 className="animate-spin text-slate-400" size={32} />
                            </div>
                        }
                    >
                        <LazyGeoBackdropMap
                            center={mapCenter}
                            zoom={mapZoom}
                            layerId={mapLayerId}
                            interactive={mapInteractive}
                            onViewChange={onRealMapViewChange}
                        />
                    </Suspense>
                </div>
            )}
            <div
                className="absolute inset-0 z-10"
                style={{
                    pointerEvents: mapInteractive ? 'none' : 'auto',
                }}
            >
                <Stage
                    width={stageWidth}
                    height={440}
                    onMouseDown={handleStageClick}
                    onMouseMove={handleMouseMove}
                    onContextMenu={handleCloseWithRightClick}
                >
                    <Layer>
                        {mainPoints.length >= 3 && (
                            <>
                                <Line
                                    points={flattenPoints(mainPoints)}
                                    closed
                                    listening={canInteractExistingShapes}
                                    fill={
                                        selectedMainPolygon
                                            ? 'rgba(34,197,94,0.46)'
                                            : 'rgba(34,197,94,0.35)'
                                    }
                                    stroke={selectedMainPolygon ? '#065f46' : '#15803d'}
                                    strokeWidth={selectedMainPolygon ? 2.5 : 2}
                                    onMouseDown={(event) => {
                                        event.cancelBubble = true;
                                        toggleMainPolygonSelection();
                                    }}
                                    onTouchStart={(event) => {
                                        event.cancelBubble = true;
                                        toggleMainPolygonSelection();
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
                                {drawMode === 'none' &&
                                    mainPoints.map((point, index) => {
                                        const next = mainPoints[(index + 1) % mainPoints.length];
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
                                                        insertMainPointAfter(index);
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
                                                        insertMainPointAfter(index);
                                                    }}
                                                />
                                            </KonvaGroup>
                                        );
                                    })}
                                {mainPoints.map((point, index) => {
                                    const isSelected =
                                        selectedVertex?.kind === 'main' &&
                                        selectedVertex.pointIndex === index;
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
                                                selectMainVertex(index);
                                            }}
                                            onDragMove={(event) => {
                                                const { x, y } = event.target.position();
                                                const moved = moveMainAnchor(index, { x, y });
                                                if (!moved) {
                                                    event.target.position({ x: point.x, y: point.y });
                                                }
                                            }}
                                        />
                                    );
                                })}
                            </>
                        )}

                        {zones.map((zone, index) => (
                            <KonvaGroup key={`zone-group-${index}`}>
                                <Line
                                    points={flattenPoints(zone.points)}
                                    closed
                                    listening={canInteractExistingShapes}
                                    fill={
                                        selectedZoneIndex === index
                                            ? 'rgba(244,63,94,0.5)'
                                            : 'rgba(239,68,68,0.35)'
                                    }
                                    stroke={selectedZoneIndex === index ? '#9f1239' : '#b91c1c'}
                                    strokeWidth={2}
                                    onMouseDown={(event) => {
                                        event.cancelBubble = true;
                                        toggleZoneSelection(index);
                                        clearSelectedVertex();
                                    }}
                                />
                                {drawMode === 'none' &&
                                    zone.points.map((point, pointIndex) => {
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
                                                        setSelectedZoneIndex(index);
                                                        insertZonePointAfter(index, pointIndex);
                                                    }}
                                                />
                                                <Circle
                                                    x={middle.x}
                                                    y={middle.y}
                                                    radius={4.2}
                                                    fill="rgba(244,63,94,0.7)"
                                                    stroke="#ffffff"
                                                    strokeWidth={1}
                                                    hitStrokeWidth={16}
                                                    onMouseDown={(event) => {
                                                        event.cancelBubble = true;
                                                        setSelectedZoneIndex(index);
                                                        insertZonePointAfter(index, pointIndex);
                                                    }}
                                                />
                                            </KonvaGroup>
                                        );
                                    })}
                                {zone.points.map((point, pointIndex) => {
                                    const isSelected =
                                        selectedVertex?.kind === 'zone' &&
                                        selectedVertex.zoneIndex === index &&
                                        selectedVertex.pointIndex === pointIndex;
                                    return (
                                        <Circle
                                            key={`zone-anchor-${index}-${pointIndex}`}
                                            x={point.x}
                                            y={point.y}
                                            radius={6}
                                            fill={isSelected ? '#9f1239' : '#450a0a'}
                                            stroke={isSelected ? '#fda4af' : '#ffffff'}
                                            strokeWidth={isSelected ? 2 : 1.2}
                                            hitStrokeWidth={20}
                                            listening={canInteractExistingShapes}
                                            draggable={canInteractExistingShapes}
                                            onMouseDown={(event) => {
                                                event.cancelBubble = true;
                                                selectZoneVertex(index, pointIndex);
                                            }}
                                            onDragMove={(event) => {
                                                const { x, y } = event.target.position();
                                                const moved = moveZoneAnchor(index, pointIndex, { x, y });
                                                if (!moved) {
                                                    event.target.position({ x: point.x, y: point.y });
                                                }
                                            }}
                                        />
                                    );
                                })}
                            </KonvaGroup>
                        ))}

                        {currentPoints.length > 0 && (
                            <>
                                <Line
                                    points={flattenPoints(previewPathPoints)}
                                    stroke={drawMode === 'main' ? '#15803d' : '#b91c1c'}
                                    strokeWidth={2.5}
                                    dash={[10, 5]}
                                />
                                {previewSegments.map((seg) => (
                                    <Line
                                        key={seg.key}
                                        points={[seg.start.x, seg.start.y, seg.end.x, seg.end.y]}
                                        stroke={seg.invalid ? '#ef4444' : 'transparent'}
                                        strokeWidth={4}
                                        dash={[5, 3]}
                                    />
                                ))}
                                {currentPoints.map((point, index) => (
                                    <Circle
                                        key={`current-anchor-${index}`}
                                        x={point.x}
                                        y={point.y}
                                        radius={6}
                                        fill="#1e293b"
                                        stroke="#ffffff"
                                        strokeWidth={1.5}
                                        hitStrokeWidth={18}
                                        draggable
                                        onDragMove={(event) => {
                                            const { x, y } = event.target.position();
                                            const moved = moveCurrentAnchor(index, { x, y });
                                            if (!moved) {
                                                event.target.position({ x: point.x, y: point.y });
                                            }
                                        }}
                                    />
                                ))}
                            </>
                        )}
                    </Layer>
                </Stage>
            </div>
        </div>
    );
}
