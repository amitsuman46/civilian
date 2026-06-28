export default function DashFilters({ filters, onChange, onClear, hasActive, compact, formations, units, areas, villages }) {
  return (
    <div className={`dash-filters${compact ? ' dash-filters--compact' : ''}`}>
      <div className="dash-filters-fields">
        <label className="dash-filter-field">
          <span className="dash-filter-label"><i className="fas fa-sitemap"></i> Formation</span>
          <select
            value={filters.formation}
            onChange={e => onChange({ ...filters, formation: e.target.value })}
          >
            <option value="">All Formations</option>
            {formations.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className="dash-filter-field">
          <span className="dash-filter-label"><i className="fas fa-people-group"></i> Unit</span>
          <select
            value={filters.unit}
            onChange={e => onChange({ ...filters, unit: e.target.value })}
          >
            <option value="">All Units</option>
            {units.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label className="dash-filter-field">
          <span className="dash-filter-label"><i className="fas fa-shield-halved"></i> Area / Zone</span>
          <select
            value={filters.area}
            onChange={e => onChange({ ...filters, area: e.target.value })}
          >
            <option value="">All Areas</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="dash-filter-field">
          <span className="dash-filter-label"><i className="fas fa-location-dot"></i> Village</span>
          <select
            value={filters.village}
            onChange={e => onChange({ ...filters, village: e.target.value })}
          >
            <option value="">All Villages</option>
            {villages.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>
      {hasActive && (
        <div className="dash-filters-active">
          {filters.formation && (
            <span className="dash-filter-chip">
              <i className="fas fa-sitemap"></i> {filters.formation}
              <button type="button" aria-label="Remove formation filter" onClick={() => onChange({ ...filters, formation: '' })}>×</button>
            </span>
          )}
          {filters.unit && (
            <span className="dash-filter-chip">
              <i className="fas fa-people-group"></i> {filters.unit}
              <button type="button" aria-label="Remove unit filter" onClick={() => onChange({ ...filters, unit: '' })}>×</button>
            </span>
          )}
          {filters.area && (
            <span className="dash-filter-chip">
              <i className="fas fa-shield-halved"></i> {filters.area}
              <button type="button" aria-label="Remove company filter" onClick={() => onChange({ ...filters, area: '' })}>×</button>
            </span>
          )}
          {filters.village && (
            <span className="dash-filter-chip">
              <i className="fas fa-location-dot"></i> {filters.village}
              <button type="button" aria-label="Remove village filter" onClick={() => onChange({ ...filters, village: '' })}>×</button>
            </span>
          )}
          <button type="button" className="dash-filter-clear" onClick={onClear}>
            <i className="fas fa-xmark"></i> Clear all
          </button>
        </div>
      )}
    </div>
  );
}
