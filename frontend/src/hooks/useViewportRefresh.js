import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Re-measure charts/maps after route changes and viewport/orientation shifts. */
export function useViewportRefresh() {
  const location = useLocation();

  useEffect(() => {
    const refresh = () => window.dispatchEvent(new Event('resize'));
    refresh();
    const raf = requestAnimationFrame(() => requestAnimationFrame(refresh));
    const timer = setTimeout(refresh, 200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [location.pathname]);

  useEffect(() => {
    let timer;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    };
    window.addEventListener('orientationchange', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('orientationchange', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, []);
}
