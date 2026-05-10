import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useToast }   from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import API from '../api';

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

export default function UpdateDelete() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const showToast  = useToast();
  const confirm    = useConfirm();
  const searchTimer = useRef(null);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    const data = q
      ? await API.get(`/api/search?q=${encodeURIComponent(q)}&mode=update`)
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

  const handleDelete = async (r) => {
    const ok = await confirm('Delete Record', 'Are you sure you want to permanently delete this record? This action cannot be undone.');
    if (!ok) return;
    const data = await API.delete(`/api/civilians/${r.id}`);
    if (data.success) {
      setRecords(prev => prev.filter(x => x.id !== r.id));
      showToast('Record deleted successfully.', 'success');
    } else {
      showToast(data.message || 'Delete failed.', 'error');
    }
  };

  const total = records.length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title"><i className="fas fa-pen-to-square"></i> Update / Delete Records</div>
          <div className="page-subtitle"><span id="recordCount">{total}</span> record(s) in database</div>
        </div>
        <div className="page-actions">
          <div className="search-bar">
            <i className="fas fa-magnifying-glass"></i>
            <input type="text" placeholder="Search by name, mobile, village, area…" autoComplete="off" onChange={handleSearch} />
          </div>
          <Link to="/dashboard/houseno" className="btn btn-outline-primary btn-sm">
            <i className="fas fa-house-circle-check"></i> Assign House No
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{position:'relative', height:'120px'}}>
          <div className="loading-overlay"><div className="loading-spinner"></div></div>
        </div>
      ) : records.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-database"></i>
          <h3>No Records Found</h3>
          <p>There are no civilian records yet. <Link to="/dashboard/add">Add a new record</Link> to get started.</p>
        </div>
      ) : (
        <div className="civilian-grid" id="civilianGrid">
          {records.map(r => {
            const photo = r.photo_path ? `/uploads/${encodeURIComponent(r.photo_path)}` : null;
            return (
              <div className="civilian-card" key={r.id}>
                <div className="cc-top">
                  {photo
                    ? <img src={photo} className="cc-avatar" alt="Photo"
                        onError={e => { e.target.style.display='none'; e.target.nextElementSibling.style.display='flex'; }} />
                    : null}
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
                  {r.occupation    && <span className="cc-tag occupation"><i className="fas fa-briefcase"></i>{r.occupation}</span>}
                  {r.health_status && <span className="cc-tag health"><i className="fas fa-heart-pulse"></i>{r.health_status}</span>}
                  {r.salary > 0   && <span className="cc-tag salary"><i className="fas fa-indian-rupee-sign"></i>{parseFloat(r.salary).toLocaleString()}</span>}
                  {r.area          && <span className="cc-tag area"><i className="fas fa-location-dot"></i>{r.area}</span>}
                </div>
                <div className="cc-actions">
                  <Link to={`/dashboard/edit/${r.id}`} className="btn btn-primary btn-sm">
                    <i className="fas fa-pen"></i> Update
                  </Link>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r)}>
                    <i className="fas fa-trash"></i> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
