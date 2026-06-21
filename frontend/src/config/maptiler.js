import { MapStyle } from '@maptiler/leaflet-maptilersdk';

export const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY || '';

/** Newer MapTiler styles — sharper imagery than default v2 presets */
export const MAPTILER_STYLE_NORMAL = MapStyle.STREETS;
export const MAPTILER_STYLE_SATELLITE = 'hybrid-v4';

export const MAP_MAX_ZOOM = 22;
export const MAP_PIN_ZOOM = 19;
export const DEFAULT_MAP_STYLE = 'satellite';

export function getMapTilerPixelRatio() {
  if (typeof window === 'undefined') return 2;
  return Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
}

export function isMapTilerConfigured() {
  return Boolean(MAPTILER_API_KEY.trim());
}

export function getMapTilerStyle(mode) {
  return mode === 'satellite' ? MAPTILER_STYLE_SATELLITE : MAPTILER_STYLE_NORMAL;
}
