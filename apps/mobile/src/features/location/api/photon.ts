import Constants from 'expo-constants';

type GeocodingConfig = {
  baseUrl: string;
  apiKey?: string | null;
  timeout?: number;
  retry?: {
    maxRetries: number;
    fallbackUrl?: string | null;
  };
};

const DEFAULT_PHOTON_URL = 'https://photon.komoot.io';

const getGeocodingConfig = (): GeocodingConfig => {
  const extra = Constants.expoConfig?.extra as { geocoding?: GeocodingConfig } | undefined;
  return {
    baseUrl: extra?.geocoding?.baseUrl || DEFAULT_PHOTON_URL,
    apiKey: extra?.geocoding?.apiKey,
    timeout: extra?.geocoding?.timeout || 5000,
    retry: extra?.geocoding?.retry,
  };
};

const CONFIG = getGeocodingConfig();
const PHOTON_BASE_URL = CONFIG.baseUrl.replace(/\/+$/, '');

interface PhotonProperties {
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  state?: string;
  country?: string;
  osm_id?: number | string;
  osm_type?: string;
}

interface PhotonFeature {
  properties?: PhotonProperties;
  geometry?: {
    // Photon can return Point, LineString, Polygon, etc.
    // We only consume Point features; others are skipped.
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

export interface PhotonSearchResult {
  id: string;
  label: string;
  subtitle: string;
  latitude: number;
  longitude: number;
}

export interface PhotonSearchOptions {
  limit?: number;
  lang?: string;
  lat?: number;
  lon?: number;
  signal?: AbortSignal;
}

const formatPhotonResult = (
  feature: PhotonFeature,
  index: number,
): PhotonSearchResult | null => {
  const properties = feature.properties;
  const geometry = feature.geometry;

  // Only accept Point geometries — LineString / Polygon coordinates are
  // nested arrays and cannot be used as [lon, lat] pairs.  Passing them
  // to MapLibre as point coordinates causes the "Invalid geometry in line
  // layer" warning.
  if (!properties || geometry?.type !== 'Point') {
    return null;
  }

  const coords = geometry.coordinates as number[];
  if (coords.length < 2) {
    return null;
  }

  const streetLine = [properties.street, properties.housenumber]
    .filter(Boolean)
    .join(' ')
    .trim();

  const label =
    properties.name ||
    streetLine ||
    properties.city ||
    properties.state ||
    properties.country ||
    'Unknown location';

  const subtitleParts = [
    properties.name && streetLine && properties.name !== streetLine
      ? streetLine
      : null,
    properties.postcode,
    properties.city,
    properties.state,
    properties.country,
  ].filter(Boolean) as string[];

  const subtitle = subtitleParts.join(', ');

  // Use a stable, index-based fallback instead of Date.now() so that all
  // items in the same synchronous .map() call get *different* keys.
  // Append the index as a suffix even for real osm_ids to guard against
  // the rare case where the API returns the same osm_id twice.
  const baseId = properties.osm_id
    ? `${properties.osm_type || 'osm'}-${properties.osm_id}`
    : `photon-${index}`;
  const id = `${baseId}-${index}`;

  const [longitude, latitude] = coords; // Photon returns [lon, lat].

  return {
    id,
    label,
    subtitle,
    latitude,
    longitude,
  };
};

export async function searchPhoton(
  query: string,
  options: PhotonSearchOptions = {},
): Promise<PhotonSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
    limit: String(options.limit ?? 6),
  });

  if (options.lang) {
    params.set('lang', options.lang);
  }

  if (options.lat !== undefined && options.lon !== undefined) {
    params.set('lat', String(options.lat));
    params.set('lon', String(options.lon));
  }

  const url = `${PHOTON_BASE_URL}/api?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
  
  try {
    const response = await fetch(url, { 
      signal: options.signal || controller.signal 
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Photon search failed (${response.status})`);
    }

    const data = (await response.json()) as PhotonResponse;
    const results = data.features?.map(formatPhotonResult).filter(Boolean) || [];
    return results as PhotonSearchResult[];
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Geocoding request timed out after ${CONFIG.timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
