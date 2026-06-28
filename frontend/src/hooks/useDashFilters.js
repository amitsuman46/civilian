import { useEffect, useState } from 'react';
import API from '../api';
import { EMPTY_FILTERS } from '../utils/dashFilters';

export function useDashFilters() {
  const [filters, setFilters]         = useState(EMPTY_FILTERS);
  const [pairs, setPairs]           = useState([]);
  const [formations, setFormations] = useState([]);
  const [units, setUnits]           = useState([]);
  const [areas, setAreas]           = useState([]);
  const [villages, setVillages]     = useState([]);

  const hasActiveFilters = Boolean(filters.area || filters.village || filters.formation || filters.unit);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.formation) params.set('formation', filters.formation);
    if (filters.unit) params.set('unit', filters.unit);
    const qs = params.toString();

    API.get(`/api/filter-options${qs ? `?${qs}` : ''}`).then(data => {
      if (data.success) {
        setPairs(data.pairs || []);
        setFormations(data.formations || []);
        setUnits(data.units || []);
        if (!filters.formation && !filters.unit) {
          setAreas(data.areas || []);
          setVillages(data.villages || []);
        }
      }
    });
  }, [filters.formation, filters.unit]);

  const handleFilterChange = next => {
    if (next.formation !== filters.formation && next.unit) {
      const valid = pairs.some(p => p.formation === next.formation && p.unit === next.unit);
      if (!valid) next = { ...next, unit: '' };
    }
    if (next.unit !== filters.unit && next.formation) {
      const valid = pairs.some(p => p.formation === next.formation && p.unit === next.unit);
      if (!valid) next = { ...next, formation: '' };
    }
    setFilters(next);
  };

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const filterBadge = hasActiveFilters
    ? [filters.formation, filters.unit, filters.area, filters.village].filter(Boolean).join(' · ')
    : 'All records';

  return {
    filters,
    formations,
    units,
    areas,
    villages,
    hasActiveFilters,
    handleFilterChange,
    clearFilters,
    filterBadge,
  };
}
