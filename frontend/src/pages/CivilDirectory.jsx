import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';

const AREAS = ['A Coy','B Coy','C Coy','D Coy','E Coy','F Coy','HQ Coy'];
const VILLAGES = [
  'Gagariyan','Barmiya and Doba','Upper Gagariyan','Wazli','kainth',
  'Sawjiya(Maidan)','Sawjiya','Sawjian(Mir Muhallah)','Sawjian(Bandi Muhallah)',
  'Sawjian(Ladhi Muhallah)','Sawjian(Purya Muhallah)','Sawjian(Tantary Muhallah)',
  'Sawjian(Gantar)','Sawjian(Sundri)',
];

const HEALTH_CLASS = {
  Excellent: 'cdir-health--excellent',
  Good:      'cdir-health--good',
  Fair:      'cdir-health--fair',
  Poor:      'cdir-health--poor',
  Critical:  'cdir-health--critical',
};

const COLUMNS = [
  { key: 'house_no',            label: 'H/No',       sortable: true,  mono: true },
  { key: 'name',                label: 'Name',       sortable: true,  sticky: true },
  { key: 'mobile',              label: 'Mobile',     sortable: true,  mono: true },
  { key: 'village',             label: 'Village',    sortable: true },
  { key: 'area',                label: 'Company',    sortable: true },
  { key: 'occupation',          label: 'Occupation', sortable: true },
  { key: 'community',           label: 'Community',  sortable: true },
  { key: 'religion',            label: 'Religion',   sortable: true },
  { key: 'health_status',       label: 'Health',     sortable: true },
  { key: 'salary',              label: 'Salary',     sortable: true,  money: true },
  { key: 'income',              label: 'Income',     sortable: true,  money: true },
  { key: 'expenditure',         label: 'Expenditure',sortable: true,  money: true },
  { key: 'immovable_property',  label: 'Immovable',  sortable: true },
  { key: 'movable_property',    label: 'Movable',    sortable: true },
  { key: 'family_count',        label: 'Family',     sortable: true,  center: true },
  { key: 'created_at',          label: 'Registered', sortable: true },
];

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(v) {
  const n = parseFloat(v);
  if (!n) return '—';
  return '₹' + n.toLocaleString('en-IN');
}

function familyCount(raw) {
  try {
    const arr = Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function enrichRecord(r) {
  return { ...r, family_count: familyCount(r.family_details) };
}

function matchesQuery(r, q) {
  const needle = q.toLowerCase();
  const parts = [
    r.house_no, r.name, r.mobile, r.village, r.area, r.occupation,
    r.community, r.religion, r.health_status,
    r.immovable_property, r.movable_property,
    r.salary, r.income, r.expenditure, r.family_details,
  ];
  return parts.some(v => v != null && String(v).toLowerCase().includes(needle));
}

function compareValues(a, b, key) {
  if (key === 'salary' || key === 'income' || key === 'expenditure' || key === 'family_count') {
    return (parseFloat(a[key]) || 0) - (parseFloat(b[key]) || 0);
  }
  if (key === 'created_at') {
    return new Date(a[key] || 0) - new Date(b[key] || 0);
  }
  if (key === 'house_no') {
    const na = parseInt(a[key], 10) || 0;
    const nb = parseInt(b[key], 10) || 0;
    if (na !== nb) return na - nb;
  }
  return String(a[key] || '').localeCompare(String(b[key] || ''), undefined, { sensitivity: 'base' });
}

export default function CivilDirectory() {
  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [query, setQuery]         = useState('');
  const [areaFilter, setAreaFilter]       = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [sortKey, setSortKey]     = useState('name');
  const [sortDir, setSortDir]     = useState('asc');
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(25);
  const fetchId                   = useRef(0);

  const load = useCallback(async (q = '') => {
    const id = ++fetchId.current;
    setLoading(true);
    try {
      const data = q
        ? await API.get(`/api/search?q=${encodeURIComponent(q)}&mode=directory`)
        : await API.get('/api/civilians');
      if (id !== fetchId.current) return;
      if (data.success) setRecords((data.records || []).map(enrichRecord));
    } finally {
      if (id === fetchId.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(1); }, [query, areaFilter, villageFilter, pageSize, sortKey, sortDir]);

  const handleSearch = (e) => setQuery(e.target.value);

  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    let rows = records;
    if (trimmedQuery) rows = rows.filter(r => matchesQuery(r, trimmedQuery));
    if (areaFilter)    rows = rows.filter(r => r.area === areaFilter);
    if (villageFilter) rows = rows.filter(r => r.village === villageFilter);
    rows = [...rows].sort((a, b) => {
      const cmp = compareValues(a, b, sortKey);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [records, trimmedQuery, areaFilter, villageFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const clearFilters = () => {
    setAreaFilter('');
    setVillageFilter('');
    setQuery('');
  };

  const hasLocalFilters = Boolean(areaFilter || villageFilter || trimmedQuery);
  const rangeStart = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const rangeEnd   = Math.min(safePage * pageSize, filtered.length);

  const renderCell = (r, col) => {
    const val = r[col.key];
    if (col.key === 'health_status') {
      if (!val) return <span className="cdir-muted">—</span>;
      return <span className={`cdir-health ${HEALTH_CLASS[val] || ''}`}>{val}</span>;
    }
    if (col.money) return <span className="cdir-money">{fmtMoney(val)}</span>;
    if (col.key === 'created_at') return <span className="cdir-date">{fmtDate(val)}</span>;
    if (col.key === 'family_count') {
      return val > 0
        ? <span className="cdir-family"><i className="fas fa-users"></i>{val}</span>
        : <span className="cdir-muted">—</span>;
    }
    if (!val && val !== 0) return <span className="cdir-muted">—</span>;
    if (col.mono) return <span className="cdir-mono">{val}</span>;
    return <span className="cdir-text">{val}</span>;
  };

  return (
    <div className="cdir-wrap">
      {/* Hero */}
      <div className="cdir-hero">
        <div className="cdir-hero-content">
          <div className="cdir-hero-badge"><i className="fas fa-address-book"></i> Registry</div>
          <h1 className="cdir-hero-title">Civil Directory</h1>
          <p className="cdir-hero-desc">
            Browse, search, and filter every civilian record in one premium directory view.
          </p>
          <div className="cdir-hero-stats">
            <div className="cdir-stat">
              <span className="cdir-stat-val">{records.length.toLocaleString()}</span>
              <span className="cdir-stat-label">Total on file</span>
            </div>
            <div className="cdir-stat-divider" />
            <div className="cdir-stat">
              <span className="cdir-stat-val">{filtered.length.toLocaleString()}</span>
              <span className="cdir-stat-label">Showing now</span>
            </div>
            <div className="cdir-stat-divider" />
            <div className="cdir-stat">
              <span className="cdir-stat-val">{COLUMNS.length}</span>
              <span className="cdir-stat-label">Data fields</span>
            </div>
          </div>
        </div>
        <div className="cdir-hero-actions">
          <Link to="/dashboard/add" className="cdir-hero-btn cdir-hero-btn--solid">
            <i className="fas fa-user-plus"></i> Add Record
          </Link>
          <Link to="/dashboard/view" className="cdir-hero-btn">
            <i className="fas fa-grip"></i> Card View
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="cdir-toolbar">
        <div className="cdir-search">
          <i className="fas fa-magnifying-glass"></i>
          <input
            type="text"
            value={query}
            placeholder="Search name, mobile, village, occupation, religion, property, income…"
            autoComplete="off"
            onChange={handleSearch}
          />
          {query && (
            <button type="button" className="cdir-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <i className="fas fa-xmark"></i>
            </button>
          )}
        </div>
        <div className="cdir-filters">
          <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)} aria-label="Filter by company">
            <option value="">All Companies</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={villageFilter} onChange={e => setVillageFilter(e.target.value)} aria-label="Filter by village">
            <option value="">All Villages</option>
            {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          {hasLocalFilters && (
            <button type="button" className="cdir-clear-btn" onClick={clearFilters}>
              <i className="fas fa-filter-circle-xmark"></i> Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className={`cdir-table-shell${loading ? ' is-loading' : ''}`}>
        {loading ? (
          <div className="cdir-loading">
            <div className="loading-spinner"></div>
            <span>Loading directory…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cdir-empty">
            <div className="cdir-empty-icon"><i className="fas fa-folder-open"></i></div>
            <h3>No records found</h3>
            <p>Try adjusting your search or filters, or add a new civilian record.</p>
            <Link to="/dashboard/add" className="btn btn-primary btn-sm">
              <i className="fas fa-plus"></i> Add Record
            </Link>
          </div>
        ) : (
          <div className="cdir-table-scroll">
            <table className="cdir-table">
              <thead>
                <tr>
                  <th className="cdir-th cdir-th--photo">Photo</th>
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      className={`cdir-th${col.sticky ? ' cdir-th--sticky' : ''}${col.center ? ' cdir-th--center' : ''}${sortKey === col.key ? ' is-sorted' : ''}`}
                    >
                      {col.sortable ? (
                        <button type="button" className="cdir-sort-btn" onClick={() => toggleSort(col.key)}>
                          {col.label}
                          <i className={`fas fa-sort${sortKey === col.key ? (sortDir === 'asc' ? '-up' : '-down') : ''}`}></i>
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                  <th className="cdir-th cdir-th--actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => {
                  const photo = r.photo_path ? `/uploads/${encodeURIComponent(r.photo_path)}` : null;
                  return (
                    <tr key={r.id} className="cdir-row">
                      <td className="cdir-td cdir-td--photo">
                        {photo ? (
                          <img
                            src={photo}
                            alt=""
                            className="cdir-avatar"
                            onError={e => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }}
                          />
                        ) : null}
                        <div className="cdir-avatar-fallback" style={{ display: photo ? 'none' : 'flex' }}>
                          {initials(r.name)}
                        </div>
                      </td>
                      {COLUMNS.map(col => (
                        <td
                          key={col.key}
                          className={`cdir-td${col.sticky ? ' cdir-td--sticky' : ''}${col.center ? ' cdir-td--center' : ''}`}
                        >
                          {col.key === 'name' ? (
                            <div className="cdir-name-cell">
                              <span className="cdir-name">{r.name}</span>
                              {r.document_path && (
                                <span className="cdir-doc-badge" title="Document attached">
                                  <i className="fas fa-paperclip"></i>
                                </span>
                              )}
                            </div>
                          ) : renderCell(r, col)}
                        </td>
                      ))}
                      <td className="cdir-td cdir-td--actions">
                        <div className="cdir-actions">
                          <Link to={`/dashboard/report/${r.id}`} className="cdir-action cdir-action--view" title="View report">
                            <i className="fas fa-file-lines"></i>
                          </Link>
                          <Link to={`/dashboard/edit/${r.id}`} className="cdir-action cdir-action--edit" title="Edit record">
                            <i className="fas fa-pen"></i>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer / pagination */}
      {!loading && filtered.length > 0 && (
        <div className="cdir-footer">
          <div className="cdir-range">
            Showing <strong>{rangeStart}–{rangeEnd}</strong> of <strong>{filtered.length.toLocaleString()}</strong> records
          </div>
          <div className="cdir-pagination">
            <label className="cdir-page-size">
              Rows
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button type="button" className="cdir-page-btn" disabled={safePage <= 1} onClick={() => setPage(1)}>
              <i className="fas fa-angles-left"></i>
            </button>
            <button type="button" className="cdir-page-btn" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>
              <i className="fas fa-chevron-left"></i>
            </button>
            <span className="cdir-page-indicator">Page {safePage} of {totalPages}</span>
            <button type="button" className="cdir-page-btn" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>
              <i className="fas fa-chevron-right"></i>
            </button>
            <button type="button" className="cdir-page-btn" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>
              <i className="fas fa-angles-right"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
