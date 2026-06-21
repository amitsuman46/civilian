import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import { MaptilerLayer } from '@maptiler/leaflet-maptilersdk';
import {
  MAPTILER_API_KEY,
  getMapTilerPixelRatio,
  getMapTilerStyle,
  isMapTilerConfigured,
} from '../config/maptiler';

function refreshMapTilerRender(layer) {
  const sdkMap = layer?.getMaptilerSDKMap?.();
  if (!sdkMap) return;
  sdkMap.resize();
  sdkMap.triggerRepaint?.();
}

export function refreshMapTilerLayer(layer) {
  refreshMapTilerRender(layer);
}

function bindSharpnessHandlers(layer) {
  const onReady = () => refreshMapTilerRender(layer);
  layer.on?.('ready', onReady);
  const sdkMap = layer.getMaptilerSDKMap?.();
  if (sdkMap) {
    sdkMap.once('load', onReady);
    sdkMap.once('styledata', onReady);
  }
}

export default function MapTilerBasemap({ style = 'normal', onLayerReady }) {
  const map = useMap();
  const layerRef = useRef(null);
  const onLayerReadyRef = useRef(onLayerReady);

  useEffect(() => {
    onLayerReadyRef.current = onLayerReady;
  }, [onLayerReady]);
  const [mapContainer, setMapContainer] = useState(null);

  useEffect(() => {
    setMapContainer(map.getContainer());
  }, [map]);

  useEffect(() => {
    if (!isMapTilerConfigured()) return;

    const mapStyle = getMapTilerStyle(style);
    const pixelRatio = getMapTilerPixelRatio();

    if (!layerRef.current) {
      const layer = new MaptilerLayer({
        apiKey: MAPTILER_API_KEY,
        style: mapStyle,
        pixelRatio,
        updateInterval: 16,
      });
      bindSharpnessHandlers(layer);
      layer.addTo(map);
      layerRef.current = layer;
      onLayerReadyRef.current?.(layer);
      return;
    }

    layerRef.current.setStyle(mapStyle);
    const sdkMap = layerRef.current.getMaptilerSDKMap?.();
    sdkMap?.once('styledata', () => refreshMapTilerRender(layerRef.current));
  }, [map, style]);

  useEffect(() => () => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
  }, [map]);

  if (isMapTilerConfigured() || !mapContainer) return null;

  return createPortal(
    <div className="maptiler-missing-key">
      <i className="fas fa-triangle-exclamation"></i>
      <span>MapTiler API key not configured. Add <code>VITE_MAPTILER_API_KEY</code> to your environment before building.</span>
    </div>,
    mapContainer,
  );
}
