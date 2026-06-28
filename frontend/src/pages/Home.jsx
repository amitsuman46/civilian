import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup } from 'react-leaflet';
import MapResize from '../components/MapResize';
import MapTilerBasemap, { refreshMapTilerLayer } from '../components/MapTilerBasemap';
import MapStyleToggle from '../components/MapStyleToggle';
import { MAP_MAX_ZOOM, DEFAULT_MAP_STYLE } from '../config/maptiler';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement,
  Title, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import DashFilters from '../components/DashFilters';
import { useDashFilters } from '../hooks/useDashFilters';
import { buildQuery } from '../utils/dashFilters';

/** Default map viewport — northern India / Jammu & Kashmir (pan & zoom unrestricted) */
const MAP_DEFAULT_CENTER = [33.0, 75.5];
const MAP_DEFAULT_ZOOM   = 6;

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats]         = useState(null);
  const [mapPins, setMapPins]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const {
    filters,
    formations,
    units,
    areas,
    villages,
    hasActiveFilters,
    handleFilterChange,
    clearFilters,
    filterBadge,
  } = useDashFilters();
  const [mapStyle, setMapStyle]     = useState(DEFAULT_MAP_STYLE);
  const [stickyVisible, setStickyVisible] = useState(false);

  const filterBarRef = useRef(null);
  const mapLayerRef = useRef(null);

  const refreshDashboardMap = useCallback(() => {
    if (mapLayerRef.current) refreshMapTilerLayer(mapLayerRef.current);
  }, []);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr  = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

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

    const navOffset = () => {
      const h = document.getElementById('mainNav')?.offsetHeight ?? 66;
      return `-${h}px 0px 0px 0px`;
    };

    let observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: navOffset() },
    );
    observer.observe(el);

    const onResize = () => {
      observer.disconnect();
      observer = new IntersectionObserver(
        ([entry]) => setStickyVisible(!entry.isIntersecting),
        { threshold: 0, rootMargin: navOffset() },
      );
      observer.observe(el);
    };
    window.addEventListener('resize', onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const total = stats?.kpi?.total ?? 0;
  const today = stats?.kpi?.today ?? 0;
  const week  = stats?.kpi?.week  ?? 0;
  const month = stats?.kpi?.month ?? 0;

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

  const villageStats = stats?.village || [];
  const shorten  = s => s.length > 24 ? s.slice(0, 22) + '…' : s;
  const villBg   = villageStats.map((_, i) => `hsla(${210 + i * 11},65%,48%,.85)`);
  const villHov  = villageStats.map((_, i) => `hsl(${210 + i * 11},65%,38%)`);
  const villageChartData = {
    labels: villageStats.map(d => shorten(d.label)),
    datasets: [{
      label: 'Records',
      data: villageStats.map(d => d.count),
      backgroundColor: villBg,
      hoverBackgroundColor: villHov,
      borderRadius: 4,
      borderSkipped: false,
    }],
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
        callbacks: { title: items => villageStats[items[0].dataIndex]?.label || items[0].label },
      },
    },
  };

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
                {filters.formation && (
                  <span className="dash-filter-chip dash-filter-chip--sticky">
                    <i className="fas fa-sitemap"></i> {filters.formation}
                  </span>
                )}
                {filters.unit && (
                  <span className="dash-filter-chip dash-filter-chip--sticky">
                    <i className="fas fa-people-group"></i> {filters.unit}
                  </span>
                )}
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
              formations={formations}
              units={units}
              areas={areas}
              villages={villages}
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
        <div className="dash-welcome-flag" aria-hidden="true">
          <img src="/images/flag-india.png" alt="" draggable="false" />
        </div>
        <div className="dash-welcome-text">
          <div className="dash-greeting"><i className="fas fa-shield-halved"></i> &nbsp;Digital Demographic Profiling</div>
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
          formations={formations}
          units={units}
          areas={areas}
          villages={villages}
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

      {/* Charts Row */}
      <div className="dash-charts-row two">
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div className="dash-chart-title"><i className="fas fa-chart-simple"></i> Village-wise Distribution</div>
            <span className="dash-chart-badge">
              {hasActiveFilters ? 'Filtered' : `${villageStats.length} with records`}
            </span>
          </div>
          {stats && villageStats.length > 0 ? (
            <Bar data={villageChartData} options={villageOpts} style={{ maxHeight: '360px' }} />
          ) : stats ? (
            <div className="dash-map-empty">
              <i className="fas fa-chart-simple"></i>
              <span>No village data in the current selection.</span>
            </div>
          ) : null}
        </div>
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div className="dash-chart-title"><i className="fas fa-shield-halved"></i> Area-wise Distribution</div>
            <span className="dash-chart-badge">
              {hasActiveFilters ? 'Filtered' : `${(stats?.area || []).length} with records`}
            </span>
          </div>
          {stats && (stats.area?.length ?? 0) > 0 ? (
            <Bar data={areaChartData} options={areaOpts} style={{ maxHeight: '360px' }} />
          ) : stats ? (
            <div className="dash-map-empty">
              <i className="fas fa-shield-halved"></i>
              <span>No area data in the current selection.</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Civilian Locations Map */}
      <div className="dash-chart-card" style={{ marginBottom: '1rem' }}>
        <div className="dash-chart-header">
          <div className="dash-chart-title"><i className="fas fa-map-location-dot"></i> Civilian Locations</div>
          <div className="dash-chart-header-actions">
            <MapStyleToggle value={mapStyle} onChange={setMapStyle} />
            <span className="dash-chart-badge">{mapPins.length} pinned{hasActiveFilters ? ' (filtered)' : ''}</span>
          </div>
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
            center={MAP_DEFAULT_CENTER}
            zoom={MAP_DEFAULT_ZOOM}
            maxZoom={MAP_MAX_ZOOM}
            style={{ height: '380px', width: '100%', borderRadius: 'var(--radius)' }}
            scrollWheelZoom={true}
          >
            <MapResize onResize={refreshDashboardMap} />
            <MapTilerBasemap
              style={mapStyle}
              onLayerReady={(layer) => { mapLayerRef.current = layer; }}
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
