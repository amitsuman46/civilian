import { useEffect, useState, useCallback, useRef, memo } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import DashFilters from '../components/DashFilters';
import VirtualCivilianGrid from '../components/VirtualCivilianGrid';
import { useDashFilters } from '../hooks/useDashFilters';
import { appendFilterParams } from '../utils/dashFilters';
import { exportViewDataExcel, exportViewDataPdf } from '../utils/exportViewData';
import { useToast } from '../context/ToastContext';
import { uploadUrl } from '../utils/files';
import { suspiciousCardClass, suspiciousTagClass, normalizeSuspicious } from '../constants/civilianOptions';

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

const CivilianCard = memo(function CivilianCard({ r }) {
  const photo = uploadUrl(r.photo_path);
  const suspicious = normalizeSuspicious(r.suspicious);
  return (
    <div className={`civilian-card ${suspiciousCardClass(suspicious)}`}>
      <div className="cc-top">
        {photo
          ? <img src={photo} className="cc-avatar" alt="Photo" loading="lazy" decoding="async"
              onError={e => { e.target.style.display='none'; e.target.nextElementSibling.style.display='flex'; }} />
          : null
        }
        <div className="cc-avatar-placeholder" style={{ display: photo ? 'none' : 'flex' }}>
          <i className="fas fa-user"></i>
        </div>
        {r.house_no && <span className="cc-hno">H/No {r.house_no}</span>}
        <div className="cc-info">
          <div className="cc-name">{r.name}</div>
          <div className="cc-meta">
            <span><i className="fas fa-phone"></i>{r.mobile}</span>
            <span><i className="fas fa-map-marker-alt"></i>{r.village || '—'}, {r.area || '—'}</span>
            <span><i className="fas fa-calendar-alt"></i>{fmtDate(r.created_at)}</span>
          </div>
        </div>
      </div>
      <hr className="cc-divider" />
      <div className="cc-tags">
        <span className={suspiciousTagClass(suspicious)}>
          <i className="fas fa-user-shield"></i>Suspicious: {suspicious}
        </span>
        {r.occupation   && <span className="cc-tag occupation"><i className="fas fa-briefcase"></i>{r.occupation}</span>}
        {r.salary > 0   && <span className="cc-tag salary"><i className="fas fa-indian-rupee-sign"></i>{parseFloat(r.salary).toLocaleString()}/mo</span>}
        {r.document_path && <span className="cc-tag area"><i className="fas fa-paperclip"></i>Doc attached</span>}
      </div>
      <div className="cc-actions">
        <Link to={`/dashboard/report/${r.id}`} className="btn btn-primary btn-sm" style={{flex:1, justifyContent:'center'}}>
          <i className="fas fa-file-lines"></i> View Full Report
        </Link>
      </div>
    </div>
  );
});

export default function ViewData() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const searchTimer           = useRef(null);
  const showToast = useToast();
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

  const load = useCallback(async (q = '', activeFilters = filters) => {
    setLoading(true);
    let data;
    if (q) {
      const params = appendFilterParams(new URLSearchParams(), activeFilters);
      params.set('q', q);
      params.set('mode', 'view');
      data = await API.get(`/api/search?${params}`);
    } else {
      const params = appendFilterParams(new URLSearchParams(), activeFilters);
      const qs = params.toString();
      data = await API.get(`/api/civilians${qs ? `?${qs}` : ''}`);
    }
    if (data.success) setRecords(data.records || []);
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(searchQ, filters); }, [filters, searchQ, load]);

  const handleSearch = (e) => {
    const q = e.target.value;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQ(q), 350);
  };

  const exportMeta = { filterLabel: filterBadge, searchQuery: searchQ };

  const handleExportExcel = async () => {
    if (!records.length) return;
    setExporting(true);
    try {
      await exportViewDataExcel(records, exportMeta);
      showToast('Excel file downloaded.', 'success');
    } catch {
      showToast('Failed to export Excel file.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!records.length) return;
    setExporting(true);
    try {
      await exportViewDataPdf(records, exportMeta);
      showToast('PDF file downloaded.', 'success');
    } catch {
      showToast('Failed to export PDF file.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title"><i className="fas fa-table-list"></i> View Data</div>
          <div className="page-subtitle">
            {records.length} civilian record(s){hasActiveFilters ? ' (filtered)' : ' on file'}
          </div>
        </div>
        <div className="page-actions">
          <div className="search-bar">
            <i className="fas fa-magnifying-glass"></i>
            <input type="text" placeholder="Search by name, mobile, village…" autoComplete="off" onChange={handleSearch} />
          </div>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={handleExportExcel}
            disabled={loading || exporting || records.length === 0}
            title={records.length === 0 ? 'No records to export' : 'Export filtered records to Excel'}
          >
            <i className="fas fa-file-excel"></i> Excel
          </button>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={handleExportPdf}
            disabled={loading || exporting || records.length === 0}
            title={records.length === 0 ? 'No records to export' : 'Export filtered records to PDF'}
          >
            <i className="fas fa-file-pdf"></i> PDF
          </button>
          <Link to="/dashboard/add" className="btn btn-primary btn-sm">
            <i className="fas fa-plus"></i> Add Record
          </Link>
        </div>
      </div>

      <div className="dash-filters-card">
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

      {loading ? (
        <div style={{position:'relative', height:'120px'}}>
          <div className="loading-overlay"><div className="loading-spinner"></div></div>
        </div>
      ) : records.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-users"></i>
          <h3>No Records Found</h3>
          <p>
            {hasActiveFilters || searchQ
              ? <>No records match the current filters. Try adjusting or clearing them.</>
              : <>Start by <Link to="/dashboard/add">adding a civilian record</Link>.</>}
          </p>
        </div>
      ) : (
        <VirtualCivilianGrid
          records={records}
          renderCard={r => <CivilianCard key={r.id} r={r} />}
        />
      )}
    </>
  );
}
