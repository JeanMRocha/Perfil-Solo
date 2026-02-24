/**
 * Hook que gerencia o estado e lógica de desenho do croqui do talhão.
 *
 * Responsabilidades:
 * - Estado de desenho (drawMode, mainPoints, zones, currentPoints, mousePos)
 * - Seleção (selectedVertex, selectedZoneIndex, selectedMainPolygon)
 * - Funções de draw (start, finish, cancel, handleStageClick, handleMouseMove)
 * - Funções de edição (move anchors, insert points, remove vertex/zone/polygon)
 * - Status label derivado
 */

import { useState, useMemo, useRef, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import type {
  MapPoint,
  ExclusionZone,
} from '../../../services/propertyMapService';
import type { DrawMode, SelectedVertex } from '../types';
import {
  isPointInsidePolygon,
  isPolygonInsidePolygon,
  midpoint,
} from '../utils/geometry';

export interface UseTalhaoDrawingReturn {
  drawMode: DrawMode;
  mainPoints: MapPoint[];
  setMainPoints: React.Dispatch<React.SetStateAction<MapPoint[]>>;
  zones: ExclusionZone[];
  setZones: React.Dispatch<React.SetStateAction<ExclusionZone[]>>;
  currentPoints: MapPoint[];
  setCurrentPoints: React.Dispatch<React.SetStateAction<MapPoint[]>>;
  mousePos: MapPoint | null;
  setMousePos: React.Dispatch<React.SetStateAction<MapPoint | null>>;
  selectedVertex: SelectedVertex | null;
  selectedZoneIndex: number | null;
  setSelectedZoneIndex: React.Dispatch<React.SetStateAction<number | null>>;
  selectedMainPolygon: boolean;
  statusLabel: string;
  lastDrawWarningAt: React.MutableRefObject<number>;

  showDrawWarning: (title: string, message: string) => void;
  handleStageClick: (event: any) => void;
  handleMouseMove: (event: any) => void;
  startMainDrawing: () => void;
  startZoneDrawing: () => void;
  cancelDrawing: () => void;
  finishDrawing: () => void;
  handleCloseWithRightClick: (
    event: any,
    persistDrawingOnly: (
      nextMainPoints: MapPoint[],
      nextZones: ExclusionZone[],
    ) => Promise<void>,
  ) => void;
  removeSelectedZone: () => void;
  removeMainPolygon: () => void;
  clearSelectedVertex: () => void;
  toggleMainPolygonSelection: () => void;
  toggleZoneSelection: (zoneIndex: number) => void;
  selectMainVertex: (pointIndex: number) => void;
  selectZoneVertex: (zoneIndex: number, pointIndex: number) => void;
  removeSelectedVertex: () => void;
  removeCurrentSelection: () => void;
  moveMainAnchor: (index: number, point: MapPoint) => boolean;
  moveZoneAnchor: (
    zoneIndex: number,
    pointIndex: number,
    point: MapPoint,
  ) => boolean;
  moveCurrentAnchor: (index: number, point: MapPoint) => boolean;
  insertMainPointAfter: (index: number) => void;
  insertZonePointAfter: (zoneIndex: number, pointIndex: number) => void;
  updateZoneName: (zoneId: string, newNome: string) => void;

  /** Reinicializa todo o estado a partir da geometria do talhão. */
  resetFromGeometry: (
    points: MapPoint[],
    exclusionZones: ExclusionZone[],
  ) => void;
}

export function useTalhaoDrawing(): UseTalhaoDrawingReturn {
  const lastDrawWarningAt = useRef(0);
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [currentPoints, setCurrentPoints] = useState<MapPoint[]>([]);
  const [mousePos, setMousePos] = useState<MapPoint | null>(null);
  const [mainPoints, setMainPoints] = useState<MapPoint[]>([]);
  const [zones, setZones] = useState<ExclusionZone[]>([]);
  const [selectedMainPolygon, setSelectedMainPolygon] = useState(false);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(
    null,
  );
  const [selectedVertex, setSelectedVertex] = useState<SelectedVertex | null>(
    null,
  );

  // ── Derivados ────────────────────────────────────────────────────────────

  const statusLabel = useMemo(() => {
    if (drawMode === 'main') return 'Desenhando limite principal';
    if (drawMode === 'zone') return 'Desenhando zona de exclusao';
    return 'Visualizacao';
  }, [drawMode]);

  // ── Warnings throttled ───────────────────────────────────────────────────

  const showDrawWarning = useCallback((title: string, message: string) => {
    const now = Date.now();
    if (now - lastDrawWarningAt.current < 700) return;
    lastDrawWarningAt.current = now;
    notifications.show({ title, message, color: 'yellow' });
  }, []);

  // ── Draw flow (start → click → finish/cancel) ───────────────────────────

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
      const newZone: ExclusionZone = {
        id: `zone-${Date.now()}`,
        nome: `Zona ${zones.length + 1}`,
        points: currentPoints,
      };
      setZones((prev) => [...prev, newZone]);
      notifications.show({
        title: 'Zona adicionada',
        message: 'Zona de exclusão adicionada ao talhão.',
        color: 'green',
      });
    }

    setDrawMode('none');
    setSelectedMainPolygon(false);
    setSelectedVertex(null);
    setCurrentPoints([]);
    setMousePos(null);
  };

  const handleCloseWithRightClick = (
    event: any,
    persistDrawingOnly: (
      nextMainPoints: MapPoint[],
      nextZones: ExclusionZone[],
    ) => Promise<void>,
  ) => {
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

    if (
      drawMode === 'zone' &&
      !isPolygonInsidePolygon(currentPoints, mainPoints)
    ) {
      notifications.show({
        title: 'Zona fora da area util',
        message:
          'Todos os pontos da zona de exclusao precisam ficar dentro da area util do talhão.',
        color: 'yellow',
      });
      return;
    }

    const nextMainPoints = drawMode === 'main' ? currentPoints : mainPoints;
    let nextZones = zones;
    if (drawMode === 'zone') {
      const newZone: ExclusionZone = {
        id: `zone-${Date.now()}`,
        nome: `Zona ${zones.length + 1}`,
        points: currentPoints,
      };
      nextZones = [...zones, newZone];
    }

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

  // ── Selection / Removal ──────────────────────────────────────────────────

  const removeSelectedZone = () => {
    const targetIndex =
      selectedZoneIndex != null
        ? selectedZoneIndex
        : zones.length === 1
          ? 0
          : null;

    if (targetIndex == null) {
      notifications.show({
        title: 'Selecione a zona',
        message: 'Escolha a zona de exclusao para remover.',
        color: 'yellow',
      });
      return;
    }

    setZones((prev: ExclusionZone[]) =>
      prev.filter((_, idx) => idx !== targetIndex),
    );
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
        (zone) =>
          zone.points.length >= 3 &&
          !isPolygonInsidePolygon(zone.points, nextMainPoints),
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

    const zoneObj = zones[selectedVertex.zoneIndex];
    if (!zoneObj) {
      setSelectedVertex(null);
      return;
    }
    const zonePoints = zoneObj.points;
    if (zonePoints.length <= 3) {
      notifications.show({
        title: 'Minimo de 3 pontos',
        message:
          'A zona precisa ter ao menos 3 vertices. Use remover zona para excluir totalmente.',
        color: 'yellow',
      });
      return;
    }

    const nextZonePoints = zonePoints.filter(
      (_, idx) => idx !== selectedVertex.pointIndex,
    );
    if (!isPolygonInsidePolygon(nextZonePoints, mainPoints)) {
      notifications.show({
        title: 'Ajuste inválido',
        message: 'A zona precisa continuar dentro da area util.',
        color: 'yellow',
      });
      return;
    }

    setZones((prev: ExclusionZone[]) =>
      prev.map((item, idx) =>
        idx === selectedVertex.zoneIndex
          ? { ...item, points: nextZonePoints }
          : item,
      ),
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

  // ── Anchor movement ──────────────────────────────────────────────────────

  const moveMainAnchor = (index: number, point: MapPoint): boolean => {
    const nextMainPoints = mainPoints.map((item, idx) =>
      idx === index ? point : item,
    );
    const hasZoneOutside = zones.some(
      (zone) =>
        zone.points.length >= 3 &&
        !isPolygonInsidePolygon(zone.points, nextMainPoints),
    );
    if (hasZoneOutside) {
      showDrawWarning(
        'Ajuste inválido',
        'Esse movimento colocaria uma zona de exclusão fora da área útil.',
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
    const zoneObj = zones[zoneIndex];
    if (!zoneObj) return false;
    const nextZonePoints = zoneObj.points.map((item, pIdx) =>
      pIdx === pointIndex ? point : item,
    );
    if (!isPolygonInsidePolygon(nextZonePoints, mainPoints)) {
      showDrawWarning(
        'Ajuste inválido',
        'A zona de exclusão precisa permanecer dentro da área útil.',
      );
      return false;
    }
    setZones((prev) =>
      prev.map((item, idx) =>
        idx === zoneIndex ? { ...item, points: nextZonePoints } : item,
      ),
    );
    return true;
  };

  const moveCurrentAnchor = (index: number, point: MapPoint): boolean => {
    const nextCurrent = currentPoints.map((item, idx) =>
      idx === index ? point : item,
    );
    if (
      drawMode === 'zone' &&
      !isPolygonInsidePolygon(nextCurrent, mainPoints)
    ) {
      showDrawWarning(
        'Ajuste inválido',
        'A zona de exclusao precisa permanecer dentro da area util.',
      );
      return false;
    }
    setCurrentPoints(nextCurrent);
    return true;
  };

  // ── Point insertion ──────────────────────────────────────────────────────

  const updateZoneName = (zoneId: string, newNome: string) => {
    setZones((prev) =>
      prev.map((z) => (z.id === zoneId ? { ...z, nome: newNome } : z)),
    );
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
      prev.map((zoneObj, idx) => {
        if (idx !== zoneIndex || zoneObj.points.length < 2) return zoneObj;
        const pts = zoneObj.points;
        const nextIndex = (pointIndex + 1) % pts.length;
        const nextPoint = midpoint(pts[pointIndex], pts[nextIndex]);
        if (!isPointInsidePolygon(nextPoint, mainPoints)) {
          showDrawWarning(
            'Ponto inválido',
            'Não foi possível inserir ponto médio fora da área útil.',
          );
          return zoneObj;
        }
        return {
          ...zoneObj,
          points: [
            ...pts.slice(0, pointIndex + 1),
            nextPoint,
            ...pts.slice(pointIndex + 1),
          ],
        };
      }),
    );
    setSelectedVertex(null);
  };

  // ── Reset ────────────────────────────────────────────────────────────────

  const resetFromGeometry = (
    points: MapPoint[],
    exclusionZones: ExclusionZone[],
  ) => {
    setMainPoints(points);
    setZones(exclusionZones);
    setSelectedMainPolygon(false);
    setSelectedZoneIndex(null);
    setSelectedVertex(null);
    setDrawMode('none');
    setCurrentPoints([]);
    setMousePos(null);
  };

  return {
    drawMode,
    mainPoints,
    setMainPoints,
    zones,
    setZones,
    currentPoints,
    setCurrentPoints,
    mousePos,
    setMousePos,
    selectedVertex,
    selectedZoneIndex,
    setSelectedZoneIndex,
    selectedMainPolygon,
    statusLabel,
    lastDrawWarningAt,
    showDrawWarning,
    handleStageClick,
    handleMouseMove,
    startMainDrawing,
    startZoneDrawing,
    cancelDrawing,
    finishDrawing,
    handleCloseWithRightClick,
    removeSelectedZone,
    removeMainPolygon,
    clearSelectedVertex,
    toggleMainPolygonSelection,
    toggleZoneSelection,
    selectMainVertex,
    selectZoneVertex,
    removeSelectedVertex,
    removeCurrentSelection,
    moveMainAnchor,
    moveZoneAnchor,
    moveCurrentAnchor,
    insertMainPointAfter,
    insertZonePointAfter,
    updateZoneName,
    resetFromGeometry,
  };
}
