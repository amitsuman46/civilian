import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import API from '../api';
import { DIRECTORY_AREAS, DIRECTORY_VILLAGES } from '../constants/directoryOptions';

const COLUMNS = [
  { key: 'name',        label: 'Name',        sortable: true, sticky: true },
  { key: 'mobile',      label: 'Number',      sortable: true, mono: true },
  { key: 'designation', label: 'Designation', sortable: true },
  { key: 'village',     label: 'Village',     sortable: true },
  { key: 'area',        label: 'Area',        sortable: true },
];

function compareValues(a, b, key) {
  return String(a[key] || '').localeCompare(String(b[key] || ''), undefined, { sensitivity: 'base' });
}

function matchesQuery(r, q) {
  const needle = q.toLowerCase();
  return [r.name, r.mobile, r.designation, r.village, r.area]
    .some(v => v != null && String(v).toLowerCase().includes(needle));
}

export default function CivilDirectory() {
  const showToast = useToast();
  const confirm   = useConfirm();

  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [query, setQuery]           = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [sortKey, setSortKey]       = useState('name');
  const [sortDir, setSortDir]       = useState('asc');
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await API.get('/api/directory');
    if (data.success) setRecords(data.records || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(1); }, [query, areaFilter, villageFilter, pageSize, sortKey, sortDir]);

  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    let rows = records;
    if (trimmedQuery) rows = rows.filter(r => matchesQuery(r, trimmedQuery));
    if (areaFilter) rows = rows.filter(r => r.area === areaFilter);
    if (villageFilter) rows = rows.filter(r => r.village === villageFilter);
    return [...rows].sort((a, b) => {
      const cmp = compareValues(a, b, sortKey);
      return sortDir === 'asc' ? cmp : -cmp;
    });
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

  const handleDelete = async (r) => {
    const ok = await confirm(
      'Remove from Directory',
      `Remove "${r.name}" from the civil directory? This cannot be undone.`,
    );
    if (!ok) return;
    const data = await API.delete(`/api/directory/${r.id}`);
    if (data.success) {
      setRecords(prev => prev.filter(x => x.id !== r.id));
      showToast('Entry removed from directory.', 'success');
    } else {
      showToast(data.message || 'Delete failed.', 'error');
    }
  };

  const hasLocalFilters = Boolean(areaFilter || villageFilter || trimmedQuery);
  const rangeStart = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const rangeEnd   = Math.min(safePage * pageSize, filtered.length);

  return (
    <div className="cdir-wrap">
      <div className="cdir-hero">
        <div className="cdir-hero-content">
          <div className="cdir-hero-badge"><i className="fas fa-address-book"></i> Directory</div>
          <h1 className="cdir-hero-title">Civil Directory</h1>
          <p className="cdir-hero-desc">
            Manage civilian contacts — name, number, designation, village, and area.
          </p>
          <div className="cdir-hero-stats">
            <div className="cdir-stat">
              <span className="cdir-stat-val">{records.length.toLocaleString()}</span>
              <span className="cdir-stat-label">Total entries</span>
            </div>
            <div className="cdir-stat-divider" />
            <div className="cdir-stat">
              <span className="cdir-stat-val">{filtered.length.toLocaleString()}</span>
              <span className="cdir-stat-label">Showing now</span>
            </div>
          </div>
        </div>
        <div className="cdir-hero-actions">
          <Link to="/dashboard/directory/add" className="cdir-hero-btn cdir-hero-btn--solid">
            <i className="fas fa-plus"></i> Add Entry
          </Link>
        </div>
      </div>

      <div className="cdir-toolbar">
        <div className="cdir-search">
          <i className="fas fa-magnifying-glass"></i>
          <input
            type="text"
            value={query}
            placeholder="Search name, number, designation, village, area…"
            autoComplete="off"
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="cdir-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <i className="fas fa-xmark"></i>
            </button>
          )}
        </div>
        <div className="cdir-filters">
          <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)} aria-label="Filter by area">
            <option value="">All Areas</option>
            {DIRECTORY_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={villageFilter} onChange={e => setVillageFilter(e.target.value)} aria-label="Filter by village">
            <option value="">All Villages</option>
            {DIRECTORY_VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          {hasLocalFilters && (
            <button type="button" className="cdir-clear-btn" onClick={clearFilters}>
              <i className="fas fa-filter-circle-xmark"></i> Reset
            </button>
          )}
        </div>
      </div>

      <div className={`cdir-table-shell${loading ? ' is-loading' : ''}`}>
        {loading ? (
          <div className="cdir-loading">
            <div className="loading-spinner"></div>
            <span>Loading directory…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cdir-empty">
            <div className="cdir-empty-icon"><i className="fas fa-folder-open"></i></div>
            <h3>No directory entries</h3>
            <p>Add civilians to the directory with their contact and location details.</p>
            <Link to="/dashboard/directory/add" className="btn btn-primary btn-sm">
              <i className="fas fa-plus"></i> Add Entry
            </Link>
          </div>
        ) : (
          <div className="cdir-table-scroll cdir-table-scroll--simple">
            <table className="cdir-table cdir-table--simple">
              <thead>
                <tr>
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      className={`cdir-th${col.sticky ? ' cdir-th--sticky' : ''}${sortKey === col.key ? ' is-sorted' : ''}`}
                    >
                      <button type="button" className="cdir-sort-btn" onClick={() => toggleSort(col.key)}>
                        {col.label}
                        <i className={`fas fa-sort${sortKey === col.key ? (sortDir === 'asc' ? '-up' : '-down') : ''}`}></i>
                      </button>
                    </th>
                  ))}
                  <th className="cdir-th cdir-th--actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => (
                  <tr key={r.id} className="cdir-row">
                    {COLUMNS.map(col => (
                      <td key={col.key} className={`cdir-td${col.sticky ? ' cdir-td--sticky' : ''}`}>
                        {col.key === 'name' ? (
                          <span className="cdir-name">{r.name}</span>
                        ) : (
                          <span className={col.mono ? 'cdir-mono' : 'cdir-text'}>
                            {r[col.key] || <span className="cdir-muted">—</span>}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="cdir-td cdir-td--actions">
                      {r.can_edit ? (
                        <div className="cdir-actions">
                          <Link
                            to={`/dashboard/directory/edit/${r.id}`}
                            className="cdir-action cdir-action--edit"
                            title="Edit entry"
                          >
                            <i className="fas fa-pen"></i>
                          </Link>
                          <button
                            type="button"
                            className="cdir-action cdir-action--delete"
                            title="Remove entry"
                            onClick={() => handleDelete(r)}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      ) : (
                        <span className="cdir-muted" title="View only — created by another user">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="cdir-footer">
          <div className="cdir-range">
            Showing <strong>{rangeStart}–{rangeEnd}</strong> of <strong>{filtered.length.toLocaleString()}</strong> entries
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
