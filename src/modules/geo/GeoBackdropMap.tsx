import { memo, useEffect } from 'react';
import { CircleMarker } from 'react-leaflet';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getGeoLayerById, type GeoLayerId } from './baseLayers';
import type { GeoPoint } from '../../services/mapBackgroundService';

type GeoBackdropMapProps = {
  center: GeoPoint;
  zoom: number;
  layerId: GeoLayerId;
  interactive?: boolean;
  onViewChange?: (next: { center: GeoPoint; zoom: number }) => void;
};

function ViewSync(props: {
  center: GeoPoint;
  zoom: number;
  onViewChange?: (next: { center: GeoPoint; zoom: number }) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const current = map.getCenter();
    const currentZoom = map.getZoom();
    const centerChanged =
      Math.abs(current.lat - props.center.lat) > 0.000001 ||
      Math.abs(current.lng - props.center.lon) > 0.000001;
    const zoomChanged = currentZoom !== props.zoom;
    if (centerChanged || zoomChanged) {
      map.setView([props.center.lat, props.center.lon], props.zoom, {
        animate: false,
      });
    }
  }, [map, props.center.lat, props.center.lon, props.zoom]);

  useMapEvents({
    moveend: () => {
      if (!props.onViewChange) return;
      const center = map.getCenter();
      props.onViewChange({
        center: { lat: center.lat, lon: center.lng },
        zoom: map.getZoom(),
      });
    },
    zoomend: () => {
      if (!props.onViewChange) return;
      const center = map.getCenter();
      props.onViewChange({
        center: { lat: center.lat, lon: center.lng },
        zoom: map.getZoom(),
      });
    },
  });

  return null;
}

function InteractionSync(props: { interactive: boolean }) {
  const map = useMap();

  useEffect(() => {
    const handlers = [
      map.dragging,
      map.scrollWheelZoom,
      map.doubleClickZoom,
      map.touchZoom,
      map.keyboard,
      map.boxZoom,
    ];

    handlers.forEach((handler) => {
      if (!handler) return;
      if (props.interactive) {
        handler.enable();
      } else {
        handler.disable();
      }
    });

    map.getContainer().style.cursor = props.interactive ? 'grab' : 'default';
  }, [map, props.interactive]);

  return null;
}

function GeoBackdropMapComponent({
  center,
  zoom,
  layerId,
  interactive = true,
  onViewChange,
}: GeoBackdropMapProps) {
  const layer = getGeoLayerById(layerId);

  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={zoom}
      style={{ width: '100%', height: '100%' }}
      zoomControl
      dragging
      scrollWheelZoom
      doubleClickZoom
      touchZoom
      keyboard
      boxZoom
      attributionControl
      preferCanvas
    >
      <TileLayer
        url={layer.url}
        attribution={layer.attribution}
        maxZoom={layer.maxZoom}
      />
      <CircleMarker
        center={[center.lat, center.lon]}
        radius={6}
        pathOptions={{
          color: '#0f172a',
          weight: 2,
          fillColor: '#38bdf8',
          fillOpacity: 0.65,
        }}
      />
      <ViewSync center={center} zoom={zoom} onViewChange={onViewChange} />
      <InteractionSync interactive={interactive} />
    </MapContainer>
  );
}

export const GeoBackdropMap = memo(GeoBackdropMapComponent);
