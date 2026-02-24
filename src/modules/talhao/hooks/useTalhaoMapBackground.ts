/**
 * Hook que gerencia o estado e lógica do fundo de mapa real do croqui.
 *
 * Responsabilidades:
 * - Busca de CEP/coordenadas para posicionar o mapa
 * - Estado de camadas (satellite, streets, topographic)
 * - Modo interativo (pan/zoom do mapa)
 * - Conversão de coordenadas geográficas em pontos do croqui
 */

import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  resolveGeoPointFromInput,
  parseCoordinatesInput,
  type GeoPoint,
} from '../../../services/mapBackgroundService';
import type { GeoLayerId } from '../../../modules/geo/baseLayers';
import type { MapPoint } from '../../../services/propertyMapService';
import type { DrawMode } from '../types';
import { normalizeGeoLayerId } from '../utils/formatters';
import {
  geoPointToCanvasPoint,
  isPointInsidePolygon,
  isSegmentInsidePolygon,
} from '../utils/geometry';

export interface UseTalhaoMapBackgroundReturn {
  mapSearchValue: string;
  setMapSearchValue: React.Dispatch<React.SetStateAction<string>>;
  mapSearchLoading: boolean;
  mapCenter: GeoPoint | null;
  setMapCenter: React.Dispatch<React.SetStateAction<GeoPoint | null>>;
  mapZoom: number;
  setMapZoom: React.Dispatch<React.SetStateAction<number>>;
  mapLayerId: GeoLayerId;
  setMapLayerId: React.Dispatch<React.SetStateAction<GeoLayerId>>;
  mapInteractive: boolean;
  setMapInteractive: React.Dispatch<React.SetStateAction<boolean>>;
  pointSearchValue: string;
  setPointSearchValue: React.Dispatch<React.SetStateAction<string>>;
  mapHasRealBackground: boolean;

  applyRealMapBackground: () => Promise<void>;
  clearRealMapBackground: () => void;
  handleRealMapViewChange: (next: { center: GeoPoint; zoom: number }) => void;
  addPointFromCoordinates: (params: {
    drawMode: DrawMode;
    mainPoints: MapPoint[];
    currentPoints: MapPoint[];
    stageWidth: number;
    setCurrentPoints: React.Dispatch<React.SetStateAction<MapPoint[]>>;
    setMousePos: React.Dispatch<React.SetStateAction<MapPoint | null>>;
    showDrawWarning: (title: string, message: string) => void;
  }) => void;

  /** Reinicializa o estado a partir da geometria persistida. */
  resetFromGeometry: (
    mapReference: {
      center?: { lat: number; lon: number };
      zoom?: number;
      layerId?: string;
    } | null,
  ) => void;
}

export function useTalhaoMapBackground(): UseTalhaoMapBackgroundReturn {
  const [mapSearchValue, setMapSearchValue] = useState('');
  const [mapSearchLoading, setMapSearchLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState<GeoPoint | null>(null);
  const [mapZoom, setMapZoom] = useState(16);
  const [mapLayerId, setMapLayerId] = useState<GeoLayerId>('satellite');
  const [mapInteractive, setMapInteractive] = useState(false);
  const [pointSearchValue, setPointSearchValue] = useState('');

  const mapHasRealBackground = Boolean(mapCenter);

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
        message:
          error?.message ?? 'Não foi possível obter o mapa de referencia real.',
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

  const handleRealMapViewChange = (next: {
    center: GeoPoint;
    zoom: number;
  }) => {
    setMapCenter(next.center);
    setMapZoom(next.zoom);
  };

  const addPointFromCoordinates = ({
    drawMode,
    mainPoints,
    currentPoints,
    stageWidth,
    setCurrentPoints,
    setMousePos,
    showDrawWarning,
  }: {
    drawMode: DrawMode;
    mainPoints: MapPoint[];
    currentPoints: MapPoint[];
    stageWidth: number;
    setCurrentPoints: React.Dispatch<React.SetStateAction<MapPoint[]>>;
    setMousePos: React.Dispatch<React.SetStateAction<MapPoint | null>>;
    showDrawWarning: (title: string, message: string) => void;
  }) => {
    const rawValue = pointSearchValue.trim();
    if (!rawValue) {
      notifications.show({
        title: 'Informe coordenadas',
        message:
          'Digite latitude e longitude no formato: -23.55052, -46.63331.',
        color: 'yellow',
      });
      return;
    }

    if (drawMode === 'none') {
      notifications.show({
        title: 'Inicie o desenho',
        message:
          'Ative o desenho do limite ou da zona para inserir pontos por coordenada.',
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
        message:
          'Aplique um mapa real para converter coordenadas em pontos do croqui.',
        color: 'yellow',
      });
      return;
    }

    const geoPoint = parseCoordinatesInput(rawValue);
    if (!geoPoint) {
      notifications.show({
        title: 'Formato inválido',
        message:
          'Use o formato latitude, longitude. Ex.: -23.55052, -46.63331.',
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

  const resetFromGeometry = (
    mapReference: {
      center?: { lat: number; lon: number };
      zoom?: number;
      layerId?: string;
    } | null,
  ) => {
    setMapSearchValue('');
    if (mapReference?.center) {
      setMapCenter({
        lat: mapReference.center.lat,
        lon: mapReference.center.lon,
      });
      setMapZoom(
        Math.max(3, Math.min(19, Math.round(mapReference.zoom ?? 16))),
      );
      setMapLayerId(normalizeGeoLayerId(mapReference.layerId));
    } else {
      setMapCenter(null);
      setMapZoom(16);
      setMapLayerId('satellite');
    }
    setMapInteractive(false);
    setMapSearchLoading(false);
    setPointSearchValue('');
  };

  return {
    mapSearchValue,
    setMapSearchValue,
    mapSearchLoading,
    mapCenter,
    setMapCenter,
    mapZoom,
    setMapZoom,
    mapLayerId,
    setMapLayerId,
    mapInteractive,
    setMapInteractive,
    pointSearchValue,
    setPointSearchValue,
    mapHasRealBackground,
    applyRealMapBackground,
    clearRealMapBackground,
    handleRealMapViewChange,
    addPointFromCoordinates,
    resetFromGeometry,
  };
}
