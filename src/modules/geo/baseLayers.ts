export type GeoLayerId = 'satellite' | 'streets' | 'topographic';

export type GeoBaseLayer = {
  id: GeoLayerId;
  label: string;
  url: string;
  attribution: string;
  maxZoom?: number;
};

export const GEO_BASE_LAYERS: GeoBaseLayer[] = [
  {
    id: 'satellite',
    label: 'Satelite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  {
    id: 'streets',
    label: 'Ruas',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  {
    id: 'topographic',
    label: 'Topografico',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap contributors',
    maxZoom: 17,
  },
];

export function getGeoLayerById(layerId: GeoLayerId): GeoBaseLayer {
  return GEO_BASE_LAYERS.find((layer) => layer.id === layerId) ?? GEO_BASE_LAYERS[0];
}
