import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/** Leaflet + MapTiler need invalidateSize after layout/viewport changes. */
export default function MapResize({ onResize }) {
  const map = useMap();

  useEffect(() => {
    const refresh = () => {
      map.invalidateSize({ animate: false });
      onResize?.();
    };
    refresh();
    const t1 = setTimeout(refresh, 100);
    const t2 = setTimeout(refresh, 400);
    const t3 = setTimeout(refresh, 800);
    window.addEventListener('resize', refresh);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', refresh);
    };
  }, [map, onResize]);

  return null;
}
