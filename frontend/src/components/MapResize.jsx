import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/** Leaflet needs invalidateSize after layout/viewport changes. */
export default function MapResize() {
  const map = useMap();

  useEffect(() => {
    const refresh = () => map.invalidateSize({ animate: false });
    refresh();
    const t1 = setTimeout(refresh, 100);
    const t2 = setTimeout(refresh, 400);
    window.addEventListener('resize', refresh);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', refresh);
    };
  }, [map]);

  return null;
}
