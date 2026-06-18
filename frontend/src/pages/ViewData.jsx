import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function CivilianCard({ r }) {
  const photo = r.photo_path ? `/uploads/${encodeURIComponent(r.photo_path)}` : null;
  return (
    <div className="civilian-card">
      <div className="cc-top">
        {photo
          ? <img src={photo} className="cc-avatar" alt="Photo"
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
}

export default function ViewData() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const searchTimer           = useRef(null);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    const data = q
      ? await API.get(`/api/search?q=${encodeURIComponent(q)}&mode=view`)
      : await API.get('/api/civilians');
    if (data.success) setRecords(data.records || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => {
    const q = e.target.value;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(q), 350);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title"><i className="fas fa-table-list"></i> View Data</div>
          <div className="page-subtitle">{records.length} civilian record(s) on file</div>
        </div>
        <div className="page-actions">
          <div className="search-bar">
            <i className="fas fa-magnifying-glass"></i>
            <input type="text" placeholder="Search by name, mobile, village…" autoComplete="off" onChange={handleSearch} />
          </div>
          <Link to="/dashboard/add" className="btn btn-primary btn-sm">
            <i className="fas fa-plus"></i> Add Record
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{position:'relative', height:'120px'}}>
          <div className="loading-overlay"><div className="loading-spinner"></div></div>
        </div>
      ) : records.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-users"></i>
          <h3>No Records Found</h3>
          <p>Start by <Link to="/dashboard/add">adding a civilian record</Link>.</p>
        </div>
      ) : (
        <div className="civilian-grid" id="civilianGrid">
          {records.map(r => <CivilianCard key={r.id} r={r} />)}
        </div>
      )}
    </>
  );
}
