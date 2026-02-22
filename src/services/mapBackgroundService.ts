import { lookupAddressByCep, normalizeCep } from './cepService';

export type GeoPoint = {
  lat: number;
  lon: number;
};

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const REQUEST_TIMEOUT_MS = 12_000;

function isFiniteInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function toFloat(value: string): number {
  return Number.parseFloat(value.replace(',', '.').trim());
}

function parseCoordinatePair(rawLat: string, rawLon: string): GeoPoint | null {
  const lat = toFloat(rawLat);
  const lon = toFloat(rawLon);
  if (!isFiniteInRange(lat, -90, 90) || !isFiniteInRange(lon, -180, 180)) {
    return null;
  }
  return { lat, lon };
}

export function parseCoordinatesInput(input: string): GeoPoint | null {
  const value = input.trim();
  if (!value) return null;

  // Permite decimal com virgula usando separador ';' ou '/' entre latitude e longitude.
  const altSeparator = value.match(
    /^\s*(-?\d+(?:[.,]\d+)?)\s*[;\/]\s*(-?\d+(?:[.,]\d+)?)\s*$/,
  );
  if (altSeparator) {
    return parseCoordinatePair(altSeparator[1], altSeparator[2]);
  }

  // Formatos mais comuns com decimal em ponto: "lat,lon" ou "lat lon".
  const commaSeparator = value.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/,
  );
  if (commaSeparator) {
    return parseCoordinatePair(commaSeparator[1], commaSeparator[2]);
  }

  const spaceSeparator = value.match(
    /^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/,
  );
  if (spaceSeparator) {
    return parseCoordinatePair(spaceSeparator[1], spaceSeparator[2]);
  }

  return null;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function geocodeText(query: string): Promise<GeoPoint | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'br',
    q: trimmed,
  });

  const response = await fetchWithTimeout(`${NOMINATIM_SEARCH_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Geocodificacao indisponivel (status ${response.status}).`);
  }

  const rows = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const row = rows[0];
  const lat = Number.parseFloat(row.lat ?? '');
  const lon = Number.parseFloat(row.lon ?? '');
  if (!isFiniteInRange(lat, -90, 90) || !isFiniteInRange(lon, -180, 180)) return null;
  return { lat, lon };
}

export async function resolveGeoPointFromInput(input: string): Promise<GeoPoint | null> {
  const coordinates = parseCoordinatesInput(input);
  if (coordinates) return coordinates;

  const cepDigits = normalizeCep(input);
  if (cepDigits.length === 8) {
    const address = await lookupAddressByCep(cepDigits);
    if (!address) return null;
    const query = [
      address.street,
      address.neighborhood,
      address.city,
      address.uf,
      'Brasil',
    ]
      .filter((part) => part && part.trim().length > 0)
      .join(', ');
    return geocodeText(query);
  }

  return geocodeText(input);
}

export function buildOsmStaticMapUrl(
  point: GeoPoint,
  options?: {
    zoom?: number;
    width?: number;
    height?: number;
  },
): string {
  const zoom = Math.max(3, Math.min(19, Math.round(options?.zoom ?? 16)));
  const width = Math.max(300, Math.min(1200, Math.round(options?.width ?? 900)));
  const height = Math.max(220, Math.min(1200, Math.round(options?.height ?? 440)));

  const params = new URLSearchParams({
    center: `${point.lat},${point.lon}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    maptype: 'mapnik',
    markers: `${point.lat},${point.lon},lightblue1`,
  });
  return `https://staticmap.openstreetmap.de/staticmap.php?${params.toString()}`;
}
