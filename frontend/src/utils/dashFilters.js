export const EMPTY_FILTERS = { area: '', village: '', formation: '', unit: '' };

export function buildQuery(filters) {
  const params = new URLSearchParams();
  if (filters.area)      params.set('area', filters.area);
  if (filters.village)   params.set('village', filters.village);
  if (filters.formation) params.set('formation', filters.formation);
  if (filters.unit)      params.set('unit', filters.unit);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function appendFilterParams(baseParams, filters) {
  if (filters.area)      baseParams.set('area', filters.area);
  if (filters.village)   baseParams.set('village', filters.village);
  if (filters.formation) baseParams.set('formation', filters.formation);
  if (filters.unit)      baseParams.set('unit', filters.unit);
  return baseParams;
}
