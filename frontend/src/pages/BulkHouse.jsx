import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import API from '../api';

export default function BulkHouse() {
  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [inputs, setInputs]         = useState({});   // id -> value
  const [saving, setSaving]         = useState({});   // id -> bool
  const [filterText, setFilterText] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    API.get('/api/house-list').then(data => {
      if (data.success) {
        setRecords(data.records);
        const init = {};
        data.records.forEach(r => { init[r.id] = r.house_no || ''; });
        setInputs(init);
      }
      setLoading(false);
    });
  }, []);

  const saveRow = useCallback(async (r) => {
    setSaving(s => ({ ...s, [r.id]: true }));
    const val = inputs[r.id]?.trim() || '';
    const data = await API.patch(`/api/civilians/${r.id}/house-no`, { house_no: val });
    if (data.success) {
      setRecords(prev => prev.map(x => x.id === r.id ? { ...x, house_no: val } : x));
    } else {
      showToast(data.message || 'Save failed.', 'error');
    }
    setSaving(s => ({ ...s, [r.id]: false }));
  }, [inputs, showToast]);

  const saveAll = async () => {
    const visible = filtered().filter(r => r.can_edit);
    if (!visible.length) {
      showToast('No editable records in the current view.', 'error');
      return;
    }
    let saved = 0, failed = 0;
    for (const r of visible) {
      const val = inputs[r.id]?.trim() || '';
      const data = await API.patch(`/api/civilians/${r.id}/house-no`, { house_no: val });
      if (data.success) {
        setRecords(prev => prev.map(x => x.id === r.id ? { ...x, house_no: val } : x));
        saved++;
      } else { failed++; }
    }
    showToast(failed === 0 ? `${saved} record(s) saved successfully.` : `${saved} saved, ${failed} failed.`, failed ? 'error' : 'success');
  };

  const filtered = useCallback(() => {
    const q = filterText.trim().toLowerCase();
    return records.filter(r => {
      const matchSearch = !q
        || r.name.toLowerCase().includes(q)
        || (r.village || '').toLowerCase().includes(q)
        || (r.area    || '').toLowerCase().includes(q);
      const matchMissing = !missingOnly || !r.house_no;
      return matchSearch && matchMissing;
    });
  }, [records, filterText, missingOnly]);

  if (loading) return <div style={{padding:'3rem',textAlign:'center'}}><div className="loading-spinner" style={{margin:'0 auto'}}></div></div>;

  const missingCount = records.filter(r => !r.house_no).length;
  const total        = records.length;
  const visible      = filtered();

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title"><i className="fas fa-house-circle-check"></i> Assign House Numbers</div>
          <div className="page-subtitle">
            {total} total record(s) &nbsp;·&nbsp;
            {missingCount > 0
              ? <span style={{color:'var(--danger)', fontWeight:700}}><i className="fas fa-triangle-exclamation"></i> {missingCount} missing house number(s)</span>
              : <span style={{color:'var(--success)', fontWeight:700}}><i className="fas fa-circle-check"></i> All records have house numbers</span>
            }
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-success btn-sm" onClick={saveAll}>
            <i className="fas fa-floppy-disk"></i> Save All
          </button>
          <Link to="/dashboard/update" className="btn btn-secondary btn-sm">
            <i className="fas fa-arrow-left"></i> Back
          </Link>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="empty-state"><i className="fas fa-database"></i><h3>No Records Found</h3></div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="form-card" style={{marginBottom:'1rem'}}>
            <div className="form-card-body" style={{padding:'.75rem 1.25rem'}}>
              <div style={{display:'flex', gap:'.75rem', alignItems:'center', flexWrap:'wrap'}}>
                <div className="search-bar" style={{flex:1, minWidth:'200px'}}>
                  <i className="fas fa-magnifying-glass"></i>
                  <input type="text" placeholder="Filter by name, village, area…" value={filterText}
                    onChange={e => setFilterText(e.target.value)} autoComplete="off" />
                </div>
                <label style={{display:'flex', alignItems:'center', gap:'.4rem', fontSize:'.85rem', fontWeight:600, cursor:'pointer'}}>
                  <input type="checkbox" checked={missingOnly} onChange={e => setMissingOnly(e.target.checked)} style={{width:'15px', height:'15px'}} />
                  Show missing only
                </label>
              </div>
            </div>
          </div>

          <div className="form-card">
            <div className="form-card-body" style={{padding:0, overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:'.875rem'}}>
                <thead>
                  <tr style={{background:'var(--primary)', color:'#fff'}}>
                    {['#','Name','Village / Area','House No',''].map((h, i) => (
                      <th key={i} style={{padding:'.6rem 1rem', textAlign:'left', fontWeight:700, fontSize:'.72rem', letterSpacing:'.05em', textTransform:'uppercase', width: i===0?'50px': i===3?'160px': i===4?'90px':'auto'}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, idx) => {
                    const isMissing = !r.house_no;
                    const readOnly = !r.can_edit;
                    return (
                      <tr key={r.id} style={{borderBottom:'1px solid var(--border)', background: isMissing ? 'rgba(220,38,38,.04)' : ''}}>
                        <td style={{padding:'.55rem 1rem', color:'var(--text-muted)', fontSize:'.8rem'}}>{idx + 1}</td>
                        <td style={{padding:'.55rem 1rem'}}>
                          <div style={{fontWeight:600, color:'var(--text)'}}>{r.name}</div>
                          <div style={{fontSize:'.75rem', color:'var(--text-muted)'}}>{r.mobile}</div>
                        </td>
                        <td style={{padding:'.55rem 1rem', color:'var(--text-muted)', fontSize:'.82rem'}}>
                          {[r.village, r.area].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td style={{padding:'.45rem .75rem'}}>
                          <input
                            type="text"
                            value={inputs[r.id] ?? ''}
                            onChange={e => setInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                            onKeyDown={e => !readOnly && e.key === 'Enter' && saveRow(r)}
                            placeholder="e.g. 01"
                            maxLength={20}
                            readOnly={readOnly}
                            title={readOnly ? 'Only the user who added this record can edit it' : undefined}
                            style={{
                              width:'100%', padding:'.35rem .6rem',
                              border: `1.5px solid ${isMissing ? 'var(--danger)' : 'var(--border)'}`,
                              borderRadius:'var(--radius-sm)', fontSize:'.85rem',
                              background: readOnly ? 'var(--surface)' : 'var(--bg)',
                              color:'var(--text)', outline:'none',
                              cursor: readOnly ? 'not-allowed' : 'text',
                              opacity: readOnly ? 0.75 : 1,
                            }}
                          />
                        </td>
                        <td style={{padding:'.45rem .75rem', textAlign:'center'}}>
                          {readOnly ? (
                            <span style={{ fontSize:'.72rem', color:'var(--text-muted)' }} title="Read only">
                              <i className="fas fa-lock"></i>
                            </span>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => saveRow(r)}
                              disabled={saving[r.id]}
                              style={{padding:'.3rem .65rem', fontSize:'.78rem'}}
                            >
                              {saving[r.id]
                                ? <span className="spinner" style={{width:'12px', height:'12px'}}></span>
                                : <i className="fas fa-check"></i>
                              }
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
