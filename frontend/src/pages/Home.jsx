import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const { user }   = useAuth();
  const [stats, setStats] = useState(null);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr  = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  useEffect(() => {
    API.get('/api/stats').then(data => { if (data.success) setStats(data); });
  }, []);

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

  return (
    <>
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

      {/* KPI Cards */}
      <div className="kpi-grid">
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

      {/* Charts Row 1 */}
      <div className="dash-charts-row equal">
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div className="dash-chart-title"><i className="fas fa-chart-line"></i> Daily Registrations</div>
            <span className="dash-chart-badge">Last 30 days</span>
          </div>
          {stats && <Line data={dayChartData} options={lineOpts} />}
        </div>
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div className="dash-chart-title"><i className="fas fa-chart-bar"></i> Monthly Registrations</div>
            <span className="dash-chart-badge">Last 6 months</span>
          </div>
          {stats && <Bar data={monthChartData} options={barOpts} />}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="dash-charts-row two">
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div className="dash-chart-title"><i className="fas fa-chart-simple"></i> Village-wise Distribution</div>
            <span className="dash-chart-badge">All villages</span>
          </div>
          {stats && <Bar data={villageChartData} options={villageOpts} style={{ maxHeight: '360px' }} />}
        </div>
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div className="dash-chart-title"><i className="fas fa-shield-halved"></i> Company-wise Breakdown</div>
            <span className="dash-chart-badge">All Coys</span>
          </div>
          {stats && <Bar data={areaChartData} options={areaOpts} style={{ maxHeight: '360px' }} />}
        </div>
      </div>
    </>
  );
}
