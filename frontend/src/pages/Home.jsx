import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import API from '../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const AREAS    = ['Saujiya','Poonch','Rajouri','Mendhar','Krishna Ghati'];
const VILLAGES = [
  'Gagariyan','Barmiya and Doba','Upper Gagariyan','Wazli','kainth',
  'Sawjiya(Maidan)','Sawjiya','Sawjian(Mir Muhallah)','Sawjian(Bandi Muhallah)',
  'Sawjian(Ladhi Muhallah)','Sawjian(Purya Muhallah)','Sawjian(Tantary Muhallah)',
  'Sawjian(Gantar)','Sawjian(Sundri)',
];

const chartFont  = { family: 'Inter, system-ui, sans-serif', size: 11 };
const gridColor  = 'rgba(226,232,240,.8)';
const tickConfig = { font: chartFont, color: '#94a3b8' };
const tooltipDefaults = {
  backgroundColor: '#0f172a',
  titleFont: { ...chartFont, weight: '700' },
  bodyFont: chartFont,
  padding: 10,
  cornerRadius: 6,
};

function buildQuery(filters) {
  const params = new URLSearchParams();
  if (filters.area)    params.set('area', filters.area);
  if (filters.village) params.set('village', filters.village);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function DashFilters({ filters, onChange, onClear, hasActive, compact }) {
  return (
    <div className={`dash-filters${compact ? ' dash-filters--compact' : ''}`}>
      <div className="dash-filters-fields">
        <label className="dash-filter-field">
          <span className="dash-filter-label"><i className="fas fa-shield-halved"></i> Area / Zone</span>
          <select
            value={filters.area}
            onChange={e => onChange({ ...filters, area: e.target.value })}
          >
            <option value="">All Companies</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="dash-filter-field">
          <span className="dash-filter-label"><i className="fas fa-location-dot"></i> Village</span>
          <select
            value={filters.village}
            onChange={e => onChange({ ...filters, village: e.target.value })}
          >
            <option value="">All Villages</option>
            {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>
      {hasActive && (
        <div className="dash-filters-active">
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

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats]         = useState(null);
  const [mapPins, setMapPins]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState({ area: '', village: '' });
  const [stickyVisible, setStickyVisible] = useState(false);
  const [regChartView, setRegChartView]   = useState('daily');

  const filterBarRef = useRef(null);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr  = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  const hasActiveFilters = Boolean(filters.area || filters.village);

  const fetchDashboard = useCallback(async (activeFilters) => {
    setLoading(true);
    const qs = buildQuery(activeFilters);
    try {
      const [statsData, pinsData] = await Promise.all([
        API.get(`/api/stats${qs}`),
        API.get(`/api/civilians/map-pins${qs}`),
      ]);
      if (statsData.success) setStats(statsData);
      if (pinsData.success)  setMapPins(pinsData.pins);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(filters); }, [filters, fetchDashboard]);

  useEffect(() => {
    const el = filterBarRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-66px 0px 0px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleFilterChange = next => setFilters(next);
  const clearFilters = () => setFilters({ area: '', village: '' });

  const total = stats?.kpi?.total ?? 0;
  const today = stats?.kpi?.today ?? 0;
  const week  = stats?.kpi?.week  ?? 0;
  const month = stats?.kpi?.month ?? 0;

  const dayChartData = {
    labels: stats?.daily?.map(d => d.label) || [],
    datasets: [{
      label: 'Records Added',
      data: stats?.daily?.map(d => d.count) || [],
      borderColor: '#1d4ed8',
      backgroundColor: 'rgba(29,78,216,.08)',
      borderWidth: 2,
      fill: true,
      tension: .4,
      pointBackgroundColor: '#1d4ed8',
      pointRadius: 3,
      pointHoverRadius: 5,
    }],
  };

  const monthChartData = {
    labels: stats?.monthly?.map(d => d.label) || [],
    datasets: [{
      label: 'Records Added',
      data: stats?.monthly?.map(d => d.count) || [],
      backgroundColor: 'rgba(29,78,216,.75)',
      hoverBackgroundColor: '#1d4ed8',
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const palette = ['#1d4ed8','#0891b2','#059669','#d97706','#7c3aed','#e53935','#0f766e'];
  const areaChartData = {
    labels: stats?.area?.map(d => d.label) || [],
    datasets: [{
      label: 'Records',
      data: stats?.area?.map(d => d.count) || [],
      backgroundColor: (stats?.area || []).map((_, i) => palette[i % palette.length]),
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const villages = stats?.village || [];
  const shorten  = s => s.length > 24 ? s.slice(0, 22) + '…' : s;
  const villBg   = villages.map((_, i) => `hsla(${210 + i * 11},65%,48%,.85)`);
  const villHov  = villages.map((_, i) => `hsl(${210 + i * 11},65%,38%)`);
  const villageChartData = {
    labels: villages.map(d => shorten(d.label)),
    datasets: [{
      label: 'Records',
      data: villages.map(d => d.count),
      backgroundColor: villBg,
      hoverBackgroundColor: villHov,
      borderRadius: 4,
      borderSkipped: false,
    }],
  };

  const lineOpts = {
    responsive: true, maintainAspectRatio: true,
    plugins: { legend: { labels: { font: chartFont, color:'#64748b', boxWidth:10, padding:14 } }, tooltip: tooltipDefaults },
    scales: {
      x: { grid:{ color: gridColor }, ticks:{ ...tickConfig, maxTicksLimit: 8 } },
      y: { grid:{ color: gridColor }, ticks:{ ...tickConfig, stepSize: 1 }, beginAtZero: true },
    },
  };

  const barOpts = {
    responsive: true, maintainAspectRatio: true,
    plugins: { legend: { labels: { font: chartFont, color:'#64748b', boxWidth:10, padding:14 } }, tooltip: tooltipDefaults },
    scales: {
      x: { grid:{ display: false }, ticks: tickConfig },
      y: { grid:{ color: gridColor }, ticks:{ ...tickConfig, stepSize: 1 }, beginAtZero: true },
    },
  };

  const areaOpts = { ...barOpts, plugins: { ...barOpts.plugins, legend: { display: false } } };

  const villageOpts = {
    ...barOpts,
    indexAxis: 'y',
    scales: {
      x: { grid:{ color: gridColor }, ticks:{ ...tickConfig, stepSize:1, precision:0 }, beginAtZero: true },
      y: { grid:{ display: false }, ticks:{ ...tickConfig, font:{ ...chartFont, size:10 } } },
    },
    plugins: {
      ...barOpts.plugins,
      tooltip: {
        ...tooltipDefaults,
        callbacks: { title: items => villages[items[0].dataIndex]?.label || items[0].label },
      },
    },
  };

  const filterBadge = hasActiveFilters
    ? [filters.area, filters.village].filter(Boolean).join(' · ')
    : 'All records';

  return (
    <>
      {/* Sticky filter banner — appears after scrolling past the main filter bar */}
      <div className={`dash-filters-sticky${stickyVisible ? ' is-visible' : ''}`} aria-hidden={!stickyVisible}>
        <div className="dash-filters-sticky-inner container">
          <div className="dash-filters-sticky-left">
            <i className="fas fa-filter"></i>
            <span className="dash-filters-sticky-title">Dashboard Filters</span>
            {hasActiveFilters ? (
              <div className="dash-filters-sticky-chips">
                {filters.area && (
                  <span className="dash-filter-chip dash-filter-chip--sticky">
                    <i className="fas fa-shield-halved"></i> {filters.area}
                  </span>
                )}
                {filters.village && (
                  <span className="dash-filter-chip dash-filter-chip--sticky">
                    <i className="fas fa-location-dot"></i> {filters.village}
                  </span>
                )}
              </div>
            ) : (
              <span className="dash-filters-sticky-hint">No filters applied</span>
            )}
          </div>
          <div className="dash-filters-sticky-right">
            <DashFilters
              compact
              filters={filters}
              onChange={handleFilterChange}
              onClear={clearFilters}
              hasActive={hasActiveFilters}
            />
            {hasActiveFilters && (
              <button type="button" className="dash-filter-clear dash-filter-clear--sticky" onClick={clearFilters}>
                <i className="fas fa-xmark"></i> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Welcome Banner */}
      <div className="dash-welcome">
        <div className="dash-welcome-text">
          <div className="dash-greeting"><i className="fas fa-shield-halved"></i> &nbsp;Civilian DBMS</div>
          <div className="dash-name">{greeting}, {user?.user_name}</div>
          <div className="dash-date">
            <i className="fas fa-calendar-days"></i>
            {dateStr}
            &nbsp;·&nbsp;
            <i className="fas fa-database"></i>
            {total.toLocaleString()} record{total !== 1 ? 's' : ''} on file
            {hasActiveFilters && (
              <span className="dash-filtered-indicator"> &nbsp;·&nbsp; filtered</span>
            )}
          </div>
        </div>
        <div className="dash-welcome-actions">
          <Link to="/dashboard/add" className="btn-white-solid">
            <i className="fas fa-plus"></i> Add Record
          </Link>
          <Link to="/dashboard/view" className="btn-white">
            <i className="fas fa-table-list"></i> Browse
          </Link>
        </div>
      </div>

      {/* Global Filters */}
      <div className="dash-filters-card" ref={filterBarRef}>
        <div className="dash-filters-card-header">
          <div className="dash-filters-card-title">
            <i className="fas fa-filter"></i> Global Filters
          </div>
          <span className="dash-chart-badge">{filterBadge}</span>
        </div>
        <DashFilters
          filters={filters}
          onChange={handleFilterChange}
          onClear={clearFilters}
          hasActive={hasActiveFilters}
        />
      </div>

      {/* KPI Cards */}
      <div className={`kpi-grid${loading ? ' dash-loading' : ''}`}>
        {[
          { color:'blue',   icon:'fa-users',         value: total, label: 'Total Records' },
          { color:'green',  icon:'fa-user-plus',      value: today, label: 'Added Today' },
          { color:'orange', icon:'fa-calendar-week',  value: week,  label: 'This Week' },
          { color:'purple', icon:'fa-calendar-days',  value: month, label: 'This Month' },
        ].map(({ color, icon, value, label }) => (
          <div key={label} className={`kpi-card ${color}`}>
            <div className={`kpi-icon-wrap ${color}`}><i className={`fas ${icon}`}></i></div>
            <div className="kpi-body">
              <div className="kpi-value">{value.toLocaleString()}</div>
              <div className="kpi-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Registrations — daily / monthly toggle */}
      <div className="dash-chart-card dash-reg-chart-card">
        <div className="dash-chart-header">
          <div className="dash-chart-title">
            <i className={`fas ${regChartView === 'daily' ? 'fa-chart-line' : 'fa-chart-bar'}`}></i>
            Registrations
            <span className="dash-reg-period" role="group" aria-label="Registration chart period">
              <button
                type="button"
                className={`dash-reg-period-btn${regChartView === 'daily' ? ' is-active' : ''}`}
                onClick={() => setRegChartView('daily')}
              >
                Daily
              </button>
              <span className="dash-reg-period-sep" aria-hidden="true">|</span>
              <button
                type="button"
                className={`dash-reg-period-btn${regChartView === 'monthly' ? ' is-active' : ''}`}
                onClick={() => setRegChartView('monthly')}
              >
                Monthly
              </button>
            </span>
          </div>
          <span className="dash-chart-badge">
            {regChartView === 'daily' ? 'Last 30 days' : 'Last 6 months'}
          </span>
        </div>
        {stats && (
          regChartView === 'daily'
            ? <Line key="daily" data={dayChartData} options={lineOpts} />
            : <Bar key="monthly" data={monthChartData} options={barOpts} />
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="dash-charts-row two">
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div className="dash-chart-title"><i className="fas fa-chart-simple"></i> Village-wise Distribution</div>
            <span className="dash-chart-badge">{hasActiveFilters ? 'Filtered' : 'All villages'}</span>
          </div>
          {stats && <Bar data={villageChartData} options={villageOpts} style={{ maxHeight: '360px' }} />}
        </div>
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div className="dash-chart-title"><i className="fas fa-shield-halved"></i> Company-wise Breakdown</div>
            <span className="dash-chart-badge">{hasActiveFilters ? 'Filtered' : 'All Coys'}</span>
          </div>
          {stats && <Bar data={areaChartData} options={areaOpts} style={{ maxHeight: '360px' }} />}
        </div>
      </div>

      {/* Civilian Locations Map */}
      <div className="dash-chart-card" style={{ marginBottom: '1rem' }}>
        <div className="dash-chart-header">
          <div className="dash-chart-title"><i className="fas fa-map-location-dot"></i> Civilian Locations</div>
          <span className="dash-chart-badge">{mapPins.length} pinned{hasActiveFilters ? ' (filtered)' : ''}</span>
        </div>

        {mapPins.length === 0 ? (
          <div className="dash-map-empty">
            <i className="fas fa-map-pin"></i>
            <span>
              {hasActiveFilters
                ? <>No pinned records match the current filters.</>
                : <>No pinned records yet. Use the map picker when adding a record.</>}
            </span>
          </div>
        ) : (
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{ height: '380px', width: '100%', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
            />
            {mapPins.map(pin => (
              <Marker key={pin.id} position={[pin.lat, pin.lng]}>
                <Popup>
                  <div style={{ lineHeight: 1.7, minWidth: '130px' }}>
                    <strong>{pin.name}</strong><br />
                    {pin.house_no && <span style={{ fontSize: '.8rem', color: '#555' }}>H/No {pin.house_no}</span>}<br />
                    {pin.area && <span style={{ fontSize: '.8rem', color: '#888' }}>{pin.area}</span>}<br />
                    <Link to={`/dashboard/report/${pin.id}`} style={{ fontSize: '.8rem', color: '#1d4ed8' }}>
                      View Report →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </>
  );
}
